// Web3 Wallet Connection & NFT Verification

import { ethers } from 'ethers';

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

export async function connectWallet() {
  if (typeof window === 'undefined') return null;

  // Check if MetaMask is installed
  if (!window.ethereum) {
    throw new Error('MetaMask not installed. Please install MetaMask to play.');
  }

  try {
    // Request wallet connection
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const address = accounts[0].toLowerCase();
    return address;
  } catch (err) {
    console.error('Wallet connection failed:', err);
    throw err;
  }
}

export async function getConnectedWallet() {
  if (typeof window === 'undefined') return null;

  if (!window.ethereum) return null;

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });

    return accounts && accounts.length > 0 ? accounts[0].toLowerCase() : null;
  } catch (err) {
    console.error('Failed to get connected wallet:', err);
    return null;
  }
}

export async function verifyNftOwnership(walletAddress) {
  if (!process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS) {
    throw new Error('NFT contract address not configured');
  }

  try {
    const provider = new ethers.JsonRpcProvider('https://eth.drpc.org');
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS,
      ERC721_ABI,
      provider
    );

    const balance = await contract.balanceOf(walletAddress);
    return Number(balance);
  } catch (err) {
    console.error('NFT verification failed:', err);
    throw err;
  }
}

export async function signMessage(walletAddress, message) {
  if (typeof window === 'undefined') return null;

  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const signature = await signer.signMessage(message);
    return signature;
  } catch (err) {
    console.error('Message signing failed:', err);
    throw err;
  }
}

// Verify wallet owns the NFTs they claim
export async function verifyWalletOwnership(walletAddress) {
  try {
    const nftBalance = await verifyNftOwnership(walletAddress);

    if (nftBalance < 10) {
      throw new Error(`Need 10+ NFTs. You have ${nftBalance}.`);
    }

    return {
      valid: true,
      balance: nftBalance,
      message: `Verified ${nftBalance} Golemians`
    };
  } catch (err) {
    return {
      valid: false,
      balance: 0,
      error: err.message
    };
  }
}
