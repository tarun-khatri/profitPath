// backend.js
// Simple backend to connect to Supabase Postgres and provide cross-chain swap functionality

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for backend
);

// Middleware
app.use(express.json());

// OKX API configuration
const OKX_API_KEY = process.env.OKX_API_KEY;
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY;
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE;
const OKX_BASE_URL = 'https://www.okx.com';

// Example endpoint to get all tokens from the 'tokens' table
app.get('/tokens', async (req, res) => {
  const { data, error } = await supabase.from('tokens').select('*');
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// Cross-chain quote endpoint
app.post('/crosschain/quote', async (req, res) => {
  try {
    const { fromChain, toChain, fromToken, toToken, amount } = req.body;
    
    // Call OKX API to get cross-chain quote
    const response = await axios.post(
      `${OKX_BASE_URL}/api/v5/trade/cross-chain-quote`,
      {
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
      },
      {
        headers: {
          'OK-ACCESS-KEY': OKX_API_KEY,
          'OK-ACCESS-SIGN': generateSignature('POST', '/api/v5/trade/cross-chain-quote', req.body),
          'OK-ACCESS-TIMESTAMP': new Date().toISOString(),
          'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        },
      }
    );

    res.json({ quote: response.data });
  } catch (error) {
    console.error('Error fetching cross-chain quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cross-chain swap endpoint
app.post('/crosschain/swap', async (req, res) => {
  try {
    const { quote, fromChain, toChain, fromToken, toToken, amount, userWalletAddress, receiveAddress } = req.body;
    
    // Call OKX API to initiate cross-chain swap
    const response = await axios.post(
      `${OKX_BASE_URL}/api/v5/trade/cross-chain-swap`,
      {
        quote,
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount,
        userWalletAddress,
        receiveAddress,
      },
      {
        headers: {
          'OK-ACCESS-KEY': OKX_API_KEY,
          'OK-ACCESS-SIGN': generateSignature('POST', '/api/v5/trade/cross-chain-swap', req.body),
          'OK-ACCESS-TIMESTAMP': new Date().toISOString(),
          'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        },
      }
    );

    res.json({ txData: response.data });
  } catch (error) {
    console.error('Error initiating cross-chain swap:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transaction status endpoint
app.get('/crosschain/tx-status', async (req, res) => {
  try {
    const { txHash } = req.query;
    
    // Call OKX API to check transaction status
    const response = await axios.get(
      `${OKX_BASE_URL}/api/v5/trade/cross-chain-tx-status`,
      {
        params: { txHash },
        headers: {
          'OK-ACCESS-KEY': OKX_API_KEY,
          'OK-ACCESS-SIGN': generateSignature('GET', '/api/v5/trade/cross-chain-tx-status', { txHash }),
          'OK-ACCESS-TIMESTAMP': new Date().toISOString(),
          'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
        },
      }
    );

    res.json({ status: response.data.status });
  } catch (error) {
    console.error('Error checking transaction status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate OKX API signature
function generateSignature(method, path, body) {
  const timestamp = new Date().toISOString();
  const message = timestamp + method + path + JSON.stringify(body);
  const signature = crypto
    .createHmac('sha256', OKX_SECRET_KEY)
    .update(message)
    .digest('base64');
  return signature;
}

// Mount modular API routes
const routes = require('./backend/routes');
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
