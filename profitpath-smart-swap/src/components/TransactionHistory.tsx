
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TransactionHistory: React.FC = () => {
  const [filterChain, setFilterChain] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const transactions = [
    {
      id: '0x1234...5678',
      type: 'Swap',
      from: 'SOL',
      to: 'USDT',
      amount: '5.0 SOL',
      received: '987.25 USDT',
      status: 'Completed',
      chain: 'Solana',
      gas: '$0.02',
      time: '2 hours ago',
      hash: '0x1234567890abcdef',
    },
    {
      id: '0x2345...6789',
      type: 'Swap',
      from: 'ETH',
      to: 'USDC',
      amount: '1.2 ETH',
      received: '2,940 USDC',
      status: 'Pending',
      chain: 'Ethereum',
      gas: '$12.45',
      time: '1 hour ago',
      hash: '0x2345678901bcdefg',
    },
    {
      id: '0x3456...7890',
      type: 'Swap',
      from: 'USDT',
      to: 'SOL',
      amount: '500 USDT',
      received: '2.52 SOL',
      status: 'Failed',
      chain: 'Solana',
      gas: '$0.02',
      time: '6 hours ago',
      hash: '0x3456789012cdefgh',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <Card className="bg-slate-800/50 border-purple-800/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <span>📈</span>
            <span>Transaction History</span>
          </CardTitle>
          <Button size="sm" variant="outline" className="border-slate-600 text-white hover:bg-slate-700">
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Chain</label>
            <Select onValueChange={setFilterChain}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All Chains" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">All Chains</SelectItem>
                <SelectItem value="solana" className="text-white hover:bg-slate-600">Solana</SelectItem>
                <SelectItem value="ethereum" className="text-white hover:bg-slate-600">Ethereum</SelectItem>
                <SelectItem value="bsc" className="text-white hover:bg-slate-600">BSC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Status</label>
            <Select onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all" className="text-white hover:bg-slate-600">All Status</SelectItem>
                <SelectItem value="completed" className="text-white hover:bg-slate-600">Completed</SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-slate-600">Pending</SelectItem>
                <SelectItem value="failed" className="text-white hover:bg-slate-600">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transaction List */}
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🔄</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{tx.from} → {tx.to}</p>
                    <p className="text-sm text-gray-400">{tx.time}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(tx.status)}`}>
                  {tx.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Sent</p>
                  <p className="text-white font-medium">{tx.amount}</p>
                </div>
                <div>
                  <p className="text-gray-400">Received</p>
                  <p className="text-white font-medium">{tx.received}</p>
                </div>
                <div>
                  <p className="text-gray-400">Gas Fee</p>
                  <p className="text-white font-medium">{tx.gas}</p>
                </div>
                <div>
                  <p className="text-gray-400">Chain</p>
                  <p className="text-white font-medium">{tx.chain}</p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-600 flex items-center justify-between">
                <p className="text-xs text-gray-400">TX: {tx.hash}</p>
                <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300">
                  View Details →
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center">
          <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-700">
            Load More Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
