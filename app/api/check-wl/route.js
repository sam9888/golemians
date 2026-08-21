import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function checkGtd(wallet, handle) {
  let query = supabaseAdmin.from('submissions').select('*');

  if (wallet) {
    const normalizedWallet = wallet.trim().toLowerCase();
    query = query.or(`evm_address.eq.${normalizedWallet},wallet_address.ilike.${wallet.trim()}`);
  } else if (handle) {
    const cleanHandle = handle.trim().replace(/^@/, '');
    query = query.ilike('x_handle', cleanHandle);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    const row = data[0];
    if (row.status === 'approved' || row.status === 'allocated' || row.status === 'winner' || row.allocation > 0 || row.claimed === true) {
      return {
        found: true,
        isWl: true,
        status: 'allocated',
        message: 'WAGMI! This wallet is on the GTD WL.',
        data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
      };
    } else if (row.status === 'pending' || row.allocation === 0) {
      return {
        found: true,
        isWl: false,
        status: 'pending',
        message: 'Submission Received — Pending Allocation.',
        data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
      };
    }
    return {
      found: true,
      isWl: false,
      status: row.status || 'rejected',
      message: 'NOT WL YET — Submission was not allocated GTD.',
      data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
    };
  }

  return {
    found: false,
    isWl: false,
    status: 'not_found',
    message: 'NOT WL YET — GTD is closed. Try the ladder game for FCFS.'
  };
}

async function checkGameTier(wallet, handle, tier) {
  let query = supabaseAdmin.from('game_winners').select('*').eq('tier', tier);

  if (wallet) {
    const normalizedWallet = wallet.trim().toLowerCase();
    query = query.eq('evm_address', normalizedWallet);
  } else if (handle) {
    const cleanHandle = handle.trim().replace(/^@/, '');
    query = query.ilike('x_handle', cleanHandle);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tierLabel = tier.toUpperCase();

  if (data && data.length > 0) {
    const row = data[0];
    return {
      found: true,
      isWl: true,
      status: 'allocated',
      message: `WAGMI! This wallet won a ${tierLabel} spot.`,
      data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: 'winner' }
    };
  }

  return {
    found: false,
    isWl: false,
    status: 'not_found',
    message: `NOT ${tierLabel} YET — Win a spot on the ladder game to get on this list.`
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const handle = searchParams.get('handle');
  const tier = (searchParams.get('tier') || 'gtd').toLowerCase();

  if (!wallet && !handle) {
    return new Response(JSON.stringify({ error: 'Wallet address or X handle required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!['gtd', 'fcfs', 'public'].includes(tier)) {
    return new Response(JSON.stringify({ error: 'Invalid tier' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = tier === 'gtd'
      ? await checkGtd(wallet, handle)
      : await checkGameTier(wallet, handle, tier);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('check-wl error:', err);
    return new Response(JSON.stringify({ error: 'Server error checking status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
