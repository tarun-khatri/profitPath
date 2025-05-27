import { useEffect, useState } from 'react';

export interface OkxToken {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  decimals: number;
  logoUrl?: string;
}

// For backward compatibility
export type Token = OkxToken;

export function useAvailableChains() {
  const [chains, setChains] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:4000/api/tokens/chains')
      .then(res => res.json())
      .then(data => {
        setChains(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { chains, loading, error };
}

export function useTokenList() {
  const [tokens, setTokens] = useState<OkxToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/tokens`)
      .then(res => res.json())
      .then(data => {
        setTokens(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return { tokens, loading, error };
}

export function useOkxTokenListByChain(chain: string | null) {
  const [tokens, setTokens] = useState<OkxToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chain) {
      setTokens([]);
      return;
    }
    setLoading(true);
    fetch(`http://localhost:4000/api/tokens?chain=${chain}`)
      .then(res => res.json())
      .then(data => {
        setTokens(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [chain]);

  return { tokens, loading, error };
}

// For backward compatibility
export const useTokensByChain = useOkxTokenListByChain;
