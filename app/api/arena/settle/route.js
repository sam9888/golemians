import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MATCH_WINNER_GLM, MATCH_ENTRY_GLM } from '@/shared/arenaConfig';

// Server-to-server only: called by the Colyseus match server with the final
// standings once a match ends. Authenticated via a GAME_SERVER_SECRET
// bearer token, never a user session — the match server is the only caller.
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const secret = process.env.GAME_SERVER_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { matchId, mapId, standings } = await request.json();

    if (!matchId || !Array.isArray(standings) || standings.length === 0) {
      return json({ error: 'Invalid settlement payload' }, 400);
    }

    const winner = standings.find((s) => s.placement === 1);
    const nowIso = new Date().toISOString();

    const { error: matchError } = await supabaseAdmin.from('arena_matches').insert({
      id: matchId,
      map_id: mapId || 'great-collapse',
      status: 'completed',
      started_at: nowIso,
      ended_at: nowIso,
      winner_wallet: winner?.wallet || null,
      winner_token_id: winner?.tokenId ?? null,
    });
    if (matchError) {
      console.error('Arena settle: match insert error:', matchError);
    }

    for (const standing of standings) {
      const wallet = typeof standing.wallet === 'string' ? standing.wallet.toLowerCase() : null;
      if (!wallet) continue;

      const { error: participantError } = await supabaseAdmin.from('arena_match_participants').insert({
        match_id: matchId,
        wallet_address: wallet,
        token_id: standing.tokenId ?? null,
        entry_amount: MATCH_ENTRY_GLM,
        placement: standing.placement ?? null,
        eliminated_at: standing.placement === 1 ? null : nowIso,
      });
      if (participantError) {
        console.error('Arena settle: participant insert error:', participantError);
      }

      if (standing.placement === 1) {
        const { data: player } = await supabaseAdmin
          .from('arena_players')
          .select('glm_balance')
          .eq('wallet_address', wallet)
          .maybeSingle();

        const newBalance = (player?.glm_balance ?? 0) + MATCH_WINNER_GLM;

        const { error: creditError } = await supabaseAdmin.from('arena_players').upsert(
          { wallet_address: wallet, glm_balance: newBalance, updated_at: nowIso },
          { onConflict: 'wallet_address' }
        );
        if (creditError) {
          console.error('Arena settle: winner credit error:', creditError);
        }

        await supabaseAdmin.from('arena_glm_ledger').insert({
          wallet_address: wallet,
          amount: MATCH_WINNER_GLM,
          reason: 'match_win',
          metadata: { matchId },
        });
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Arena settle error:', err);
    return json({ error: 'Server error settling match', debug: err.message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
