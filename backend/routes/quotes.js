const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
const supabase = require('../supabaseClient').supabase;
require('dotenv').config();

function getOkxHeaders(method, path, body = '') {
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

// Modular OKX quote fetcher
async function fetchOkxQuote({ fromChain, toChain, fromToken, toToken, amount }) {
  console.log('[fetchOkxQuote] params:', { fromChain, toChain, fromToken, toToken, amount });
  if (!fromChain || !toChain || !fromToken || !toToken) {
    throw new Error('Please provide fromChain, toChain, fromToken, toToken.');
  }
  if (fromChain !== toChain) {
    throw new Error('Cross-chain quotes are not supported by OKX at this time.');
  }
  const [fromTokenAddress] = fromToken.split('-');
  const [toTokenAddress] = toToken.split('-');

  // --- Lookup decimals for fromToken from Supabase, then fallback to OKX response, then fallback to 18 ---
  let decimals = null;
  try {
    const { data: tokenData, error } = await supabase
      .from('tokens')
      .select('decimals')
      .eq('address', fromTokenAddress)
      .eq('chain', fromChain)
      .limit(1)
      .single();
    if (tokenData && typeof tokenData.decimals === 'number') {
      decimals = tokenData.decimals;
    }
  } catch (e) {
    console.warn('Could not fetch decimals for token', fromTokenAddress, 'on chain', fromChain, e.message);
  }

  // If not found in Supabase, try to get decimals from OKX token list in the quote response (after fetch)
  let amountIn = '1';
  if (amount && Number(amount) > 0) {
    if (decimals === null) {
      // Try to get decimals from OKX token list by fetching all tokens for this chain
      try {
        const okxTokenRes = await fetch(`https://www.okx.com/api/v5/dex/aggregator/all-tokens?chainIndex=${fromChain}`);
        const okxTokenData = await okxTokenRes.json();
        if (okxTokenData && Array.isArray(okxTokenData.data)) {
          const found = okxTokenData.data.find(t => t.tokenContractAddress.toLowerCase() === fromTokenAddress.toLowerCase());
          if (found && found.decimals) {
            decimals = Number(found.decimals);
          }
        }
      } catch (e) {
        console.warn('Could not fetch decimals from OKX token list', e.message);
      }
    }
    if (decimals === null) decimals = 18; // Only fallback to 18 if all else fails
    try {
      amountIn = (BigInt(Math.floor(Number(amount) * Math.pow(10, decimals)))).toString();
    } catch {
      amountIn = (Number(amount) * Math.pow(10, decimals)).toFixed(0);
    }
  }

  const path = `/api/v5/dex/aggregator/quote?chainId=${fromChain}&fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${amountIn}`;
  const url = `https://www.okx.com${path}`;
  console.log('[fetchOkxQuote] Fetching URL:', url);
  const response = await fetch(url, {
    headers: getOkxHeaders('GET', path),
  });
  const data = await response.json();
  console.log('[fetchOkxQuote] OKX raw response data:', data); // Log raw response data

  if (data && Array.isArray(data.data) && data.data.length > 0) {
    // Return all quotes in quoteCompareList if present, else just the main quote
    const mainQuote = data.data[0];
    console.log('[fetchOkxQuote] Main quote:', mainQuote); // Log main quote

    // Determine the router contract address
    let routerContractAddress = undefined;
    if (mainQuote.dexRouterList && Array.isArray(mainQuote.dexRouterList) && mainQuote.dexRouterList.length > 0) {
      const firstRouterEntry = mainQuote.dexRouterList[0];
      if (firstRouterEntry.router) {
        // Extract the first address from the router string
        routerContractAddress = firstRouterEntry.router.split('--')[0];
      }
    }
    console.log('[fetchOkxQuote] Determined routerContractAddress:', routerContractAddress); // Log determined router address

    let quotes = [];
    if (Array.isArray(mainQuote.quoteCompareList) && mainQuote.quoteCompareList.length > 0) {
      console.log('[fetchOkxQuote] Using quoteCompareList:', mainQuote.quoteCompareList); // Log quoteCompareList
      quotes = mainQuote.quoteCompareList.map(route => {
        console.log('[fetchOkxQuote] Processing route:', route); // Log each route
        // Merge mainQuote fields with route-specific fields
        return {
          ...mainQuote,
          ...route,
          minAmountOut: route.minAmountOut,
          path: route.path,
          routerName: route.routerName,
          // Use the determined routerContractAddress
          dexContractAddress: routerContractAddress,
          amountOut: route.minAmountOut || mainQuote.toTokenAmount,
          amountIn: mainQuote.fromTokenAmount,
        };
      });
    } else {
      console.log('[fetchOkxQuote] Using main quote only.'); // Log if using main quote only
      quotes = [{
        ...mainQuote,
        // Use the determined routerContractAddress
        dexContractAddress: routerContractAddress,
        amountOut: mainQuote.toTokenAmount,
        amountIn: mainQuote.fromTokenAmount,
      }];
    }
    console.log('[fetchOkxQuote] Final quotes array:', quotes); // Log the final quotes array
    return quotes.length > 0 ? quotes : null;
  } else {
    // If OKX returned an error, forward the error message for better UX
    if (data && data.msg) {
      throw new Error(data.msg);
    }
    throw new Error('No quote found or invalid response from OKX.');
  }
}

// POST /quotes - fetch a quote from OKX DEX API (same-chain only)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    console.log('[POST /quotes] body:', body);
    const quotes = await fetchOkxQuote(body);
    // Always return an array of quotes for frontend
    res.json({ quotes });
  } catch (e) {
    console.error('[POST /quotes] error:', e);
    res.status(400).json({ error: e.message || 'Failed to fetch quote.' });
  }
});

// Helper to fetch OKX swap data
async function fetchOkxSwap(fromChain, toChain, fromToken, toToken, amountIn, quote, userWalletAddress) {
  console.log('fetchOkxSwap called with:', { fromChain, toChain, fromToken, toToken, amountIn, quote, userWalletAddress }); // Log input parameters
  const slippage = 0.5; // Hardcoded slippage for now

  const isEvm = ['1', '66', '42161', '137', '10', '56', '43114'].includes(fromChain); // Example EVM chain indices
  const path = isEvm
    ? `/api/v5/dex/aggregator/swap?chainIndex=${fromChain}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amountIn}&slippage=${slippage}&userWalletAddress=${userWalletAddress}`
    : `/api/v5/dex/aggregator/swap-instruction?chainIndex=${fromChain}&fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amountIn}&slippage=${slippage}&userWalletAddress=${userWalletAddress}`;
  
  const url = `https://web3.okx.com${path}`;
  console.log('Fetching OKX swap API URL:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getOkxHeaders('GET', path)
    });

    const data = await response.json();
    console.log('OKX swap API response:', data);

    if (!response.ok) {
      console.error('OKX swap API error:', data);
      throw new Error(data.message || 'Failed to fetch OKX swap data');
    }

    return data.data;
  } catch (error) {
    console.error('Error in fetchOkxSwap:', error);
    throw error;
  }
}

// Swap endpoint
router.post('/swap', async (req, res) => {
  console.log('POST /quotes/swap received:', req.body); // Log incoming request body
  const { fromChain, toChain, fromToken, toToken, amount, quote, userWalletAddress } = req.body;

  if (!fromChain || !toChain || !fromToken || !toToken || !amount || !quote || !userWalletAddress) {
    console.error('Missing parameters for /quotes/swap'); // Log missing params
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    console.log('Attempting to fetch OKX swap data...'); // Added log before fetchOkxSwap
    const swapData = await fetchOkxSwap(fromChain, toChain, fromToken, toToken, amount, quote, userWalletAddress);
    console.log('Successfully fetched swapData:', swapData); // Log successful data fetch
    res.json({ swapData });
  } catch (error) {
    console.error('Error handling /quotes/swap:', error); // Log error handling the request
    res.status(500).json({ error: error.message || 'Failed to perform swap' });
  }
});

// Helper to fetch OKX approval data
async function fetchOkxApprovalData(chainIndex, tokenContractAddress, approveAmount) {
  console.log('fetchOkxApprovalData called with:', { chainIndex, tokenContractAddress, approveAmount }); // Log input parameters
  const path = `/api/v5/dex/aggregator/approve-transaction?chainIndex=${chainIndex}&tokenContractAddress=${tokenContractAddress}&approveAmount=${approveAmount}`;
  const url = `https://web3.okx.com${path}`;

  console.log('Fetching OKX approve API URL:', url); // Log the request URL

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getOkxHeaders('GET', path)
    });

    const data = await response.json();
    console.log('OKX approve API response:', data); // Log the response from OKX

    if (!response.ok) {
      console.error('OKX approve API error:', data); // Log error details
      throw new Error(data.message || 'Failed to fetch OKX approval data');
    }

    // OKX approval API returns tx data directly in data field
    return data.data; 
  } catch (error) {
    console.error('Error in fetchOkxApprovalData:', error); // Log any errors during the fetch
    throw error; // Re-throw to be caught by the route handler
  }
}

// Add approve endpoint
router.post('/approve', async (req, res) => {
  console.log('POST /quotes/approve received:', req.body); // Log incoming request body
  const { chainIndex, tokenContractAddress, approveAmount } = req.body;

  if (!chainIndex || !tokenContractAddress || approveAmount === undefined) { // approveAmount can be '0' or a number
    console.error('Missing parameters for /quotes/approve'); // Log missing params
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const approvalData = await fetchOkxApprovalData(chainIndex, tokenContractAddress, approveAmount);
    console.log('Successfully fetched approvalData:', approvalData); // Log successful data fetch
     // Return approval data in a structure expected by the frontend
    res.json({ approveData: approvalData });
  } catch (error) {
    console.error('Error handling /quotes/approve:', error); // Log error handling the request
    res.status(500).json({ error: error.message || 'Failed to get approval data' });
  }
});

// Function to fetch transaction status from OKX
async function fetchTransactionStatus(chainIndex, txHash) {
  try {
    const response = await fetch(
      `https://web3.okx.com/api/v5/dex/aggregator/history?chainIndex=${chainIndex}&txHash=${txHash}`,
      {
        method: 'GET',
        headers: getOkxHeaders('GET', '/api/v5/dex/aggregator/history')
      }
    );

    const data = await response.json();
    if (data.code === "0" && data.data) {
      return {
        status: data.data.status,
        txHash: data.data.txHash,
        fromTokenDetails: data.data.fromTokenDetails,
        toTokenDetails: data.data.toTokenDetails,
        txTime: data.data.txTime,
        errorMsg: data.data.errorMsg
      };
    }
    throw new Error('Failed to get transaction status from OKX');
  } catch (error) {
    console.error('Error fetching transaction status:', error);
    throw error;
  }
}

// Add transaction status endpoint
router.get('/transaction-status', async (req, res) => {
  try {
    const { chainIndex, txHash } = req.query;

    if (!chainIndex || !txHash) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const status = await fetchTransactionStatus(chainIndex, txHash);
    res.json(status);
  } catch (error) {
    console.error('Error in transaction status endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, fetchOkxQuote };
