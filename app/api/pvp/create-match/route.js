import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet, NFT_MIN_BALANCE, DEFAULT_STAKE } from '@/lib/pvpLogic';

export async function POST(request) {
  try {
    const { player1_wallet, player2_wallet, stake_amount } = await request.json();

    // Validate inputs
    if (!isValidWallet(player1_wallet) || !isValidWallet(player2_wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet addresses' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (player1_wallet.toLowerCase() === player2_wallet.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'Cannot challenge yourself' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const p1 = player1_wallet.toLowerCase();
    const p2 = player2_wallet.toLowerCase();
    const stake = stake_amount || DEFAULT_STAKE;

    // Fetch both players
    const { data: players, error: fetchError } = await supabaseAdmin
      .from('pvp_players')
      .select('id, wallet_address, nft_balance, tokens_held')
      .in('wallet_address', [p1, p2]);

    if (fetchError) {
      console.error('Error fetching players:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch players' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!players || players.length < 2) {
      return new Response(
        JSON.stringify({ error: 'One or both players not found. Verify wallets first.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const player1 = players.find(p => p.wallet_address === p1);
    const player2 = players.find(p => p.wallet_address === p2);

    // Check NFT balance
    if (player1.nft_balance < NFT_MIN_BALANCE || player2.nft_balance < NFT_MIN_BALANCE) {
      return new Response(
        JSON.stringify({
          error: 'One or both players need at least 10 NFTs',
          player1_balance: player1.nft_balance,
          player2_balance: player2.nft_balance
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check token balance
    if (player1.tokens_held < stake || player2.tokens_held < stake) {
      return new Response(
        JSON.stringify({
          error: 'One or both players cannot afford the stake',
          player1_tokens: player1.tokens_held,
          player2_tokens: player2.tokens_held,
          required_stake: stake
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create match
    const { data: match, error: matchError } = await supabaseAdmin
      .from('pvp_matches')
      .insert({
        player1_id: player1.id,
        player2_id: player2.id,
        stake_amount: stake,
        status: 'active'
      })
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return new Response(
        JSON.stringify({ error: 'Failed to create match' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        match_id: match.id,
        player1_wallet: p1,
        player2_wallet: p2,
        stake: stake
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('PvP create-match error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error creating match' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
