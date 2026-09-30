import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { requireSessionResponse } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolveGolemBalance } from '@/lib/arena/config';
import {
  MIN_GOLEMIANS_FOR_DAILY_CLAIM,
  DAILY_CLAIM_AMOUNT_GLM,
  DAILY_CLAIM_INTERVAL_MS,
} from '@/shared/arenaConfig';

export async function POST(request) {
  try {
    const { wallet_address } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return json({ error: 'Invalid EVM wallet address' }, 400);
    }
    const normalizedWallet = wallet_address.toLowerCase();

    const authError = requireSessionResponse(request, normalizedWallet);
    if (authError) return authError;

    const rateCheck = checkRateLimit(`arena_claim_${normalizedWallet}`, 10, 3600);
    if (!rateCheck.allowed) {
      return json(
        { error: 'Too many claim attempts. Try again later.', retryAfter: rateCheck.retryAfter },
        429,
        { 'Retry-After': String(rateCheck.retryAfter) }
      );
    }

    let nftBalance;
    try {
      nftBalance = await resolveGolemBalance(normalizedWallet, request);
    } catch (err) {
      console.error('Arena claim-daily: NFT balance check failed:', err);
      return json({ error: 'Could not verify NFT balance', debug: err.message }, 400);
    }

    if (nftBalance < MIN_GOLEMIANS_FOR_DAILY_CLAIM) {
      return json({ error: `Need ${MIN_GOLEMIANS_FOR_DAILY_CLAIM}+ Golemians to claim. You have ${nftBalance}.` }, 403);
    }

    const { data: player, error: fetchError } = await supabaseAdmin
      .from('arena_players')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (fetchError) {
      console.error('Arena claim-daily: fetch error:', fetchError);
      return json({ error: 'Failed to load player record' }, 500);
    }

    const lastClaim = player?.last_daily_claim_at ? new Date(player.last_daily_claim_at).getTime() : 0;
    const now = Date.now();
    if (now - lastClaim < DAILY_CLAIM_INTERVAL_MS) {
      const retryAfterSeconds = Math.ceil((DAILY_CLAIM_INTERVAL_MS - (now - lastClaim)) / 1000);
      return json({ error: 'Daily claim not yet available.', retryAfterSeconds }, 429);
    }

    const newBalance = (player?.glm_balance ?? 0) + DAILY_CLAIM_AMOUNT_GLM;
    const nowIso = new Date(now).toISOString();

    const { error: updateError } = await supabaseAdmin.from('arena_players').upsert(
      {
        wallet_address: normalizedWallet,
        glm_balance: newBalance,
        verified_golem_count: nftBalance,
        last_ownership_check: nowIso,
        last_daily_claim_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'wallet_address' }
    );

    if (updateError) {
      console.error('Arena claim-daily: update error:', updateError);
      return json({ error: 'Failed to record claim' }, 500);
    }

    await supabaseAdmin.from('arena_glm_ledger').insert({
      wallet_address: normalizedWallet,
      amount: DAILY_CLAIM_AMOUNT_GLM,
      reason: 'daily_claim',
    });

    return json({ ok: true, glm_balance: newBalance, claimed: DAILY_CLAIM_AMOUNT_GLM });
  } catch (err) {
    console.error('Arena claim-daily error:', err);
    return json({ error: 'Server error claiming daily reward', debug: err.message }, 500);
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
