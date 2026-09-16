// $GOLE Token Bridge - Connect in-game tokens to ERC20 contract
// This will be activated once Robin Hood Launchpad deploys the token

import { ethers } from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export async function getGoleBalance(walletAddress) {
  if (!process.env.NEXT_PUBLIC_GOLE_TOKEN_CONTRACT || !process.env.GOLE_BRIDGE_ENABLED) {
    return null; // Bridge not enabled yet
  }

  try {
    const provider = new ethers.JsonRpcProvider('https://eth.drpc.org');
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_GOLE_TOKEN_CONTRACT,
      ERC20_ABI,
      provider
    );

    const balance = await contract.balanceOf(walletAddress);
    return ethers.formatUnits(balance, process.env.NEXT_PUBLIC_GOLE_DECIMALS || 18);
  } catch (err) {
    console.error('Failed to get $GOLE balance:', err);
    return null;
  }
}

export async function bridgeGoleToWallet(walletAddress, amountInGoleTokens) {
  // This function will be called when player wants to withdraw tokens to MetaMask
  // Requires game contract to have MINTER_ROLE on token contract

  if (!process.env.NEXT_PUBLIC_GOLE_TOKEN_CONTRACT || !process.env.GOLE_BRIDGE_ENABLED) {
    return { error: 'Bridge not enabled yet' };
  }

  // This would be called from backend only (never client-side)
  // Implementation depends on whether we use minting or reserve pool

  return {
    status: 'pending',
    message: 'Bridge function to be implemented after Robin Hood deployment'
  };
}

export function isBridgeEnabled() {
  return process.env.GOLE_BRIDGE_ENABLED === 'true' &&
         !!process.env.NEXT_PUBLIC_GOLE_TOKEN_CONTRACT;
}

export function getTokenContractAddress() {
  return process.env.NEXT_PUBLIC_GOLE_TOKEN_CONTRACT || null;
}

export function getTokenDecimals() {
  return parseInt(process.env.NEXT_PUBLIC_GOLE_DECIMALS || '18');
}
