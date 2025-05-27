// backend/okxTokensFetcher.js
// Fetches tokens from OKX API and stores them in Supabase

const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
const { supabase } = require('./supabaseClient');
require('dotenv').config();

const SUPPORTED_CHAIN_INDICES = [
  1, 56, 137, 42161, 43114, 324, 8453, 59144, 5000, 4200, 81457, 169, 534352, 7000, 195, 501, 784, 607
];

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

async function fetchAndStoreOkxTokens() {
  let allTokens = [];
  for (const chainIndex of SUPPORTED_CHAIN_INDICES) {
    const path = `/api/v5/dex/aggregator/all-tokens?chainIndex=${chainIndex}`;
    try {
      const res = await fetch('https://web3.okx.com' + path, {
        headers: getOkxHeaders('GET', path),
      });
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data)) {
        const tokens = data.data.map(t => ({
          symbol: t.tokenSymbol,
          name: t.tokenName,
          chain: chainIndex.toString(),
          address: t.tokenContractAddress,
          decimals: Number(t.decimals),
          logoUrl: t.tokenLogoUrl,
        }));
        allTokens = allTokens.concat(tokens);
        // Upsert tokens into Supabase
        for (const token of tokens) {
          const { error, data: upserted } = await supabase.from('tokens').upsert(token, { onConflict: ['address', 'chain'] });
          if (error) {
            console.error('❌ Error upserting token:', token, error.message);
          } else {
            console.log('✅ Token upserted:', token.symbol, token.address, token.chain);
          }
        }
      } else {
        console.error('❌ No data received from OKX for chain', chainIndex, data);
      }
    } catch (e) {
      console.error('❌ Error fetching tokens for chain', chainIndex, e.message);
    }
    await new Promise(r => setTimeout(r, 1200)); // 1.2s delay for rate limit
  }
  console.log('OKX tokens fetched and stored in Supabase.');
  return allTokens;
}

module.exports = { fetchAndStoreOkxTokens };
