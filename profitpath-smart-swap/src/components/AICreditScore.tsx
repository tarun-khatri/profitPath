import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AICreditScore: React.FC = () => {
  const [address, setAddress] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [factors, setFactors] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch factors from backend, then send to AI for scoring
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setScore(null);
    setFactors(null);
    setLoading(true);
    try {
      // 1. Get factors from backend (OKX)
      const res = await fetch(`/api/credit-score?address=${address}`);
      if (!res.ok) throw new Error("Failed to fetch credit score factors");
      const data = await res.json();
      setFactors(data.factors);
      // 2. Send factors to AI for scoring
      const aiRes = await fetch("/ai/credit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factors: data.factors }),
      });
      if (!aiRes.ok) throw new Error("AI failed to score address");
      const aiData = await aiRes.json();
      setScore(aiData.score);
    } catch (e: any) {
      setError(e.message || "Error fetching credit score");
    }
    setLoading(false);
  };

  return (
    <Card className="bg-[#1a1333] border border-[#2d225a] shadow-lg rounded-xl p-0 max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-white">AI Credit Score Checker</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            placeholder="Enter wallet address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !address.trim()}>
            {loading ? "Checking..." : "Get AI Credit Score"}
          </Button>
        </form>
        {error && <div className="mt-4 text-red-400">{error}</div>}
        {score !== null && (
          <div className="mt-6 text-center">
            <div className="text-3xl font-bold text-yellow-300 mb-2">AI Score: {score}</div>
            {factors && (
              <div className="text-white text-sm">
                <div>Wallet Age: {factors.walletAgeDays} days</div>
                <div>Tx Frequency: {factors.txFrequency}</div>
                <div>Token Diversity: {factors.tokenDiversity}</div>
                <div>Protocol Interactions: {factors.protocolInteractions}</div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AICreditScore;
