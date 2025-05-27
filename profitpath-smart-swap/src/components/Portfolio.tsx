import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import { useAccount } from 'wagmi';

interface TokenBalance {
  symbol: string;
  balance: string;
  value: string;
  change: string;
  positive: boolean;
}

interface PortfolioData {
  totalValue: string;
  change24h: string;
  tokens: TokenBalance[];
}

export const Portfolio: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!isConnected || !address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch total value
        const totalValueResponse = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/portfolio/total-value?address=${address}`);
        if (totalValueResponse.data.error) {
          throw new Error(totalValueResponse.data.error);
        }
        const totalValue = totalValueResponse.data.data[0].totalValue;

        // Fetch token balances
        const tokenBalancesResponse = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/portfolio/token-balances?address=${address}`);
        if (tokenBalancesResponse.data.error) {
          throw new Error(tokenBalancesResponse.data.error);
        }
        const tokenAssets = tokenBalancesResponse.data.data[0].tokenAssets;

        // Transform token data
        const tokens = tokenAssets.map((token: any) => ({
          symbol: token.symbol,
          balance: parseFloat(token.balance).toLocaleString(),
          value: `$${(parseFloat(token.balance) * parseFloat(token.tokenPrice)).toLocaleString()}`,
          change: '0%', // Note: OKX API doesn't provide 24h change, you might want to calculate this separately
          positive: true
        }));

        setPortfolioData({
          totalValue: `$${parseFloat(totalValue).toLocaleString()}`,
          change24h: '+0%', // Note: You might want to calculate this separately
          tokens
        });
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch portfolio data';
        setError(errorMessage);
        console.error('Error fetching portfolio data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioData();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchPortfolioData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>💼</span>
            <span>Portfolio</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-gray-400">
          Connect your wallet to view your portfolio
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>💼</span>
            <span>Portfolio</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-gray-400">
          Loading portfolio data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>💼</span>
            <span>Portfolio</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-sm text-gray-400">Please check your OKX API configuration</p>
        </CardContent>
      </Card>
    );
  }

  if (!portfolioData) {
    return null;
  }

  return (
    <Card className="bg-slate-800/50 border-purple-800/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <span>💼</span>
          <span>Portfolio</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
          <p className="text-sm text-gray-400">Total Value</p>
          <p className="text-2xl font-bold text-white">{portfolioData.totalValue}</p>
          <p className="text-sm text-green-400">{portfolioData.change24h} (24h)</p>
        </div>
        
        <div className="space-y-3">
          {portfolioData.tokens.map((token) => (
            <div key={token.symbol} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{token.symbol[0]}</span>
                </div>
                <div>
                  <p className="text-white font-medium">{token.symbol}</p>
                  <p className="text-sm text-gray-400">{token.balance}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{token.value}</p>
                <p className={`text-sm ${token.positive ? 'text-green-400' : 'text-red-400'}`}>
                  {token.change}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
