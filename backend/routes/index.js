// backend/routes/index.js
// Main router to combine all route modules

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Helper function to generate OKX API signature
const generateSignature = (timestamp, method, requestPath, body, secretKey) => {
  const message = timestamp + method + requestPath + (body ? JSON.stringify(body) : '');
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
};

// Helper function to get account ID for a wallet address
const getAccountId = async (address) => {
  const timestamp = new Date().toISOString();
  const method = 'GET';
  const requestPath = '/api/v5/dex/account/address';

  const signature = generateSignature(
    timestamp,
    method,
    requestPath,
    '',
    process.env.OKX_API_SECRET
  );

  const response = await axios.get(`https://web3.okx.com${requestPath}?address=${address}`, {
    headers: {
      'OK-ACCESS-KEY': process.env.OKX_API_KEY,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
      'Content-Type': 'application/json'
    }
  });

  if (!response.data.data || !response.data.data[0] || !response.data.data[0].accountId) {
    throw new Error('Failed to get account ID');
  }

  return response.data.data[0].accountId;
};

// Get portfolio total value
router.get('/portfolio/total-value', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!process.env.OKX_API_KEY || !process.env.OKX_API_SECRET || !process.env.OKX_API_PASSPHRASE) {
      return res.status(500).json({ error: 'OKX API credentials not configured' });
    }

    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/dex/balance/total-value';
    const queryString = `?address=${address}&accountId=${address}&chains=1`;

    const signature = generateSignature(
      timestamp,
      method,
      requestPath + queryString,
      '',
      process.env.OKX_API_SECRET
    );

    const response = await axios.get(`https://web3.okx.com${requestPath}${queryString}`, {
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching portfolio total value:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio data',
      details: error.response?.data || error.message
    });
  }
});

// Get token balances
router.get('/portfolio/token-balances', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!process.env.OKX_API_KEY || !process.env.OKX_API_SECRET || !process.env.OKX_API_PASSPHRASE) {
      return res.status(500).json({ error: 'OKX API credentials not configured' });
    }

    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/dex/balance/all-token-balances-by-address';
    const queryString = `?address=${address}&accountId=${address}&chains=1`;

    const signature = generateSignature(
      timestamp,
      method,
      requestPath + queryString,
      '',
      process.env.OKX_API_SECRET
    );

    const response = await axios.get(`https://web3.okx.com${requestPath}${queryString}`, {
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching token balances:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch token balances',
      details: error.response?.data || error.message
    });
  }
});

router.use('/tokens', require('./tokens'));
router.use('/health', require('./health'));
router.use('/crosschain', require('./crosschain'));
router.use('/credit-score', require('./credit-score'));

module.exports = router;
