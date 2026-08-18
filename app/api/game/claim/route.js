import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidSessionId, isValidEvm, isValidHandle } from '@/lib/gameLogic';

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || '').trim();
    const handle = (body.handle || '').trim();
    const wallet = (body.wallet || '').trim();

    if (!isValidSessionId(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidHandle(handle)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid X handle.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidEvm(wallet)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid EVM address (0x + 40 hex characters).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: session } = await supabaseAdmin
      .from('game_sessions')
      .select('won, won_tier, claimed')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!session?.won) {
      return new Response(JSON.stringify({ error: 'This session has not won a spot.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (session.claimed) {
      return new Response(JSON.stringify({ error: 'This win has already been claimed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const evmAddress = wallet.toLowerCase();
    const cleanHandle = handle.replace(/^@/, '');
    const tier = session.won_tier;

    // Duplicate wallet check across the real submissions table (same rule
    // as the rest of the site - one wallet, one spot).
    const { data: existing } = await supabaseAdmin
      .from('submissions')
      .select('id')
      .eq('evm_address', evmAddress)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'This wallet has already been submitted or claimed elsewhere.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error: winnerError } = await supabaseAdmin
      .from('game_winners')
      .insert({
        session_id: sessionId,
        tier,
        x_handle: cleanHandle,
        wallet_address: wallet,
        evm_address: evmAddress
      });

    if (winnerError) {
      console.error('Game winner insert error:', winnerError);
      return new Response(JSON.stringify({ error: winnerError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GTD wins go straight into the real submissions table so they count
    // toward the live claimed total and pass the WL checker immediately.
    // FCFS/Public wins only land in game_winners - review that list
    // manually when those phases open, since they aren't live-tracked.
    if (tier === 'gtd') {
      const { error: submissionError } = await supabaseAdmin
        .from('submissions')
        .upsert(
          {
            x_handle: cleanHandle,
            quote_link: 'https://x.com/golemians',
            wallet_address: wallet,
            evm_address: evmAddress,
            status: 'winner',
            allocation: 1,
            claimed: true
          },
          { onConflict: 'evm_address' }
        );

      if (submissionError) {
        console.error('Game GTD win submission upsert error:', submissionError);
      }
    }

    await supabaseAdmin
      .from('game_sessions')
      .update({ claimed: true, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    return new Response(JSON.stringify({
      success: true,
      tier,
      message: `Claimed! You're locked in for the ${tier.toUpperCase()} phase.`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Game claim API error:', err);
    return new Response(JSON.stringify({ error: 'Server error processing claim' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
