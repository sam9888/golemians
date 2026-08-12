import { supabase } from '@/lib/supabaseClient';

function isValidEvm(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function isValidHandle(h) {
  return typeof h === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(h.trim().replace(/^@/, ''));
}

function isValidTweetLink(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return ['twitter.com', 'x.com', 'www.twitter.com', 'www.x.com'].includes(u.hostname) && u.pathname.includes('/status/');
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const handle = (body.handle || body.x_handle || '').trim();
    const quoteLink = (body.quoteLink || body.quote_link || body.tweet_link || body.quote || '').trim();
    const walletAddress = (body.subWallet || body.wallet_address || body.wallet || '').trim();

    // Validation
    if (!isValidHandle(handle)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid X handle.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidTweetLink(quoteLink)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid X/Twitter quote tweet link.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidEvm(walletAddress)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid EVM address (0x + 40 hex characters).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const cleanHandle = handle.replace(/^@/, '');

    // Duplicate check
    const { data: existing, error: checkError } = await supabase
      .from('submissions')
      .select('id, wallet_address, status')
      .or(`evm_address.eq.${normalizedWallet},wallet_address.ilike.${walletAddress}`)
      .limit(1);

    if (checkError) {
      console.error('Error checking duplicate:', checkError);
    }

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: 'This wallet address has already been submitted.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insert new submission (default status: pending, allocation: 0, claimed: false)
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        x_handle: cleanHandle,
        quote_link: quoteLink,
        tweet_link: quoteLink,
        wallet_address: walletAddress,
        evm_address: normalizedWallet,
        status: 'pending',
        allocation: 0,
        claimed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return new Response(JSON.stringify({ error: `Database error: ${error.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'pending',
      message: 'SUBMISSION RECEIVED — Pending Allocation. Your details have been recorded for GTD WL review.',
      data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Submit API error:', err);
    return new Response(JSON.stringify({ error: 'Server error processing submission.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
