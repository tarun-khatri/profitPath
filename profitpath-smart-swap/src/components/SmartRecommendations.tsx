
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const SmartRecommendations: React.FC = () => {
  const recommendations = [
    {
      type: 'profitable',
      title: 'Swap SOL → USDT',
      reason: 'Low gas + High liquidity',
      potential: '+2.3% vs other routes',
      urgency: 'Recommended',
      color: 'border-green-500 bg-green-500/10',
      action: 'Swap Now',
    },
    {
      type: 'warning',
      title: 'Avoid ETH → BTC',
      reason: 'High slippage detected',
      potential: 'Save ~$45 in fees',
      urgency: 'Wait 2-4h',
      color: 'border-yellow-500 bg-yellow-500/10',
      action: 'Set Alert',
    },
    {
      type: 'opportunity',
      title: 'USDT → SOL',
      reason: 'Price dip opportunity',
      potential: 'Enter at good price',
      urgency: 'Limited time',
      color: 'border-blue-500 bg-blue-500/10',
      action: 'View Route',
    },
  ];

  const insights = [
    { metric: 'Gas Tracker', value: 'Low', color: 'text-green-400', icon: '⛽' },
    { metric: 'Market Sentiment', value: 'Bullish', color: 'text-green-400', icon: '📈' },
    { metric: 'Liquidity', value: 'High', color: 'text-blue-400', icon: '💧' },
    { metric: 'Volatility', value: 'Medium', color: 'text-yellow-400', icon: '📊' },
  ];

  return (
    <div className="space-y-6">
      {/* Smart Recommendations */}
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>🧠</span>
            <span>AI Recommendations</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.map((rec, index) => (
            <div key={index} className={`p-4 rounded-lg border ${rec.color}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-white font-medium">{rec.title}</h4>
                  <p className="text-sm text-gray-400">{rec.reason}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  rec.type === 'profitable' ? 'bg-green-500/20 text-green-400' :
                  rec.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {rec.urgency}
                </span>
              </div>
              <p className="text-sm text-white mb-3">{rec.potential}</p>
              <Button 
                size="sm" 
                className={`w-full ${
                  rec.type === 'profitable' ? 'bg-green-500 hover:bg-green-600' :
                  rec.type === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                  'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {rec.action}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Market Insights */}
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>📊</span>
            <span>Market Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{insight.icon}</span>
                <span className="text-gray-300 text-sm">{insight.metric}</span>
              </div>
              <span className={`font-medium ${insight.color}`}>{insight.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-slate-800/50 border-purple-800/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <span>⚡</span>
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
            Set Price Alerts
          </Button>
          <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-700">
            Portfolio Analysis
          </Button>
          <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-700">
            Export History
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
