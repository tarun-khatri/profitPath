import { useEffect, useState } from 'react';

export interface OkxToken {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  decimals: number;
  logoUrl?: string;
}

export function useOkxTokenList() {
  const [tokens, setTokens] = useState<OkxToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/tokens')
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
