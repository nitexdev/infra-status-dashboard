const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const ping = require('ping');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./metrics.db', (err) => {
    if (err) console.error('Database opening error: ', err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS metrics_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT,
        cpu_usage REAL,
        memory_usage REAL,
        latency INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS incident_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id TEXT,
        event_type TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS monitored_nodes (
        id TEXT PRIMARY KEY,
        name TEXT,
        host TEXT
    )`, () => {
        db.get(`SELECT COUNT(*) as count FROM monitored_nodes`, (err, row) => {
            if (row && row.count === 0) {
                db.run(`INSERT INTO monitored_nodes (id, name, host) VALUES (?, ?, ?)`, ['srv-gateway-cf', 'Cloudflare Edge DNS', '1.1.1.1']);
            }
        });
    });
});

// Background job: Telemetry collection & threshold monitoring
setInterval(async () => {
    try {
        const load = await si.currentLoad();
        const mem = await si.mem();
        const googlePing = await ping.promise.probe('8.8.8.8', { timeout: 2 });

        const cpuVal = parseFloat(load.currentLoad.toFixed(1));
        const memVal = parseFloat(((mem.used / mem.total) * 100).toFixed(1));
        const latencyVal = googlePing.alive ? googlePing.time : 999;

        db.run(`INSERT INTO metrics_history (server_id, cpu_usage, memory_usage, latency) VALUES (?, ?, ?, ?)`,
            ['srv-local', cpuVal, memVal, latencyVal]
        );

        if (cpuVal > 85) {
            db.run(`INSERT INTO incident_logs (server_id, event_type, message) VALUES (?, ?, ?)`,
                ['srv-local', 'WARNING', `High CPU Load detected: ${cpuVal}%`]
            );
        }
    } catch (e) {
        console.error('Background job error:', e);
    }
}, 30000);

app.get('/api/status', async (req, res) => {
    try {
        const load = await si.currentLoad();
        const mem = await si.mem();
        const time = si.time();

        const localCpuUsage = load.currentLoad.toFixed(1) + '%';
        const localMemUsage = ((mem.used / mem.total) * 100).toFixed(1) + '%';
        const uptimeDays = (time.uptime / 86400).toFixed(1) + ' days';

        const googlePing = await ping.promise.probe('8.8.8.8', { timeout: 2 });

        db.all(`SELECT * FROM monitored_nodes`, [], async (err, customNodes) => {
            let extraServers = [];
            for (let node of customNodes) {
                const p = await ping.promise.probe(node.host, { timeout: 2 });
                extraServers.push({
                    id: node.id,
                    name: node.name,
                    status: p.alive ? 'online' : 'degraded',
                    cpuUsage: 'N/A (Remote)',
                    memoryUsage: 'N/A (Remote)',
                    uptime: 'Active Ping',
                    latency: p.alive ? p.time + 'ms' : 'Unreachable',
                    history: []
                });
            }

            db.all(`SELECT cpu_usage, memory_usage, timestamp FROM metrics_history WHERE server_id = 'srv-local' ORDER BY id DESC LIMIT 15`, [], (err, historyRows) => {
                db.all(`SELECT * FROM incident_logs ORDER BY id DESC LIMIT 6`, [], (err, incidentRows) => {
                    const servers = [
                        {
                            id: 'srv-local',
                            name: 'Local Host Node (OS Telemetry)',
                            status: 'online',
                            cpuUsage: localCpuUsage,
                            memoryUsage: localMemUsage,
                            uptime: uptimeDays,
                            latency: googlePing.alive ? googlePing.time + 'ms' : 'Timeout',
                            history: historyRows ? historyRows.reverse() : []
                        },
                        ...extraServers
                    ];

                    res.json({
                        timestamp: new Date().toISOString(),
                        totalServers: servers.length,
                        servers: servers,
                        incidents: incidentRows || []
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/nodes', (req, res) => {
    const { name, host } = req.body;
    if (!name || !host) return res.status(400).json({ error: 'Name and host required' });
    
    // Fixed string generation
    const id = 'srv-' + Math.random().toString(36).substring(2, 7);

    db.run(`INSERT INTO monitored_nodes (id, name, host) VALUES (?, ?, ?)`, [id, name, host], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`INSERT INTO incident_logs (server_id, event_type, message) VALUES (?, ?, ?)`,
            [id, 'INFO', `New monitoring node added: ${name} (${host})`]
        );
        res.json({ success: true, id });
    });
});

app.get('/api/export', (req, res) => {
    db.all(`SELECT * FROM metrics_history ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=infra-metrics-export.json');
        res.send(JSON.stringify(rows, null, 2));
    });
});

app.post('/api/audit', (req, res) => {
    db.run(`INSERT INTO incident_logs (server_id, event_type, message) VALUES (?, ?, ?)`,
        ['cluster', 'AUDIT', 'Manual diagnostic probe executed by system operator.'],
        () => { res.json({ success: true }); }
    );
});

app.listen(PORT, () => {
    console.log(`Enterprise Advanced Backend running on port ${PORT}`);
});