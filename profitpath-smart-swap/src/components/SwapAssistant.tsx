import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Removed old Select dropdown imports; using modal-based chain selector now.
import { useAvailableChains, useTokensByChain } from '../hooks/useChainAndTokenList';
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "./ui/dialog";
import { CHAIN_INDEX_TO_NAME } from "../lib/utils";
import { fetchQuoteFromBackend, fetchSwapFromBackend } from '../lib/api';
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { useAccount } from 'wagmi';
import { useToast } from './ui/use-toast';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import type { Provider as SolanaProvider } from "@reown/appkit-adapter-solana";
import { VersionedTransaction, TransactionInstruction, PublicKey, VersionedMessage, AddressLookupTableAccount, TransactionMessage, SystemProgram } from '@solana/web3.js';
import AISwapChat from './AISwapChat';

declare global {
  interface Window {
    reown?: {
      address?: string;
      sendTransaction?: (params: {
        instructions: any[];
        signers: any[];
        feePayer: string;
      }) => Promise<string>;
    };
  }
}

export const SwapAssistant: React.FC = () => {
  // Chain selection for both sides
  const [fromChain, setFromChain] = useState<string | null>(null);
  const [toChain, setToChain] = useState<string | null>(null);
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [showRoutes, setShowRoutes] = useState(false);
  const [search, setSearch] = useState('');
  const [walletConnected, setWalletConnected] = useState(true); // Simulate wallet connection
  const [payChainModalOpen, setPayChainModalOpen] = useState(false);
  const [receiveChainModalOpen, setReceiveChainModalOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedQuoteIdx, setSelectedQuoteIdx] = useState(0);
  const [openFromToken, setOpenFromToken] = useState(false);
  const [openToToken, setOpenToToken] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const [isAIMode, setIsAIMode] = useState(false);

  const { chains: availableChains, loading: chainsLoading } = useAvailableChains();
  const { tokens: fromTokens, loading: fromTokensLoading, error: fromTokensError } = useTokensByChain(fromChain);
  const { tokens: toTokens, loading: toTokensLoading, error: toTokensError } = useTokensByChain(toChain);

  // Deduplicate and filter availableChains for modal, only show name (no icon)
  const uniqueChains = Array.from(new Set(availableChains.map(String)))
    .filter(chain => CHAIN_INDEX_TO_NAME[chain]);

  // Get wallet address from WalletConnect
  const { address: evmAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isConnected: isAppKitConnected, address: appKitAddress } = useAppKitAccount();
  const { walletProvider: solanaWalletProvider } = useAppKitProvider<SolanaProvider>("solana");
  const { connection: solanaConnection } = useAppKitConnection();
  const { toast } = useToast(); // Initialize useToast hook

  // Function to check transaction status
  const checkTransactionStatus = async (hash: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/quotes/transaction-status?chainIndex=${fromChain}&txHash=${hash}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setTxStatus('success');
      } else if (data.status === 'fail') {
        setTxStatus('failed');
      } else {
        // If still pending, check again after 5 seconds
        setTimeout(() => checkTransactionStatus(hash), 5000);
      }
    } catch (error) {
      console.error('Error checking transaction status:', error);
      setTxStatus('failed');
    }
  };

  // const routes = [
  //   {
  //     id: 1,
  //     route: 'SOL → USDT',
  //     path: 'Solana → Jupiter',
  //     rate: '1 SOL = 198.45 USDT',
  //     slippage: '0.1%',
  //     gas: '$0.02',
  //     time: '~15s',
  //     rating: 'Best Price',
  //     color: 'border-green-500 bg-green-500/10',
  //   },
  //   {
  //     id: 2,
  //     route: 'SOL → USDT',
  //     path: 'Solana → Orca',
  //     rate: '1 SOL = 197.89 USDT',
  //     slippage: '0.2%',
  //     gas: '$0.02',
  //     time: '~20s',
  //     rating: 'Low Slippage',
  //     color: 'border-blue-500 bg-blue-500/10',
  //   },
  //   {
  //     id: 3,
  //     route: 'SOL → USDT',
  //     path: 'Solana → Raydium',
  //     rate: '1 SOL = 196.23 USDT',
  //     slippage: '0.5%',
  //     gas: '$0.03',
  //     time: '~12s',
  //     rating: 'Fastest',
  //     color: 'border-purple-500 bg-purple-500/10',
  //   },
  // ];

  const handleQuote = () => {
    setShowRoutes(true);
    console.log('Fetching routes from OKX DEX Aggregator API...');
  };

  async function handleGetQuote() {
    setQuote(null);
    setQuoteError(null);
    setSelectedQuoteIdx(0);
    if (!fromChain || !toChain || !fromToken || !toToken) {
      setQuoteError("Please select both chains and tokens.");
      return;
    }
    if (fromChain !== toChain) {
      setQuoteError("Cross-chain quotes are not supported by OKX at this time.");
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetchQuoteFromBackend({
        fromChain,
        toChain,
        fromToken,
        toToken,
        amount: amount && Number(amount) > 0 ? amount : "1",
      });
      if (res && Array.isArray(res.quotes) && res.quotes.length > 0) {
        setQuote(res.quotes);
      } else {
        setQuoteError("No quotes found.");
      }
    } catch (e: any) {
      setQuoteError(e.message || "Failed to fetch quote.");
    }
    setQuoteLoading(false);
  }

  async function handleSwap() {
    // Check if quote exists and selectedQuoteIdx is valid
    if (!quote || selectedQuoteIdx === null || selectedQuoteIdx === undefined || !quote[selectedQuoteIdx]) return;
    
    setSwapLoading(true);
    setSwapError(null);
    setTxStatus(null);
    setTxHash(null);
    
    try {
      const selectedQuote = quote[selectedQuoteIdx];
      
      if (fromChain === '501') { // Solana flow
        if (!isAppKitConnected || !appKitAddress || !solanaWalletProvider || !solanaWalletProvider.sendTransaction || !solanaConnection) {
          toast({ title: 'Solana wallet not connected or provider not ready', description: 'Please ensure your Solana wallet is connected.', variant: 'destructive' });
          setSwapLoading(false);
          return;
        }

        try {
          // Get Solana swap instructions and lookup tables from OKX API
          const swapRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/quotes/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromChain,
              toChain,
              fromToken,
              toToken,
              amount: selectedQuote.amountIn,
              quote: selectedQuote,
              userWalletAddress: appKitAddress,
            })
          });

          const swapData = await swapRes.json();
          // Check for instructionLists and addressLookupTableAccount
          if (!swapData || !swapData.swapData || !Array.isArray(swapData.swapData.instructionLists) || !Array.isArray(swapData.swapData.addressLookupTableAccount)) {
            throw new Error('Invalid swap data received from backend. Missing instructionLists or addressLookupTableAccount.');
          }

          // Fetch recent blockhash
          const { blockhash } = await solanaConnection.getLatestBlockhash();

          // Convert raw instructions to TransactionInstruction objects
          const instructions = swapData.swapData.instructionLists.map((ix: any) => new TransactionInstruction({
              keys: ix.accounts.map((key: any) => ({
                  pubkey: new PublicKey(key.pubkey),
                  isSigner: key.isSigner,
                  isWritable: key.isWritable,
              })),
              programId: new PublicKey(ix.programId),
              data: Buffer.from(ix.data, 'base64'), // Assuming data is base64 encoded
          }));

          // Get Address Lookup Table accounts
          const addressLookupTableAccounts = await Promise.all(
            swapData.swapData.addressLookupTableAccount.map(async (accountKey: string) => {
                const accountPubkey = new PublicKey(accountKey);
                const account = await solanaConnection.getAddressLookupTable(accountPubkey);
                if (!account || !account.value) throw new Error(`Failed to fetch Address Lookup Table account: ${accountKey}`);
                return account.value;
            })
          );

          // Create and compile the TransactionMessage to a V0 message
          const messageV0 = new TransactionMessage({
              payerKey: new PublicKey(appKitAddress),
              recentBlockhash: blockhash,
              instructions: instructions,
          }).compileToV0Message(addressLookupTableAccounts);

          // Create VersionedTransaction
          const transaction = new VersionedTransaction(messageV0);

          // You might need to add backend provided signers here if any
          // For example: transaction.sign(backendSigners);

          // Send the constructed transaction using the solanaWalletProvider
          const txHash = await solanaWalletProvider.sendTransaction(transaction, solanaConnection);

          setTxHash(txHash);
          setTxStatus('pending');
          toast({ title: 'Transaction sent', description: `Tx hash: ${txHash}` });
          checkTransactionStatus(txHash);
        } catch (e: any) {
          console.error('Frontend: Error in Solana handleSwap:', e); // Log frontend error in handleSwap
          setSwapError(e.message || 'Solana swap failed');
          toast({ title: 'Swap failed', description: e.message, variant: 'destructive' });
        }
        setSwapLoading(false);
        return;
      } else { // EVM flow
        if (!walletClient) { // Check for walletClient for signing
          toast({ title: 'EVM wallet not found', description: 'Please connect your EVM wallet', variant: 'destructive' });
          setSwapLoading(false);
          return;
        }
        
        console.log('Frontend: Setting up ethers provider and signer...'); // Log before provider/signer setup
        // 1. Check allowance
        // Use ethers v5 syntax
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        console.log('Frontend: Provider and signer setup complete.'); // Log after provider/signer setup
        
        // Find the fromToken details to get decimals (still needed for amount formatting if backend doesn't provide precise amountIn)
        const fromTokenDetails = fromTokens.find(token => token.address === fromToken);
        if (!fromTokenDetails) {
             toast({ title: 'Error', description: 'Could not find source token details', variant: 'destructive' });
             setSwapLoading(false);
             return;
        }

        console.log('Frontend: Setting up ERC20 contract...'); // Log before contract setup
        const erc20 = new ethers.Contract(fromToken, [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)'
        ], signer);
        console.log('Frontend: ERC20 contract setup complete.'); // Log after contract setup
        
        const okxRouter = selectedQuote.dexContractAddress;
        console.log('Frontend: Checking allowance for router:', okxRouter); // Log before allowance check
        // Use ethers.BigNumber for amount comparison with v5
        // Use amountIn from the selected quote, which should be in smallest units
        const amountInBigNumber = ethers.BigNumber.from(selectedQuote.amountIn);
        
        // Allowance in ethers v5 is BigNumber
        const currentAllowance = await erc20.allowance(evmAddress, okxRouter);
        console.log('Frontend: Allowance check complete, allowance:', currentAllowance.toString()); // Log after allowance check
        
        // Compare allowance as BigNumber
        if (currentAllowance.lt(amountInBigNumber)) {
          // 2. Approve if needed
          toast({ title: 'Approval required', description: 'Sending approval transaction...' });
          
          console.log('Frontend: Fetching approval data...'); // Log before fetching approve data
          // Get approve data from OKX API (assuming your backend provides this via /quotes/approve)
          const approveRes = await fetch(`http://localhost:4000/quotes/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chainIndex: fromChain,
              tokenContractAddress: fromToken,
              approveAmount: selectedQuote.amountIn, // Use amountIn from quote for approval
            })
          });
          const approveData = await approveRes.json();
          console.log('Frontend: Approval data fetched:', approveData); // Log approval data
          
          if (!approveData || !approveData.approveData || !approveData.approveData[0]) throw new Error('No approve data');
          
          console.log('Frontend: Sending approval transaction...'); // Log before sending approval tx
          const txApprove = await signer.sendTransaction({
            to: approveData.approveData[0].dexContractAddress,
            data: approveData.approveData[0].data,
            gasLimit: ethers.BigNumber.from(approveData.approveData[0].gasLimit),
            gasPrice: ethers.BigNumber.from(approveData.approveData[0].gasPrice)
          });
          console.log('Frontend: Approval transaction sent, hash:', txApprove.hash); // Log approval tx hash
          
          // Wait for the approval transaction to be mined
          console.log('Frontend: Waiting for approval transaction to be mined...'); // Log before waiting for approval
          await txApprove.wait();
          console.log('Frontend: Approval transaction mined.'); // Log after approval mined
          toast({ title: 'Approval confirmed', description: 'Token approved for swap' });
        }
        
        // 3. Send swap transaction
        toast({ title: 'Sending swap transaction...' });
        
        console.log('Frontend: Calling fetchSwapFromBackend...'); // Log before calling fetchSwapFromBackend
        // Fetch swap data from backend (already implemented)
        const res = await fetchSwapFromBackend({
          fromChain,
          toChain,
          fromToken,
          toToken,
          amount: selectedQuote.amountIn, // Pass the precise amountIn from the quote to the backend
          quote: selectedQuote,
          userWalletAddress: evmAddress, // Use the address from useAccount()
        });
        console.log('Frontend: fetchSwapFromBackend returned:', res); // Log after fetchSwapFromBackend returns

        if (!res || !res.swapData) throw new Error('No swap data for EVM');

        console.log('Frontend: Preparing to send transaction with swapData:', res.swapData); // Log swapData before sending transaction
        // Send the swap transaction using the wallet signer
        const txSwap = await signer.sendTransaction({
          to: res.swapData.to, // This is likely the source of the error
          data: res.swapData.data,
          // Use ethers.BigNumber for value with v5
          value: res.swapData.value ? ethers.BigNumber.from(res.swapData.value) : undefined,
          // gasLimit: res.swapData.gasLimit, // gasLimit and gasPrice might be optional or handled by wallet
          // gasPrice: res.swapData.gasPrice
        });
        
        setTxHash(txSwap.hash);
        setTxStatus('pending');
        toast({ title: 'Transaction sent', description: `Tx hash: ${txSwap.hash}` });
        checkTransactionStatus(txSwap.hash);
      }
    } catch (e: any) {
      console.error('Frontend: Error in handleSwap:', e); // Log frontend error in handleSwap
      setSwapError(e.message || 'Swap failed');
      toast({ title: 'Swap failed', description: e.message, variant: 'destructive' });
    }
    setSwapLoading(false);
  }

  // Utility to format token amounts using decimals
  function formatTokenAmount(amount: string | number | undefined, decimals: number | undefined) {
    if (!amount || !decimals) return '-';
    try {
      return (Number(amount) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 8 });
    } catch {
      return amount;
    }
  }

  return (
    <Card className="bg-[#1a1333] border border-[#2d225a] shadow-lg rounded-xl p-0">
      <CardContent className="space-y-6 px-6 py-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">
              AI Swap Assistant
            </h3>
            <button
              onClick={() => setIsAIMode(!isAIMode)}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
            >
              {isAIMode ? 'Manual Mode' : 'AI Mode'}
            </button>
          </div>
          
          {isAIMode && (
            <AISwapChat
              onSwapInterpretation={(interpretation) => {
                console.log('AI Interpretation received:', interpretation);
                
                // Always attempt to set values if AI provides them, even if null (resets the field)
                setFromChain(interpretation.fromChain || null);
                setToChain(interpretation.toChain || null);
                setFromToken(interpretation.fromToken || '');
                setToToken(interpretation.toToken || '');
                setAmount(interpretation.amount || '');
                
                console.log('State updates triggered with values:', {
                  fromChain: interpretation.fromChain,
                  toChain: interpretation.toChain,
                  fromToken: interpretation.fromToken,
                  toToken: interpretation.toToken,
                  amount: interpretation.amount
                });
                
                // Only attempt to get a quote if *essential* fields are present for single-chain
                // Need fromChain, toChain, fromToken, toToken, amount
                if (interpretation.fromChain && interpretation.toChain && 
                    interpretation.fromToken && interpretation.toToken && 
                    interpretation.amount) {
                  console.log('All required fields present, triggering quote fetch...');
                  // Delay slightly to allow state updates to propagate
                  setTimeout(() => {
                    console.log('Executing quote fetch with current state:', {
                      fromChain,
                      toChain,
                      fromToken,
                      toToken,
                      amount
                    });
                    handleGetQuote();
                  }, 100); // Increased delay to ensure state updates
                } else {
                  console.log('Missing required fields for quote:', {
                    fromChain: interpretation.fromChain,
                    toChain: interpretation.toChain,
                    fromToken: interpretation.fromToken,
                    toToken: interpretation.toToken,
                    amount: interpretation.amount
                  });
                }
              }}
              isCrossChain={false}
              availableChains={availableChains}
              fromTokens={fromTokens}
              toTokens={toTokens}
              currentFromChain={fromChain}
              currentToChain={toChain}
            />
          )}
        </div>
        {/* You Pay Section */}
        <div className="bg-[#18122b] rounded-lg p-4 border border-[#2d225a] mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 text-sm font-medium">You pay</span>
            <span className="text-xs text-gray-400">Balance: 0 ETH</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Dialog open={payChainModalOpen} onOpenChange={setPayChainModalOpen}>
              <DialogTrigger asChild>
                <button
                  className="flex items-center gap-2 bg-[#232046] border border-[#2d225a] text-white rounded-lg px-3 py-2 min-w-[140px] hover:bg-[#2d225a] transition"
                  onClick={() => setPayChainModalOpen(true)}
                >
                  {fromChain ? (
                    <span>{CHAIN_INDEX_TO_NAME[fromChain] || fromChain}</span>
                  ) : (
                    <span className="text-gray-400">Select chain</span>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#18122b] border border-[#2d225a] max-w-md rounded-xl">
                <DialogTitle className="text-lg font-semibold text-white mb-2">Select a chain you pay</DialogTitle>
                <DialogDescription className="text-gray-400 mb-4">Choose the network you want to pay from.</DialogDescription>
                <div className="grid grid-cols-3 gap-3">
                  {uniqueChains.map(chain => (
                    <button
                      key={chain}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent hover:border-purple-500 hover:bg-[#232046] transition",
                        fromChain === chain ? "border-purple-500 bg-[#232046]" : ""
                      )}
                      onClick={() => {
                        setFromChain(chain);
                        setToChain(chain);
                        setFromToken("");
                        setFromSearch("");
                        setPayChainModalOpen(false);
                      }}
                    >
                      <span className="text-xs text-white font-medium">{CHAIN_INDEX_TO_NAME[chain] || chain}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Popover open={openFromToken} onOpenChange={setOpenFromToken}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openFromToken}
                  className="w-full justify-between bg-[#232046] text-white border-[#2d225a] hover:bg-[#2d225a]"
                  disabled={!fromChain || fromTokensLoading || !!fromTokensError}
                >
                  {fromToken ? fromTokens.find(t => t.address === fromToken)?.symbol || fromToken : "Select token..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[#232046] border-[#2d225a] max-h-[300px] overflow-y-auto">
                <Command className="bg-[#232046]">
                  <CommandInput placeholder="Search token..." className="text-white border-b border-[#2d225a]/50" />
                  <CommandEmpty className="py-2 text-gray-400">No token found.</CommandEmpty>
                  <CommandGroup className="max-h-[250px] overflow-y-auto">
                    {fromTokens.map((token) => (
                      <CommandItem
                        key={token.address}
                        value={token.symbol}
                        onSelect={(currentValue) => {
                          const selectedToken = fromTokens.find(t => t.symbol === currentValue);
                          setFromToken(selectedToken?.address || '');
                          setOpenFromToken(false);
                        }}
                        className="text-white hover:bg-[#2d225a] cursor-pointer px-2 py-1.5"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            fromToken === token.address ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="text-sm">{token.symbol}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-[#232046] border border-[#2d225a] text-white placeholder-gray-400 rounded-lg px-3 py-2 w-32 text-right"
            />
          </div>
        </div>
        {/* Swap Icon (single arrow) */}
        <div className="flex justify-center items-center -mt-4 -mb-4">
          <div className="bg-[#232046] border border-[#2d225a] rounded-full p-2 shadow-md">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 7v10M12 17l4-4M12 17l-4-4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        {/* You Receive Section */}
        <div className="bg-[#18122b] rounded-lg p-4 mt-2 border border-[#2d225a]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 text-sm font-medium">You receive</span>
            <span className="text-xs text-gray-400">Balance: 0 ETH</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Dialog open={receiveChainModalOpen} onOpenChange={setReceiveChainModalOpen}>
              <DialogTrigger asChild>
                <button
                  className="flex items-center gap-2 bg-[#232046] border border-[#2d225a] text-white rounded-lg px-3 py-2 min-w-[140px] hover:bg-[#2d225a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setReceiveChainModalOpen(true)}
                  disabled={true}
                >
                  {toChain ? (
                    <span>{CHAIN_INDEX_TO_NAME[toChain] || toChain}</span>
                  ) : (
                    <span className="text-gray-400">Select chain</span>
                  )}
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#18122b] border border-[#2d225a] max-w-md rounded-xl">
                <DialogTitle className="text-lg font-semibold text-white mb-2">Select a chain you receive</DialogTitle>
                <DialogDescription className="text-gray-400 mb-4">Choose the network you want to receive on.</DialogDescription>
                <div className="grid grid-cols-3 gap-3">
                  {uniqueChains.map(chain => (
                    <button
                      key={chain}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent hover:border-purple-500 hover:bg-[#232046] transition",
                        toChain === chain ? "border-purple-500 bg-[#232046]" : ""
                      )}
                      onClick={() => {
                        setFromChain(chain);
                        setToChain(chain);
                        setFromToken("");
                        setFromSearch("");
                        setPayChainModalOpen(false);
                      }}
                    >
                      <span className="text-xs text-white font-medium">{CHAIN_INDEX_TO_NAME[chain] || chain}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Popover open={openToToken} onOpenChange={setOpenToToken}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openToToken}
                  className="w-full justify-between bg-[#232046] text-white border-[#2d225a] hover:bg-[#2d225a]"
                  disabled={!toChain || toTokensLoading || !!toTokensError}
                >
                  {toToken ? toTokens.find(t => t.address === toToken)?.symbol || toToken : "Select token..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[#232046] border-[#2d225a] max-h-[300px] overflow-y-auto">
                <Command className="bg-[#232046]">
                  <CommandInput placeholder="Search token..." className="text-white border-b border-[#2d225a]/50" />
                  <CommandEmpty className="py-2 text-gray-400">No token found.</CommandEmpty>
                  <CommandGroup className="max-h-[250px] overflow-y-auto">
                    {toTokens.map((token) => (
                      <CommandItem
                        key={token.address}
                        value={token.symbol}
                        onSelect={(currentValue) => {
                          const selectedToken = toTokens.find(t => t.symbol === currentValue);
                          setToToken(selectedToken?.address || '');
                          setOpenToToken(false);
                        }}
                        className="text-white hover:bg-[#2d225a] cursor-pointer px-2 py-1.5"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            toToken === token.address ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="text-sm">{token.symbol}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Connect Wallet Button (show only if not connected) */}
        {!walletConnected && (
          <Button className="w-full mt-4 bg-[#f5e14b] hover:bg-[#e6d200] text-[#18122b] font-bold text-lg py-3 rounded-lg shadow-md transition-colors">
            Connect wallet
          </Button>
        )}
        {/* Get Quotes Button */}
        {walletConnected && fromChain && toChain && fromToken && toToken && (
          <Button
            className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-3 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleGetQuote}
            disabled={quoteLoading || !amount || Number(amount) <= 0}
          >
            {quoteLoading ? "Getting Quote..." : "Get Quotes"}
          </Button>
        )}
        {/* Quote/Error Display */}
        {quoteError && (
          <div className="mt-4 text-red-400 text-center">{quoteError}</div>
        )}
        {Array.isArray(quote) && quote.length > 0 && (
          <div className="mt-4">
            <div className="flex gap-2 mb-2 flex-wrap">
              {quote.map((q, idx) => (
                <button
                  key={idx}
                  className={`px-3 py-1 rounded-lg border transition font-semibold text-xs ${selectedQuoteIdx === idx ? 'bg-purple-600 border-purple-400 text-white' : 'bg-[#232046] border-[#2d225a] text-purple-200 hover:bg-purple-800'}`}
                  onClick={() => setSelectedQuoteIdx(idx)}
                >
                  {q.dexName || q.routerName || `Route ${idx + 1}`}
                </button>
              ))}
            </div>
            <div className="bg-gradient-to-br from-purple-900/80 to-indigo-900/80 border border-purple-700 rounded-2xl p-6 text-white shadow-xl">
              {/* Move Swap Button to bottom right using flex */}
              <div className="flex justify-end mt-6">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSwap}
                  disabled={swapLoading || !quote || selectedQuoteIdx === null || selectedQuoteIdx === undefined || !quote[selectedQuoteIdx] || !isConnected}
                >
                  {swapLoading ? "Processing..." : txStatus ? (
                    txStatus === 'success' ? "Success!" :
                    txStatus === 'failed' ? "Failed" :
                    "Processing..."
                  ) : "Swap"}
                </Button>
              </div>
              {/* Transaction Status Display */}
              {txHash && (
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-300 mb-2">Transaction Hash:</div>
                  <a 
                    href={`https://explorer.solana.com/tx/${txHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-300 hover:text-purple-400 break-all"
                  >
                    {txHash}
                  </a>
                  {txStatus && (
                    <div className={`mt-2 text-sm ${
                      txStatus === 'success' ? 'text-green-400' :
                      txStatus === 'failed' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {txStatus === 'success' ? 'Transaction Successful!' :
                       txStatus === 'failed' ? 'Transaction Failed' :
                       'Transaction Pending...'}
                    </div>
                  )}
                </div>
              )}
              
              {(() => {
                const q = quote[selectedQuoteIdx];
                // Get decimals for pay/receive tokens
                const fromTokenObj = fromTokens.find(t => `${t.address}-${t.chain}` === fromToken);
                const toTokenObj = toTokens.find(t => `${t.address}-${t.chain}` === toToken);
                const fromDecimals = q?.fromToken?.decimal ? Number(q.fromToken.decimal) : fromTokenObj?.decimals;
                const toDecimals = q?.toToken?.decimal ? Number(q.toToken.decimal) : toTokenObj?.decimals;
                // Show the user input for 'You pay' (not converted)
                const payAmount = amount;
                // Format the received amount using decimals
                const receiveAmount = formatTokenAmount(q.amountOut, toDecimals);
                // Price calculation: (amountOut / amountIn) * (fromDecimals/toDecimals)
                let price = '-';
                if (q.amountIn && q.amountOut && fromDecimals != null && toDecimals != null) {
                  const inVal = Number(q.amountIn) / Math.pow(10, fromDecimals);
                  const outVal = Number(q.amountOut) / Math.pow(10, toDecimals);
                  if (inVal > 0) price = (outVal / inVal).toFixed(8);
                }
                return (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
                      <div>
                        <div className="text-lg font-bold mb-1 flex items-center gap-2">
                          <span>You pay:</span>
                          <span className="text-yellow-300">{payAmount} {fromTokenObj?.symbol || q.fromToken?.tokenSymbol || ''}</span>
                        </div>
                        <div className="text-sm text-gray-300">{fromTokenObj?.name || q.fromToken?.tokenSymbol || ''}</div>
                      </div>
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" className="mx-auto my-2 md:my-0"><path d="M12 7v10M12 17l4-4M12 17l-4-4" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <div>
                        <div className="text-lg font-bold mb-1 flex items-center gap-2">
                          <span>You receive:</span>
                          <span className="text-green-300">{receiveAmount} {toTokenObj?.symbol || q.toToken?.tokenSymbol || ''}</span>
                        </div>
                        <div className="text-sm text-gray-300">{toTokenObj?.name || q.toToken?.tokenSymbol || ''}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-[#232046] rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Price</span>
                          <span className="font-semibold text-purple-200">{price} {toTokenObj?.symbol || q.toToken?.tokenSymbol || ''} / {fromTokenObj?.symbol || q.fromToken?.tokenSymbol || ''}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Price Impact</span>
                          <span className="font-semibold text-pink-300">{q.priceImpactPercentage ? `${q.priceImpactPercentage}%` : '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Trade Fee</span>
                          <span className="font-semibold text-orange-200">{q.tradeFee ? Number(q.tradeFee).toFixed(6) : '-'} {fromTokenObj?.symbol || q.fromToken?.tokenSymbol || ''}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Estimated Gas</span>
                          <span className="font-semibold text-blue-200">{q.estimateGasFee || '-'}</span>
                        </div>
                      </div>
                      <div className="bg-[#232046] rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Swap Mode</span>
                          <span className="font-semibold text-purple-200">{q.swapMode || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Minimum Out</span>
                          <span className="font-semibold text-green-200">{q.minAmountOut || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Path</span>
                          <span className="font-semibold text-yellow-200">{q.path ? q.path.join(' → ') : '-'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Advanced details, no raw JSON, just readable router/dex/subRouter info */}
                    <details className="mt-6 bg-[#18122b] rounded-xl p-4 border border-[#2d225a]">
                      <summary className="cursor-pointer text-purple-300 font-semibold mb-2">Advanced Quote Details</summary>
                      {q.dexRouterList && Array.isArray(q.dexRouterList) && q.dexRouterList.length > 0 && (
                        <div className="mt-4">
                          <div className="font-bold text-purple-200 mb-2">Routers & DEX Paths</div>
                          {q.dexRouterList.map((router: any, i: number) => (
                            <div key={i} className="mb-2 p-2 bg-[#232046] rounded-lg">
                              <div className="text-sm text-purple-300">Router: {router.router}</div>
                              <div className="text-xs text-gray-400">Router Percent: {router.routerPercent}%</div>
                              {router.subRouterList && Array.isArray(router.subRouterList) && router.subRouterList.length > 0 && (
                                <div className="mt-1">
                                  <div className="text-xs text-gray-300">SubRouters:</div>
                                  {router.subRouterList.map((sub: any, j: number) => (
                                    <div key={j} className="ml-2 mb-1">
                                      {sub.dexProtocol && Array.isArray(sub.dexProtocol) && sub.dexProtocol.length > 0 && (
                                        <div className="text-xs text-yellow-200">DEX Protocols: {sub.dexProtocol.map((d: any) => `${d.dexName} (${d.percent}%)`).join(', ')}</div>
                                      )}
                                      <div className="text-xs text-gray-400">From: {sub.fromToken?.tokenSymbol} ({sub.fromToken?.tokenContractAddress})</div>
                                      <div className="text-xs text-gray-400">To: {sub.toToken?.tokenSymbol} ({sub.toToken?.tokenContractAddress})</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Show fromToken/toToken details if available */}
                      <div className="mt-4">
                        <div className="font-bold text-purple-200 mb-2">From Token</div>
                        <div className="text-xs text-gray-200">Symbol: {q.fromToken?.tokenSymbol}</div>
                        <div className="text-xs text-gray-200">Address: {q.fromToken?.tokenContractAddress}</div>
                        <div className="text-xs text-gray-200">Decimals: {q.fromToken?.decimal}</div>
                        <div className="font-bold text-purple-200 mb-2 mt-2">To Token</div>
                        <div className="text-xs text-gray-200">Symbol: {q.toToken?.tokenSymbol}</div>
                        <div className="text-xs text-gray-200">Address: {q.toToken?.tokenContractAddress}</div>
                        <div className="text-xs text-gray-200">Decimals: {q.toToken?.decimal}</div>
                      </div>
                    </details>
                  </>
                );
              })()}
            </div>
            {/* Add Swap Error Display */}
            {swapError && (
              <div className="mt-4 text-red-400 text-center">{swapError}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
