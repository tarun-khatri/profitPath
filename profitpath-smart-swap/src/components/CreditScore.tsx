import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import axios from 'axios';
import AICreditScore from './AICreditScore';
import { Input } from '@/components/ui/input';

interface CreditScoreFactors {
  walletAgeDays: number;
  txFrequency: number;
  tokenDiversity: number;
  protocolInteractions: number;
}

interface CreditScoreResult {
  score: number;
  factors: CreditScoreFactors;
  explanation?: string; // Add explanation from AI
}

const CreditScorePage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [manualAddress, setManualAddress] = useState<string>('');
  const [scoreData, setScoreData] = useState<CreditScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress) return;
    setLoading(true);
    setError(null);
    setScoreData(null);
    try {
      // 1. Fetch factors from OKX API (your backend)
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/credit-score?address=${manualAddress}`
      );
      const factors = res.data.factors;
      // 2. Send factors to Gemini AI for scoring
      const aiRes = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/ai/credit-score`,
        { factors }
      );
      setScoreData({ score: aiRes.data.score, factors, explanation: aiRes.data.explanation });
    } catch (e: any) {
      setError(e.message || 'Failed to fetch credit score');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-purple-800/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <span>🏦</span>
          <span>Credit Score</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleAddressSubmit}
          className="mb-4 flex flex-col items-center gap-2"
        >
          <Input
            className="w-full max-w-xs"
            placeholder="Enter wallet address"
            value={manualAddress}
            onChange={e => setManualAddress(e.target.value)}
          />
          <button
            type="submit"
            className="mt-2 px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 transition"
            disabled={loading || !manualAddress}
          >
            {loading ? 'Checking...' : 'Check Credit Score'}
          </button>
        </form>
        {error && (
          <div className="text-center text-red-400 mb-2">{error}</div>
        )}
        {scoreData && (
          <>
            <div className="text-center mb-4">
              <span className="text-5xl font-bold text-green-400">
                {scoreData.score}
              </span>
              <div className="text-gray-400 mt-2">Score (300-900)</div>
              {scoreData.explanation && (
                <div className="text-xs text-gray-400 mt-1 italic">{scoreData.explanation}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-300">
                <span>Wallet Age (days)</span>
                <span>{scoreData.factors.walletAgeDays}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Transaction Frequency</span>
                <span>{scoreData.factors.txFrequency}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Token Diversity</span>
                <span>{scoreData.factors.tokenDiversity}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Protocol Interactions</span>
                <span>{scoreData.factors.protocolInteractions}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditScorePage;
