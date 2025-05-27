const axios = require('axios');
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const router = express.Router();

// Simple in-memory cache for credit scores (per address)
const creditScoreCache = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Global rate limiter: allow only 1 OKX API request per second
let lastOkxRequestTime = 0;

// Utility: Calculate credit score (simple rules-based for MVP)
function calculateCreditScore(factors) {
  // Score out of 900, minimum 300
  let score = 300;
  // Wallet age: up to 200 points
  score += Math.min(factors.walletAgeDays, 365) * 0.55;
  // Transaction frequency: up to 200 points
  score += Math.min(factors.txFrequency, 500) * 0.4;
  // Token diversity: up to 100 points
  score += Math.min(factors.tokenDiversity, 20) * 5;
  // Protocol interactions: up to 100 points
  score += Math.min(factors.protocolInteractions, 20) * 5;
  return Math.round(Math.min(score, 900));
}

// Extract factors from OKX API transaction data
function extractFactorsFromTransactions(transactions) {
  if (!transactions.length) return {
    walletAgeDays: 0,
    txFrequency: 0,
    tokenDiversity: 0,
    protocolInteractions: 0,
  };
  const now = Date.now();
  const txTimes = transactions.map(tx => Number(tx.txTime)).filter(Boolean);
  const oldest = Math.min(...txTimes);
  const walletAgeDays = Math.floor((now - oldest) / (1000 * 60 * 60 * 24));
  const txFrequency = transactions.length;
  const tokenSet = new Set(transactions.map(tx => tx.tokenContractAddress || tx.symbol));
  const tokenDiversity = tokenSet.size;
  const protocolSet = new Set(transactions.map(tx => tx.symbol));
  const protocolInteractions = protocolSet.size;
  return { walletAgeDays, txFrequency, tokenDiversity, protocolInteractions };
}

function getOkxHeaders(method, requestPath, body = '') {
  const timestamp = new Date().toISOString();
  const prehash = timestamp + method + requestPath + body;
  const sign = crypto
    .createHmac('sha256', process.env.OKX_API_SECRET)
    .update(prehash)
    .digest('base64');
  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': process.env.OKX_API_KEY,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
    'OK-ACCESS-TIMESTAMP': timestamp,
  };
}

// GET /credit-score?address=0x...
router.get('/', async (req, res) => {
  const { address } = req.query;
  console.log('[GET /api/credit-score] Query:', req.query); // Log incoming query
  if (!address) {
    console.error('[GET /api/credit-score] Missing address in query');
    return res.status(400).json({ error: 'Missing address' });
  }
  // Check cache first
  const cached = creditScoreCache[address];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[GET /api/credit-score] Returning cached result for', address);
    return res.json(cached.data);
  }
  // Global rate limit: 1 request per second
  const now = Date.now();
  const timeSinceLast = now - lastOkxRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastOkxRequestTime = Date.now();
  try {
    const requestPath = `/api/v5/dex/post-transaction/transactions-by-address?address=${address}&chains=1&limit=20`;
    const url = `https://web3.okx.com${requestPath}`;
    const headers = getOkxHeaders('GET', requestPath);
    console.log('[GET /api/credit-score] Fetching from OKX:', url, headers);
    let resp;
    try {
      resp = await axios.get(url, { headers });
      console.log('[GET /api/credit-score] OKX API response:', resp.data);
    } catch (apiErr) {
      console.error('[GET /api/credit-score] OKX API error:', apiErr?.response?.data || apiErr.message);
      return res.status(502).json({ error: 'OKX API error', details: apiErr?.response?.data || apiErr.message });
    }
    if (!resp.data || resp.data.code !== '0') {
      console.error('[GET /api/credit-score] OKX API non-success response:', resp.data);
      return res.status(502).json({ error: 'OKX API non-success', details: resp.data });
    }
    // Log the full OKX transactions array (not transactionList)
    console.log('[GET /api/credit-score] Full OKX transactions:', JSON.stringify(resp.data?.data?.[0]?.transactions, null, 2));
    const txList = resp.data?.data?.[0]?.transactions || [];
    const allTxs = txList;
    // Pass allTxs to AI endpoint for scoring
    // Instead of calculating score here, just extract factors and send to AI
    const factors = extractFactorsFromTransactions(allTxs);
    // Call AI endpoint
    try {
      const aiRes = await axios.post(
        `${process.env.AI_API_URL || 'http://localhost:4000'}/ai/credit-score`,
        { factors }
      );
      const aiScore = aiRes.data;
      const result = { ...aiScore, factors };
      creditScoreCache[address] = { data: result, timestamp: Date.now() };
      res.json(result);
    } catch (aiErr) {
      console.error('AI scoring error:', aiErr?.response?.data || aiErr.message);
      // fallback to local score if AI fails
      const score = calculateCreditScore(factors);
      const result = { score, factors, explanation: 'Fallback: Local rules-based score.' };
      creditScoreCache[address] = { data: result, timestamp: Date.now() };
      res.json(result);
    }
  } catch (e) {
    console.error('[GET /api/credit-score] Internal error:', e);
    res.status(500).json({ error: e.message || 'Failed to fetch credit score' });
  }
});

module.exports = router;
