import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { requireSessionResponse } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { createJoinToken } from '@/lib/arena/joinToken';
import { resolveGolemBalance } from '@/lib/arena/config';
import { MIN_GOLEMIANS_TO_PLAY, MATCH_ENTRY_GLM } from '@/shared/arenaConfig';

export async function POST(request) {
  try {
    const { wallet_address, token_id } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return json({ error: 'Invalid EVM wallet address' }, 400);
    }
    const normalizedWallet = wallet_address.toLowerCase();

    const authError = requireSessionResponse(request, normalizedWallet);
    if (authError) return authError;

    const rateCheck = checkRateLimit(`arena_enter_${normalizedWallet}`, 10, 3600);
    if (!rateCheck.allowed) {
      return json(
        { error: 'Too many entry attempts. Try again later.', retryAfter: rateCheck.retryAfter },
        429,
        { 'Retry-After': String(rateCheck.retryAfter) }
      );
    }

    // token_id is self-reported (which Golem # the player wants to be seen
    // as) and NOT cryptographically verified against on-chain ownership of
    // that specific token — only the wallet's aggregate NFT balance below is
    // actually verified on-chain. This matches the trust level already used
    // by /api/pvp/verify-nft (balanceOf only, no ownerOf check).
    let tokenId = null;
    if (token_id !== undefined && token_id !== null && token_id !== '') {
      const n = Number(token_id);
      if (!Number.isInteger(n) || n < 0) {
        return json({ error: 'Invalid token_id' }, 400);
      }
      tokenId = n;
    }

    let nftBalance;
    try {
      nftBalance = await resolveGolemBalance(normalizedWallet, request);
    } catch (err) {
      console.error('Arena enter: NFT balance check failed:', err);
      return json({ error: 'Could not verify NFT balance', debug: err.message }, 400);
    }

    if (nftBalance < MIN_GOLEMIANS_TO_PLAY) {
      return json({ error: `Need ${MIN_GOLEMIANS_TO_PLAY} Golemians to play. You have ${nftBalance}.` }, 403);
    }

    let characterName = null;
    if (tokenId !== null) {
      try {
        const { data } = await supabaseAdmin
          .from('character_registry')
          .select('character_name')
          .eq('token_id', tokenId)
          .maybeSingle();
        characterName = data?.character_name || null;
      } catch {
        characterName = null; // character_registry not provisioned yet — client falls back to GOLEM #id
      }
    }

    const { data: player, error: fetchError } = await supabaseAdmin
      .from('arena_players')
      .select('*')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (fetchError) {
      console.error('Arena enter: player fetch error:', fetchError);
      return json({ error: 'Failed to load player record' }, 500);
    }

    const currentBalance = player?.glm_balance ?? 0;
    if (currentBalance < MATCH_ENTRY_GLM) {
      return json({ error: `Need ${MATCH_ENTRY_GLM} GLM to enter. You have ${currentBalance}.` }, 403);
    }

    const entryId = crypto.randomUUID();
    const newBalance = currentBalance - MATCH_ENTRY_GLM;
    const now = new Date().toISOString();

    const { error: debitError } = await supabaseAdmin.from('arena_players').upsert(
      {
        wallet_address: normalizedWallet,
        glm_balance: newBalance,
        verified_golem_count: nftBalance,
        last_ownership_check: now,
        updated_at: now,
      },
      { onConflict: 'wallet_address' }
    );

    if (debitError) {
      console.error('Arena enter: debit error:', debitError);
      return json({ error: 'Failed to debit entry fee' }, 500);
    }

    const { error: ledgerError } = await supabaseAdmin.from('arena_glm_ledger').insert({
      wallet_address: normalizedWallet,
      amount: -MATCH_ENTRY_GLM,
      reason: 'match_entry',
      metadata: { entryId, tokenId },
    });
    if (ledgerError) {
      console.error('Arena enter: ledger insert error (non-fatal):', ledgerError);
    }

    const joinToken = createJoinToken({ wallet: normalizedWallet, tokenId, entryId, characterName });

    return json({
      ok: true,
      joinToken,
      glm_balance: newBalance,
      entry_amount: MATCH_ENTRY_GLM,
    });
  } catch (err) {
    console.error('Arena enter error:', err);
    return json({ error: 'Server error entering match', debug: err.message }, 500);
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
