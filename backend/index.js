// backend/index.js
// Express backend to connect to Supabase Postgres and provide a /tokens endpoint

console.log('Backend server starting...'); // Added for debugging logging issues

const { app, PORT } = require('./supabaseClient');
const routes = require('./routes');
const quotesRouter = require('./routes/quotes');
const tokensRouter = require('./routes/tokens');
const { startTokenFetchScheduler } = require('./scheduler');
const cors = require('cors');
const express = require('express');
require('dotenv').config();
const aiRoutes = require('./routes/ai');

// Validate required environment variables
const requiredEnvVars = ['OKX_API_KEY', 'OKX_API_SECRET', 'OKX_API_PASSPHRASE'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/', routes);
app.use('/quotes', quotesRouter.router);
app.use('/api/tokens', tokensRouter);
app.use('/ai', aiRoutes);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  //startTokenFetchScheduler();
});
