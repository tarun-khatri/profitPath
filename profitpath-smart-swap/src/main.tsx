import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
import { arbitrum, mainnet, solana } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import App from './App';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from https://cloud.reown.com
const projectId = 'e7ffffee141246fff06a5c030a6c924f';

// 2. Create a metadata object - optional
const metadata = {
  name: 'ProfitPath',
  description: 'Cross-chain AI-powered swap assistant',
  url: 'https://yourdomain.com', // origin must match your domain & subdomain
  icons: ['https://yourdomain.com/icon.png'],
};

// 3. Set the networks
const networks = [mainnet, arbitrum, solana];

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
});

// 4b. Create Solana Adapter
const solanaAdapter = new SolanaAdapter();

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  },
});

export function AppKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </React.StrictMode>
);
