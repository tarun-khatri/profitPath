// backend/routes/tokens.js
// Express router for /tokens endpoint

const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient').supabase;

// POST /tokens/fetch - (optional: manual trigger)
const { fetchAndStoreOkxTokens } = require('../okxTokensFetcher');
router.post('/fetch', async (req, res) => {
  try {
    await fetchAndStoreOkxTokens();
    res.json({ message: 'Tokens fetched from OKX and stored in Supabase.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /chains - fetch unique chains from Supabase with pagination
router.get('/chains', async (req, res) => {
  let allChains = [];
  let from = 0;
  const batchSize = 1000;
  let keepGoing = true;

  while (keepGoing) {
    const { data, error } = await supabase
      .from('tokens')
      .select('chain')
      .neq('chain', null)
      .range(from, from + batchSize - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      keepGoing = false;
    } else {
      allChains = allChains.concat(data);
      from += batchSize;
      if (data.length < batchSize) keepGoing = false;
    }
  }

  // Deduplicate and stringify
  const uniqueChains = [...new Set(allChains.map(t => String(t.chain)))];
  console.log("Unique chains:", uniqueChains);
  res.json(uniqueChains);
});

// GET /tokens?chain=CHAIN_INDEX - fetch tokens for a specific chain
router.get('/', async (req, res) => {
  const { chain } = req.query;
  let allTokens = [];
  let from = 0;
  const batchSize = 1000;
  let keepGoing = true;

  while (keepGoing) {
    let query = supabase.from('tokens').select('*');
    if (chain) query = query.eq('chain', chain);
    query = query.range(from, from + batchSize - 1);
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      keepGoing = false;
    } else {
      allTokens = allTokens.concat(data);
      from += batchSize;
      if (data.length < batchSize) keepGoing = false;
    }
  }

  console.log(`Fetched ${allTokens.length} tokens${chain ? ` for chain ${chain}` : ''}`);
  res.json(allTokens);
});

// POST /quotes - fetch a quote from OKX DEX API (same-chain only)
router.post('/quotes', async (req, res) => {
  const { fromChain, toChain, fromToken, toToken, amount } = req.body;
  if (!fromChain || !toChain || !fromToken || !toToken) {
    return res.status(400).json({ error: 'Please provide fromChain, toChain, fromToken, toToken.' });
  }
  if (fromChain !== toChain) {
    return res.status(400).json({ error: 'Cross-chain quotes are not supported by OKX at this time.' });
  }
  try {
    const [fromTokenAddress] = fromToken.split('-');
    const [toTokenAddress] = toToken.split('-');
    const amountIn = amount && Number(amount) > 0 ? amount : '1';
    const url = `https://www.okx.com/api/v5/dex/aggregator/quote?chainId=${fromChain}&inTokenAddress=${fromTokenAddress}&outTokenAddress=${toTokenAddress}&amount=${amountIn}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.data && data.data[0]) {
      res.json(data.data[0]);
    } else {
      res.status(404).json({ error: 'No quote found or invalid response from OKX.' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch quote.' });
  }
});

module.exports = router;
