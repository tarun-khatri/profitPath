const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../supabaseClient').supabase;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);



// Helper: Chain index to name mapping (copy from frontend utils if needed)
const CHAIN_INDEX_TO_NAME = {
  '1': 'Ethereum',
  '56': 'BNB Chain',
  '137': 'Polygon',
  '10': 'Optimism',
  '42161': 'Arbitrum',
  '43114': 'Avalanche',
  '324': 'zkSync Era',
  '8453': 'Base',
  '59144': 'Linea',
  '5000': 'Mantle',
  '4200': 'Goerli (Linea Testnet)',
  '81457': 'Blast',
  '169': 'Manta Pacific',
  '534352': 'Scroll',
  '7000': 'ZetaChain',
  '195': 'XVM Chain',
  '501': 'Solana',
  '784': 'Scroll Sepolia',
  '607': 'Polygon zkEVM',
  '100': 'Gnosis',
  '1101': 'Polygon zkEVM',
  // ...add more as needed
};

// Temporary endpoint to list available models
router.get('/list-models', async (req, res) => {
  try {
    const models = await genAI.listModels();
    console.log('Available Gemini Models:', models);
    res.json({ message: 'Available models logged to console.' });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

router.post('/interpret', async (req, res) => {
  try {
    const { message, context, history = [] } = req.body;

    // --- Fetch all unique chains from Supabase (with pagination) ---
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
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        allChains = allChains.concat(data);
        from += batchSize;
        if (data.length < batchSize) keepGoing = false;
      }
    }
    const uniqueChains = [...new Set(allChains.map(t => String(t.chain)))];
    // Build supportedChains with id and name
    const supportedChains = uniqueChains.map(id => ({ id, name: CHAIN_INDEX_TO_NAME[id] || id }));

    // --- Fetch all tokens from Supabase (with pagination) ---
    let allTokens = [];
    from = 0;
    keepGoing = true;
    while (keepGoing) {
      const { data, error } = await supabase
        .from('tokens')
        .select('symbol,name,chain,address,decimals')
        .range(from, from + batchSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        allTokens = allTokens.concat(data);
        from += batchSize;
        if (data.length < batchSize) keepGoing = false;
      }
    }

    // Format chat history for the prompt
    const formattedHistory = history.map(m => `${m.role}: ${m.content}`).join('\n');

    // --- Add supported chains/tokens to the prompt ---
    const prompt = `You are a helpful AI assistant for a crypto swap interface.\n\nSupported chains (use only these, always use the chain name and id):\n${JSON.stringify(supportedChains)}\n\nSupported tokens (use only these, always use the exact symbol, chain, and address):\n${JSON.stringify(allTokens)}\n\nConversation so far:\n${formattedHistory}\n\nCurrent context:\n${JSON.stringify(context, null, 2)}\n\nUser message: ${message}\n\nRules:\n1. Maintain context from previous messages and chat history.\n2. Do NOT repeat confirmations or previously acknowledged information.\n3. Only ask for information that is still missing.\n3a. The only required fields are: fromChain, toChain, fromToken, toToken, and amount (amount to send). Do not ask for the amount to receive.\n3b. If the destination chain (toChain) is Solana (chain id '501'), you must also ask for and include the Solana receive address as 'solanaAddress' in the context.\n4. If the user confirms or repeats something, acknowledge once and move forward.\n5. If all required information is present, set isComplete to true and summarize the swap intent.\n6. Keep responses concise and focused on the swap task.\n7. Never repeat the same confirmation or summary more than once in a row.\n\nRespond in JSON format:\n{\n  \"message\": \"Your response to the user\",\n  \"context\": {\n    \"fromChain\": \"chain id or null\",\n    \"toChain\": \"chain id or null\",\n    \"fromToken\": \"token symbol or null\",\n    \"toToken\": \"token symbol or null\",\n    \"amount\": \"amount or null\",\n    \"solanaAddress\": \"solana address or null\",\n    \"isComplete\": boolean\n  }\n}`;

    console.log('AI PROMPT SENT TO GEMINI:\n', prompt);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('RAW GEMINI RESPONSE:\n', text);
    // Remove markdown code block if present
    const cleaned = text.replace(/^```json|^```|```$/gm, '').trim();
    console.log('CLEANED GEMINI RESPONSE (for JSON.parse):\n', cleaned);
    // Parse the JSON response
    const parsedResponse = JSON.parse(cleaned);
    res.json(parsedResponse);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

module.exports = router;