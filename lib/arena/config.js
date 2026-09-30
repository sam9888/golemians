import { ethers } from 'ethers';

export * from '@/shared/arenaConfig';

export function getGameServerSecret() {
  const secret = process.env.GAME_SERVER_SECRET;
  if (!secret) throw new Error('GAME_SERVER_SECRET environment variable is not configured');
  return secret;
}

export function getGameServerUrl() {
  const url = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (!url) throw new Error('NEXT_PUBLIC_GAME_SERVER_URL environment variable is not configured');
  return url;
}

// Dev-only holder-count override so eligibility states (locked/eligible) can
// be exercised without real test-wallet NFTs. Header-based, hard-disabled
// in production regardless of what's sent.
export function getDevHolderOverride(request) {
  if (process.env.NODE_ENV === 'production') return null;
  const header = request.headers.get('x-dev-holder-count');
  if (header === null || header === '') return null;
  const n = Number(header);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

const ERC721_ABI = ['function balanceOf(address owner) view returns (uint256)'];

// Resolves a wallet's live Golemians NFT balance (honoring the dev override
// in non-production). Throws on a genuine on-chain/RPC failure so callers
// can distinguish "not enough NFTs" from "couldn't check".
export async function resolveGolemBalance(wallet, request) {
  const override = getDevHolderOverride(request);
  if (override !== null) return override;

  const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not configured');
  }
  const rpcUrl = process.env.NEXT_PUBLIC_NFT_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const balance = await contract.balanceOf(wallet);
  return Number(balance);
}
