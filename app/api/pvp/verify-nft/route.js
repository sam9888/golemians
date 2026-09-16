import { ethers } from 'ethers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet, NFT_MIN_BALANCE } from '@/lib/pvpLogic';

// ERC721 ABI - only need balanceOf function
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

export async function POST(request) {
  try {
    const { wallet_address } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid EVM wallet address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();
    const contractAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS;

    if (!contractAddress) {
      console.error('Missing NEXT_PUBLIC_NFT_CONTRACT_ADDRESS');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Connect to Ethereum mainnet (Infura public RPC)
    const provider = new ethers.JsonRpcProvider('https://eth.drpc.org');

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

    // Call balanceOf on contract
    let nftBalance = 0;
    try {
      const balance = await contract.balanceOf(normalizedWallet);
      nftBalance = Number(balance);
    } catch (contractErr) {
      console.error('Contract call error:', contractErr);
      return new Response(
        JSON.stringify({
          error: 'Could not verify NFT balance. Check wallet or contract address.',
          debug: contractErr.message
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Upsert player in database
    const { data: player, error } = await supabaseAdmin
      .from('pvp_players')
      .upsert({
        wallet_address: normalizedWallet,
        nft_balance: nftBalance,
        verified_at: new Date().toISOString()
      }, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (error) {
      console.error('PvP player upsert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to verify player' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const hasEnough = player.nft_balance >= NFT_MIN_BALANCE;

    return new Response(
      JSON.stringify({
        ok: true,
        wallet: normalizedWallet,
        nft_balance: player.nft_balance,
        can_play: hasEnough,
        message: hasEnough
          ? `Verified! You have ${player.nft_balance} NFTs.`
          : `Need ${NFT_MIN_BALANCE} NFTs to play PvP. You have ${player.nft_balance}.`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('PvP verify-nft error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error verifying NFT', debug: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
