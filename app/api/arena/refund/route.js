import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MATCH_ENTRY_GLM } from '@/shared/arenaConfig';

// Server-to-server only: called by the Colyseus match server when a player
// who already paid an entry fee leaves the lobby before the match actually
// starts, so the fee is returned instead of being silently kept.
// Authenticated via GAME_SERVER_SECRET, never a user session — a client
// must not be able to ask for its own refund.
//
// The refund amount is NOT taken from the request. It is read back from the
// original `match_entry` ledger row for this entryId, so a compromised or
// buggy match server cannot mint GLM by inflating the number, and an entryId
// that never actually paid cannot be refunded at all.
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const secret = process.env.GAME_SERVER_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { entryId, wallet } = await request.json();
    if (!entryId || typeof entryId !== 'string') {
      return json({ error: 'Missing entryId' }, 400);
    }
    const normalizedWallet = typeof wallet === 'string' ? wallet.toLowerCase() : null;

    // The original debit is the sole authority for who gets refunded and how
    // much — not anything in this request body.
    const { data: entryRow, error: entryError } = await supabaseAdmin
      .from('arena_glm_ledger')
      .select('wallet_address, amount')
      .eq('reason', 'match_entry')
      .filter('metadata->>entryId', 'eq', entryId)
      .maybeSingle();

    if (entryError) {
      console.error('Arena refund: entry lookup error:', entryError);
      return json({ error: 'Failed to look up entry' }, 500);
    }
    if (!entryRow) {
      return json({ error: 'No paid entry found for this entryId' }, 404);
    }
    if (normalizedWallet && entryRow.wallet_address !== normalizedWallet) {
      console.error('Arena refund: wallet mismatch for entryId', entryId);
      return json({ error: 'Entry does not belong to that wallet' }, 403);
    }

    // Idempotent: a retry (or a duplicate leave event) must not pay twice.
    const { data: existingRefund, error: refundLookupError } = await supabaseAdmin
      .from('arena_glm_ledger')
      .select('id')
      .eq('reason', 'refund')
      .filter('metadata->>entryId', 'eq', entryId)
      .maybeSingle();

    if (refundLookupError) {
      console.error('Arena refund: refund lookup error:', refundLookupError);
      return json({ error: 'Failed to check existing refunds' }, 500);
    }
    if (existingRefund) {
      return json({ ok: true, alreadyRefunded: true });
    }

    // A match_entry row is stored as a negative amount; refund its magnitude.
    const refundAmount = Math.abs(Number(entryRow.amount)) || MATCH_ENTRY_GLM;
    const refundWallet = entryRow.wallet_address;
    const nowIso = new Date().toISOString();

    const { data: player, error: playerError } = await supabaseAdmin
      .from('arena_players')
      .select('glm_balance')
      .eq('wallet_address', refundWallet)
      .maybeSingle();

    if (playerError) {
      console.error('Arena refund: player fetch error:', playerError);
      return json({ error: 'Failed to load player record' }, 500);
    }

    const newBalance = (player?.glm_balance ?? 0) + refundAmount;

    const { error: creditError } = await supabaseAdmin.from('arena_players').upsert(
      { wallet_address: refundWallet, glm_balance: newBalance, updated_at: nowIso },
      { onConflict: 'wallet_address' }
    );
    if (creditError) {
      console.error('Arena refund: credit error:', creditError);
      return json({ error: 'Failed to credit refund' }, 500);
    }

    // Written after the credit lands: if this insert fails the player has
    // still been made whole, and the duplicate guard above is the only thing
    // weakened — preferable to logging a refund that never actually paid out.
    const { error: ledgerError } = await supabaseAdmin.from('arena_glm_ledger').insert({
      wallet_address: refundWallet,
      amount: refundAmount,
      reason: 'refund',
      metadata: { entryId },
    });
    if (ledgerError) {
      console.error('Arena refund: ledger insert error (refund already credited):', ledgerError);
    }

    return json({ ok: true, refunded: refundAmount, glm_balance: newBalance });
  } catch (err) {
    console.error('Arena refund error:', err);
    return json({ error: 'Server error issuing refund', debug: err.message }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
