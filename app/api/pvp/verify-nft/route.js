import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet, NFT_MIN_BALANCE } from '@/lib/pvpLogic';

// For now, mock NFT verification. In production, you'd call:
// ethers.provider.getBalance() or your NFT contract's balanceOf()
// This is a placeholder that checks wallet format and creates/updates player record
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

    // TODO: Replace with real NFT contract call via ethers
    // For MVP: assume any verified wallet has NFTs
    const mockNftBalance = NFT_MIN_BALANCE + Math.floor(Math.random() * 10);

    // Upsert player in database
    const { data: player, error } = await supabaseAdmin
      .from('pvp_players')
      .upsert({
        wallet_address: normalizedWallet,
        nft_balance: mockNftBalance,
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
      JSON.stringify({ error: 'Server error verifying NFT' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
