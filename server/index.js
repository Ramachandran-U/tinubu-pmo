require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const migrate = require('./migrate');
const errorHandler = require('./middleware/error-handler');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── API Routes (placeholder until later phases) ────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register routers
app.use('/api/upload', require('./routes/upload'));
app.use('/api/months', require('./routes/months'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/timelog', require('./routes/timelog'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/heatmap', require('./routes/heatmap'));
app.use('/api/charts', require('./routes/charts'));

// ── Serve frontend in production ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    await migrate();
    app.listen(PORT, () => {
      console.log(`\n✅ Tinubu PMO Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
