// Web3 Wallet Connection & NFT Verification

import { ethers } from 'ethers';

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

export async function connectWallet() {
  if (typeof window === 'undefined') return null;

  // Check if a browser wallet is installed. The EIP-1193 provider may be
  // MetaMask, Rabby, Coinbase Wallet, or another compatible wallet.
  if (!window.ethereum) {
    throw new Error('No compatible browser wallet found. Please install a wallet to play.');
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
  if (!ethers.isAddress(walletAddress)) {
    throw new Error('Invalid wallet address');
  }

  const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;
  if (
    !contractAddress ||
    !ethers.isAddress(contractAddress) ||
    contractAddress.toLowerCase() === ethers.ZeroAddress
  ) {
    throw new Error('NFT contract address is not configured correctly');
  }

  try {
    // Golemians NFT collection is deployed on Robinhood Chain (chainId 4663),
    // not Ethereum mainnet.
    const rpcUrl = process.env.NEXT_PUBLIC_NFT_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

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
    throw new Error('No compatible browser wallet found');
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    // The account can change in the wallet popup between connect and sign.
    // Refuse to sign for a different account instead of confusing the user or
    // sending a signature the server will reject.
    if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Wallet account changed. Connect the account you want to use and try again.');
    }

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
