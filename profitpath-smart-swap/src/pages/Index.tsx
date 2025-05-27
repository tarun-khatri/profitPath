import { useAccount } from 'wagmi';
import React, { useState, useEffect } from 'react';
import { WalletConnection } from '../components/WalletConnection';
import { Portfolio } from '../components/Portfolio';
import { SwapAssistant } from '../components/SwapAssistant';
import { SmartRecommendations } from '../components/SmartRecommendations';
import { TransactionHistory } from '../components/TransactionHistory';
import { Navigation } from '../components/Navigation';
import CrossChainSwapAssistant from '../components/CrossChainSwapAssistant';
import { useAppKitAccount } from '@reown/appkit/react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('swap');
  const { isConnected: isEvmConnected } = useAccount();
  const { isConnected: isAppKitConnected } = useAppKitAccount();

  useEffect(() => {
    if (isEvmConnected || isAppKitConnected) {
      setActiveTab('swap');
    }
  }, [isEvmConnected, isAppKitConnected]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-purple-800/30 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ProfitPath
              </h1>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                OKX × Solana
              </span>
            </div>
            <WalletConnection />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!isEvmConnected && !isAppKitConnected ? (
          <div className="text-center py-20">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold text-white mb-6">
                Your AI-Powered Trading Companion
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                Find the most profitable swap routes across chains with intelligent recommendations and real-time liquidity data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="bg-slate-800/50 p-6 rounded-xl border border-purple-800/30">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-purple-400 text-2xl">🔍</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Smart Route Finding</h3>
                  <p className="text-gray-400">AI-powered analysis finds the best swap paths across multiple chains</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-xl border border-purple-800/30">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-green-400 text-2xl">💰</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Maximize Profits</h3>
                  <p className="text-gray-400">Optimize for best price, lowest slippage, and minimal gas fees</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-xl border border-purple-800/30">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-blue-400 text-2xl">⚡</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Cross-Chain Ready</h3>
                  <p className="text-gray-400">Seamlessly swap tokens across Ethereum, Solana, and more</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar */}
            <div className="lg:col-span-1">
              <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
              <div className="mt-6">
                <Portfolio />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {activeTab === 'swap' && <SwapAssistant />}
              {activeTab === 'crosschain' && <CrossChainSwapAssistant />}
              {/* {activeTab === 'history' && <TransactionHistory />} */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
