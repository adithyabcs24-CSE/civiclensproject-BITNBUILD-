const express = require('express');
const cors = require('cors');
const { router: documentsRouter } = require('./routes/documents');
const analysesRouter = require('./routes/analyses');
const alertsRouter = require('./routes/alerts');
const { router: timelineRouter } = require('./routes/timeline');
const { router: neighborhoodImpactsRouter } = require('./routes/neighborhoodImpacts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'CivicLens AI Backend', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/documents', documentsRouter);
app.use('/api/analyses', analysesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/neighborhood-impacts', neighborhoodImpactsRouter);

// Serve built React frontend from frontend/dist
const path = require('path');
const fs = require('fs');
const frontendDist = path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 fallthrough for API
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CivicLens AI backend listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
