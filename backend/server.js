const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const ping = require('ping');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/status', async (req, res) => {
    try {
        // 1. Get real local system load and memory
        const load = await si.currentLoad();
        const mem = await si.mem();
        const time = si.time();

        const localCpuUsage = load.currentLoad.toFixed(1) + '%';
        const localMemUsage = ((mem.used / mem.total) * 100).toFixed(1) + '%';
        const uptimeDays = (time.uptime / 86400).toFixed(1) + ' days';

        // 2. Perform a real network ping check against Google DNS (8.8.8.8) and Cloudflare (1.1.1.1)
        const googlePing = await ping.promise.probe('8.8.8.8', { timeout: 2 });
        const cloudflarePing = await ping.promise.probe('1.1.1.1', { timeout: 2 });

        const realServers = [
            {
                id: 'srv-local',
                name: 'Local Host Node (OS Telemetry)',
                status: 'online',
                cpuUsage: localCpuUsage,
                memoryUsage: localMemUsage,
                uptime: uptimeDays,
                latency: googlePing.alive ? googlePing.time + 'ms' : 'Timeout'
            },
            {
                id: 'srv-gateway-cf',
                name: 'Cloudflare Edge DNS (1.1.1.1)',
                status: cloudflarePing.alive ? 'online' : 'degraded',
                cpuUsage: 'N/A (External)',
                memoryUsage: 'N/A (External)',
                uptime: 'Always On',
                latency: cloudflarePing.alive ? cloudflarePing.time + 'ms' : 'Unreachable'
            }
        ];

        res.json({
            timestamp: new Date().toISOString(),
            totalServers: realServers.length,
            servers: realServers
        });
    } catch (error) {
        console.error('Error fetching system telemetry:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running with real telemetry on port ${PORT}`);
});