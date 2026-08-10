const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const ping = require('ping');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database (In-file or memory)
const db = new sqlite3.Database('./metrics.db', (err) => {
    if (err) console.error('Database opening error: ', err.message);
    else console.log('Connected to SQLite persistent metrics database.');
});

// Create tables for historical data & incidents
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
});

// Background job: Collect & store metrics every 30 seconds
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
    } catch (e) {
        console.error('Background telemetry collection error:', e);
    }
}, 30000);

// API Endpoint: Get Current Status & History Trends
app.get('/api/status', async (req, res) => {
    try {
        const load = await si.currentLoad();
        const mem = await si.mem();
        const time = si.time();

        const localCpuUsage = load.currentLoad.toFixed(1) + '%';
        const localMemUsage = ((mem.used / mem.total) * 100).toFixed(1) + '%';
        const uptimeDays = (time.uptime / 86400).toFixed(1) + ' days';

        const googlePing = await ping.promise.probe('8.8.8.8', { timeout: 2 });
        const cloudflarePing = await ping.promise.probe('1.1.1.1', { timeout: 2 });

        // Fetch last 10 historical entries for sparkline charts
        db.all(`SELECT cpu_usage, memory_usage, timestamp FROM metrics_history WHERE server_id = 'srv-local' ORDER BY id DESC LIMIT 10`, [], async (err, historyRows) => {
            
            // Fetch recent incident logs
            db.all(`SELECT * FROM incident_logs ORDER BY id DESC LIMIT 5`, [], (err, incidentRows) => {
                
                const realServers = [
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
                    {
                        id: 'srv-gateway-cf',
                        name: 'Cloudflare Edge DNS (1.1.1.1)',
                        status: cloudflarePing.alive ? 'online' : 'degraded',
                        cpuUsage: 'N/A',
                        memoryUsage: 'N/A',
                        uptime: 'Always On',
                        latency: cloudflarePing.alive ? cloudflarePing.time + 'ms' : 'Unreachable',
                        history: []
                    }
                ];

                res.json({
                    timestamp: new Date().toISOString(),
                    totalServers: realServers.length,
                    servers: realServers,
                    incidents: incidentRows || []
                });
            });
        });

    } catch (error) {
        console.error('Error fetching system telemetry:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Advanced backend server running on port ${PORT}`);
});