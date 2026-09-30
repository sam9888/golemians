import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { requireSessionResponse } from '@/lib/session';
import { resolveGolemBalance } from '@/lib/arena/config';
import {
  MIN_GOLEMIANS_TO_PLAY,
  MIN_GOLEMIANS_FOR_DAILY_CLAIM,
  MATCH_ENTRY_GLM,
  DAILY_CLAIM_AMOUNT_GLM,
  DAILY_CLAIM_INTERVAL_MS,
} from '@/shared/arenaConfig';

// Read-only lobby status: GLM balance, live NFT eligibility, and daily-claim
// timing. Kept separate from POST /api/arena/enter and /api/arena/claim-daily
// specifically so the UI can poll/display eligibility without triggering
// either route's side effects (debiting GLM / crediting a claim). Mirrors
// the existing GET /api/pvp/player-stats read-only convention.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!isValidWallet(wallet)) {
      return json({ error: 'Invalid EVM wallet address' }, 400);
    }
    const normalizedWallet = wallet.toLowerCase();

    const authError = requireSessionResponse(request, normalizedWallet);
    if (authError) return authError;

    let nftBalance;
    try {
      nftBalance = await resolveGolemBalance(normalizedWallet, request);
    } catch (err) {
      console.error('Arena status: NFT balance check failed:', err);
      return json({ error: 'Could not verify NFT balance', debug: err.message }, 400);
    }

    const { data: player, error: fetchError } = await supabaseAdmin
      .from('arena_players')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (fetchError) {
      console.error('Arena status: fetch error:', fetchError);
      return json({ error: 'Failed to load player record' }, 500);
    }

    const lastClaim = player?.last_daily_claim_at ? new Date(player.last_daily_claim_at).getTime() : 0;
    const claimReadyAt = lastClaim + DAILY_CLAIM_INTERVAL_MS;

    return json({
      ok: true,
      wallet: normalizedWallet,
      glm_balance: player?.glm_balance ?? 0,
      verified_golem_count: nftBalance,
      eligible_to_play: nftBalance >= MIN_GOLEMIANS_TO_PLAY,
      eligible_for_daily_claim: nftBalance >= MIN_GOLEMIANS_FOR_DAILY_CLAIM,
      daily_claim_ready: Date.now() >= claimReadyAt,
      daily_claim_ready_at: new Date(claimReadyAt).toISOString(),
      min_golemians_to_play: MIN_GOLEMIANS_TO_PLAY,
      match_entry_glm: MATCH_ENTRY_GLM,
      daily_claim_amount_glm: DAILY_CLAIM_AMOUNT_GLM,
    });
  } catch (err) {
    console.error('Arena status error:', err);
    return json({ error: 'Server error fetching arena status', debug: err.message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
