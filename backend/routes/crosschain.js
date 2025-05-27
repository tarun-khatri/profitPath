const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
require('dotenv').config();

// Modular function to fetch a cross-chain swap estimation from OKX DEX API
async function fetchOkxCrossChainQuote({ fromChain, toChain, fromToken, toToken, amount, slippage = '0.01', fromTokenDecimals }) {
  console.log('[fetchOkxCrossChainQuote] params:', { fromChain, toChain, fromToken, toToken, amount, slippage, fromTokenDecimals });
  let decimals = fromTokenDecimals;
  if (decimals == null) {
    // Try to fetch decimals from Supabase
    try {
      const { data: tokenData, error } = await require('../supabaseClient').supabase
        .from('tokens')
        .select('decimals')
        .eq('address', fromToken)
        .eq('chain', fromChain)
        .limit(1)
        .single();
      if (tokenData && typeof tokenData.decimals === 'number') {
        decimals = tokenData.decimals;
        console.log('[fetchOkxCrossChainQuote] Decimals from Supabase:', decimals);
      } else {
        decimals = 18;
        console.warn('[fetchOkxCrossChainQuote] Decimals not found in Supabase, defaulting to 18');
      }
    } catch (e) {
      decimals = 18;
      console.warn('[fetchOkxCrossChainQuote] Error fetching decimals from Supabase, defaulting to 18', e.message);
    }
  }
  if (!fromChain || !toChain || !fromToken || !toToken || !amount || decimals == null) {
    console.error('[fetchOkxCrossChainQuote] Missing required parameter');
    throw new Error('Please provide fromChain, toChain, fromToken, toToken, amount, and fromTokenDecimals.');
  }
  // Convert amount to minimal units using decimals
  let amountInMinimalUnits;
  try {
    amountInMinimalUnits = (BigInt(Math.floor(Number(amount) * Math.pow(10, Number(decimals))))).toString();
  } catch {
    amountInMinimalUnits = (Number(amount) * Math.pow(10, Number(decimals))).toFixed(0);
  }
  console.log('[fetchOkxCrossChainQuote] amountInMinimalUnits:', amountInMinimalUnits);
  // Use correct OKX endpoint and params
  const params = new URLSearchParams({
    fromChainIndex: fromChain,
    toChainIndex: toChain,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    amount: amountInMinimalUnits,
    slippage: slippage,
  });
  const path = `/api/v5/dex/cross-chain/quote?${params.toString()}`;
  const url = `https://web3.okx.com${path}`;
  console.log('[fetchOkxCrossChainQuote] Requesting URL:', url);
  const response = await fetch(url, { headers: getOkxHeaders('GET', path) });
  const data = await response.json();
  console.log('[fetchOkxCrossChainQuote] OKX API response:', JSON.stringify(data));
  if (data && data.data && data.data.length > 0) {
    return data.data[0]; // Only one route is returned
  } else {
    if (data && data.msg) {
      throw new Error(data.msg);
    }
    throw new Error('No cross-chain quote found or invalid response from OKX.');
  }
}

// Helper to add OKX headers (full signature, like in quotes.js)
function getOkxHeaders(method = 'GET', path = '', body = '') {
  const apiKey = process.env.OKX_API_KEY;
  const passphrase = process.env.OKX_API_PASSPHRASE;
  const secret = process.env.OKX_API_SECRET;
  const timestamp = new Date().toISOString();
  const prehash = timestamp + method + path + body;
  const sign = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA256(prehash, secret)
  );
  return {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': timestamp,
  };
}

// POST /crosschain/quote - fetch a cross-chain quote from OKX DEX API
router.post('/quote', async (req, res) => {
  try {
    const body = req.body || {};
    console.log('[POST /crosschain/quote] Incoming payload:', JSON.stringify(body));
    const quote = await fetchOkxCrossChainQuote(body);
    console.log('[POST /crosschain/quote] OKX quote response:', JSON.stringify(quote));
    res.json({ quote });
  } catch (e) {
    console.error('[POST /crosschain/quote] error:', e);
    res.status(400).json({ error: e.message || 'Failed to fetch cross-chain quote.' });
  }
});

// GET /crosschain/chains - fetch all unique chains from Supabase
router.get('/chains', async (req, res) => {
  let allChains = [];
  let from = 0;
  const batchSize = 1000;
  let keepGoing = true;

  while (keepGoing) {
    const { data, error } = await require('../supabaseClient').supabase
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

  const uniqueChains = [...new Set(allChains.map(t => String(t.chain)))];
  res.json(uniqueChains);
});

// GET /crosschain/tokens - fetch all tokens from Supabase
router.get('/tokens', async (req, res) => {
  const { chain } = req.query;
  let query = require('../supabaseClient').supabase.from('tokens').select('*');
  if (chain) query = query.eq('chain', chain);
  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// GET /crosschain/supported-chains - fetch supported cross-chain chains from OKX (from tokens endpoint)
router.get('/supported-chains', async (req, res) => {
  try {
    console.log('[GET /crosschain/supported-chains] Fetching from OKX...');
    const okxRes = await fetch('https://web3.okx.com/api/v5/dex/cross-chain/supported/tokens', {
      headers: getOkxHeaders('GET', '/api/v5/dex/cross-chain/supported/tokens')
    });
    const data = await okxRes.json();
    console.log('[GET /crosschain/supported-chains] OKX response:', JSON.stringify(data).slice(0, 500));
    if (data && data.data) {
      // Extract unique chainIds from the token list
      const uniqueChains = Array.from(new Set(data.data.map(t => t.chainId)));
      res.json(uniqueChains);
    } else {
      res.status(500).json({ error: 'No data from OKX' });
    }
  } catch (e) {
    console.error('[GET /crosschain/supported-chains] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /crosschain/supported-tokens?chainId=... - fetch supported tokens for a chain from OKX
router.get('/supported-tokens', async (req, res) => {
  const { chainId } = req.query;
  if (!chainId) return res.status(400).json({ error: 'chainId required' });
  try {
    console.log(`[GET /crosschain/supported-tokens] Fetching for chainId=${chainId}`);
    const okxRes = await fetch('https://web3.okx.com/api/v5/dex/cross-chain/supported/tokens', {
      headers: getOkxHeaders('GET', '/api/v5/dex/cross-chain/supported/tokens')
    });
    const data = await okxRes.json();
    console.log('[GET /crosschain/supported-tokens] OKX response:', JSON.stringify(data).slice(0, 500));
    if (data && data.data) {
      // Filter tokens for the requested chainId
      const tokens = data.data.filter(t => String(t.chainId) === String(chainId));
      res.json(tokens);
    } else {
      res.status(500).json({ error: 'No data from OKX' });
    }
  } catch (e) {
    console.error('[GET /crosschain/supported-tokens] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /crosschain/supported-token-pairs?fromChainId=...&fromTokenAddress=... - fetch valid destination tokens for a source token
router.get('/supported-token-pairs', async (req, res) => {
  const { fromChainId, fromTokenAddress } = req.query;
  if (!fromChainId || !fromTokenAddress) return res.status(400).json({ error: 'fromChainId and fromTokenAddress required' });
  try {
    console.log(`[GET /crosschain/supported-token-pairs] Fetching for fromChainId=${fromChainId}, fromTokenAddress=${fromTokenAddress}`);
    const okxRes = await fetch('https://web3.okx.com/api/v5/dex/cross-chain/supported/bridge-tokens-pairs', {
      headers: getOkxHeaders('GET', '/api/v5/dex/cross-chain/supported/bridge-tokens-pairs')
    });
    const data = await okxRes.json();
    console.log('[GET /crosschain/supported-token-pairs] OKX response:', JSON.stringify(data).slice(0, 500));
    if (data && data.data) {
      // Filter for the correct fromChainId/fromTokenAddress
      const pairs = data.data.filter(
        t => String(t.fromChainId) === String(fromChainId) && String(t.fromTokenAddress).toLowerCase() === String(fromTokenAddress).toLowerCase()
      );
      res.json(pairs);
    } else {
      res.status(500).json({ error: 'No data from OKX' });
    }
  } catch (e) {
    console.error('[GET /crosschain/supported-token-pairs] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /crosschain/route - fetch cross-chain route info from OKX
router.get('/route', async (req, res) => {
  const { fromChainId, toChainId, fromTokenAddress, toTokenAddress, amount } = req.query;
  if (!fromChainId || !toChainId || !fromTokenAddress || !toTokenAddress || !amount) {
    return res.status(400).json({ error: 'fromChainId, toChainId, fromTokenAddress, toTokenAddress, and amount required' });
  }
  try {
    const path = `/api/v5/dex/cross-chain/route?fromChainId=${fromChainId}&toChainId=${toChainId}&fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amount}`;
    const url = `https://web3.okx.com${path}`;
    console.log('[GET /crosschain/route] Fetching:', url);
    const okxRes = await fetch(url, { headers: getOkxHeaders('GET', path) });
    const data = await okxRes.json();
    console.log('[GET /crosschain/route] OKX response:', JSON.stringify(data).slice(0, 500));
    res.json(data);
  } catch (e) {
    console.error('[GET /crosschain/route] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Helper function to generate OKX API signature
function generateOkxSignature(timestamp, method, requestPath, body = '') {
  const message = timestamp + method + requestPath + body;
  return CryptoJS.HmacSHA256(message, process.env.OKX_API_SECRET).toString(CryptoJS.enc.Base64);
}

// POST /crosschain/swap - Initiate a cross-chain swap
router.post('/swap', async (req, res) => {
  try {
    const { quote, fromChain, toChain, fromToken, toToken, amount, userWalletAddress, receiveAddress } = req.body;
    
    if (!quote || !fromChain || !toChain || !fromToken || !toToken || !amount || !userWalletAddress) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userWalletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Debug logging
    console.log('Environment variables check:');
    console.log('OKX_API_KEY exists:', !!process.env.OKX_API_KEY);
    console.log('OKX_API_SECRET exists:', !!process.env.OKX_API_SECRET);
    console.log('OKX_API_PASSPHRASE exists:', !!process.env.OKX_API_PASSPHRASE);

    const timestamp = new Date().toISOString();
    const method = 'GET';
    
    // Step 1: Get transaction data using build-tx endpoint
    // Convert amount to minimal units using decimals from the quote
    let amountInMinimalUnits;
    try {
      amountInMinimalUnits = (BigInt(Math.floor(Number(amount) * Math.pow(10, Number(quote.fromToken?.decimals || 18))))).toString();
    } catch {
      amountInMinimalUnits = (Number(amount) * Math.pow(10, Number(quote.fromToken?.decimals || 18))).toFixed(0);
    }

    // Use the provided receiveAddress or fallback to userWalletAddress
    const finalReceiveAddress = receiveAddress || userWalletAddress;
    console.log('Using receive address:', finalReceiveAddress);

    const params = new URLSearchParams({
      fromChainIndex: fromChain,
      toChainIndex: toChain,
      fromTokenAddress: fromToken,
      toTokenAddress: toToken,
      amount: amountInMinimalUnits,
      slippage: quote.slippage || '0.01',
      userWalletAddress: userWalletAddress,
      receiveAddress: finalReceiveAddress,
      sort: 1 // Optimal route after calculating received amount, network fees, slippage, and cross-chain bridge costs
    });

    const requestPath = `/api/v5/dex/cross-chain/build-tx?${params.toString()}`;
    const signature = generateOkxSignature(timestamp, method, requestPath);

    // Debug logging
    console.log('API Request details:');
    console.log('URL:', `https://web3.okx.com${requestPath}`);
    console.log('Method:', method);
    console.log('Timestamp:', timestamp);
    console.log('Signature generated:', !!signature);
    console.log('Request parameters:', params.toString());
    console.log('Amount in minimal units:', amountInMinimalUnits);
    console.log('From chain:', fromChain);
    console.log('To chain:', toChain);
    console.log('User wallet address:', userWalletAddress);
    console.log('Receive address:', finalReceiveAddress);

    // Make request to OKX Web3 API to get transaction data
    const response = await fetch(`https://web3.okx.com${requestPath}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
      },
    });

    // Debug logging
    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      throw new Error(`OKX API error: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    if (!data.data || !data.data[0] || !data.data[0].tx) {
      throw new Error('No transaction data returned from OKX');
    }

    // Return the transaction data to the frontend
    res.json({
      txData: data.data[0].tx,
      bridgeInfo: data.data[0].router,
      fromTokenAmount: data.data[0].fromTokenAmount,
      toTokenAmount: data.data[0].toTokenAmount,
      minimumReceive: data.data[0].minmumReceive
    });
  } catch (error) {
    console.error('Swap error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /crosschain/tx-status - Check transaction status
router.get('/tx-status', async (req, res) => {
  try {
    const { txHash } = req.query;
    
    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash is required' });
    }

    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = `/api/v5/trade/order?ordId=${txHash}`;
    
    const signature = generateOkxSignature(timestamp, method, requestPath);

    // Make request to OKX API
    const response = await fetch(`https://www.okx.com${requestPath}`, {
      method,
      headers: {
        'OK-ACCESS-KEY': process.env.OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OKX API error: ${error}`);
    }

    const data = await response.json();
    
    // Map OKX order status to our status format
    const orderStatus = data.data?.[0]?.state;
    let status;
    
    switch (orderStatus) {
      case 'live':
        status = 'pending';
        break;
      case 'filled':
        status = 'success';
        break;
      case 'canceled':
        status = 'failed';
        break;
      default:
        status = 'unknown';
    }

    res.json({ status });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
