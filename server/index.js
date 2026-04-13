const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'stats.json');

function loadStats() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { totalVisits: 0, uniqueVisitors: new Set() };
}

function saveStats(stats) {
  const data = {
    totalVisits: stats.totalVisits,
    uniqueVisitors: [...stats.uniqueVisitors]
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Load on startup
const rawStats = loadStats();
const stats = {
  totalVisits: rawStats.totalVisits || 0,
  uniqueVisitors: new Set(rawStats.uniqueVisitors || [])
};

// Record a visit
app.post('/api/visit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  stats.totalVisits++;
  stats.uniqueVisitors.add(ip);
  saveStats(stats);
  res.json({
    totalVisits: stats.totalVisits,
    uniqueVisitors: stats.uniqueVisitors.size
  });
});

// Get stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalVisits: stats.totalVisits,
    uniqueVisitors: stats.uniqueVisitors.size
  });
});

const PORT = 8081;
app.listen(PORT, () => {
  console.log(`Stats server running on port ${PORT}`);
});
