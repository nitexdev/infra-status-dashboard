const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Simulated infrastructure status endpoint
app.get('/api/status', (req, res) => {
    const mockServers = [
        {
            id: 'srv-01',
            name: 'US-East Production Node',
            status: 'online',
            cpuUsage: (Math.random() * 40 + 10).toFixed(1) + '%',
            memoryUsage: (Math.random() * 30 + 40).toFixed(1) + '%',
            uptime: '14 days',
            latency: '24ms'
        },
        {
            id: 'srv-02',
            name: 'EU-Central Database Node',
            status: 'online',
            cpuUsage: (Math.random() * 50 + 20).toFixed(1) + '%',
            memoryUsage: (Math.random() * 20 + 60).toFixed(1) + '%',
            uptime: '45 days',
            latency: '88ms'
        },
        {
            id: 'srv-03',
            name: 'AP-Southeast Gateway',
            status: 'degraded',
            cpuUsage: (Math.random() * 15 + 80).toFixed(1) + '%',
            memoryUsage: (Math.random() * 10 + 85).toFixed(1) + '%',
            uptime: '2 days',
            latency: '142ms'
        }
    ];

    res.json({
        timestamp: new Date().toISOString(),
        totalServers: mockServers.length,
        servers: mockServers
    });
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});