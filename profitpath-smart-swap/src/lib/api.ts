// Modular API utilities for backend calls

export async function fetchQuoteFromBackend({ fromChain, toChain, fromToken, toToken, amount }: {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}) {
  // POST to backend /quotes endpoint (direct to backend port 4000)
  const res = await fetch('http://localhost:4000/quotes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Failed to fetch quote from backend');
  }
  const data = await res.json();
  if (!data || (!data.quotes && !Array.isArray(data.quotes))) {
    throw new Error('No quote found or invalid response from backend');
  }
  return data;
}

export async function fetchCrossChainQuoteFromBackend({ fromChain, toChain, fromToken, toToken, amount }: {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
}) {
  // POST to backend /crosschain/quote endpoint
  const res = await fetch('http://localhost:4000/crosschain/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromChain,
      toChain,
      fromToken,
      toToken,
      amount,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Failed to fetch cross-chain quote from backend');
  }
  const data = await res.json();
  if (!data || !data.quote) {
    throw new Error('No cross-chain quote found or invalid response from backend');
  }
  return data;
}

export async function fetchSwapFromBackend(params: {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  quote: any;
  userWalletAddress: string;
}) {
  try {
    console.log('Frontend: Calling backend /quotes/swap with params:', params); // Log frontend call params
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/quotes/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    console.log('Frontend: Received response status:', response.status); // Log response status

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Frontend: Backend /quotes/swap response not OK:', errorText); // Log error response text
      throw new Error('Failed to fetch swap data: ' + errorText);
    }

    const data = await response.json();
    console.log('Frontend: Received backend swap data:', data); // Log successful response data
    return data;
  } catch (error) {
    console.error('Frontend: Error fetching swap data:', error); // Log frontend error during fetch
    throw error;
  }
}
