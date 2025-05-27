import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Chain name and icon mappings for modal-based selector
export const CHAIN_INDEX_TO_NAME: Record<string, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  137: "Polygon",
  10: "Optimism",
  42161: "Arbitrum",
  43114: "Avalanche",
  324: "zkSync Era",
  8453: "Base",
  59144: "Linea",
  5000: "Mantle",
  4200: "Goerli (Linea Testnet)",
  81457: "Blast",
  169: "Manta Pacific",
  534352: "Scroll",
  7000: "ZetaChain",
  195: "XVM Chain",
  501: "Solana",
  784: "Scroll Sepolia",
  607: "Polygon zkEVM",
  // Add more as needed
};

// (If you want to use icons, add them here. Otherwise, you can remove this export if not needed)
// export const CHAIN_INDEX_TO_ICON: Record<string, string> = {
//   1: "/chains/eth.svg",
//   56: "/chains/bnb.svg",
//   137: "/chains/polygon.svg",
//   10: "/chains/optimism.svg",
//   42161: "/chains/arbitrum.svg",
//   43114: "/chains/avalanche.svg",
//   // Add more as needed
// };
