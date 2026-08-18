import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet');
  const handle = searchParams.get('handle');

  if (!wallet && !handle) {
    return new Response(JSON.stringify({ error: 'Wallet address or X handle required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let query = supabaseAdmin.from('submissions').select('*');

    if (wallet) {
      const normalizedWallet = wallet.trim().toLowerCase();
      query = query.or(`evm_address.eq.${normalizedWallet},wallet_address.ilike.${wallet.trim()}`);
    } else if (handle) {
      const cleanHandle = handle.trim().replace(/^@/, '');
      query = query.ilike('x_handle', cleanHandle);
    }

    const { data, error } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (data && data.length > 0) {
      const row = data[0];
      if (row.status === 'approved' || row.status === 'allocated' || row.status === 'winner' || row.allocation > 0 || row.claimed === true) {
        return new Response(JSON.stringify({
          found: true,
          isWl: true,
          status: 'allocated',
          message: 'WAGMI! This wallet is on the GTD WL.',
          data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (row.status === 'pending' || row.allocation === 0) {
        return new Response(JSON.stringify({
          found: true,
          isWl: false,
          status: 'pending',
          message: 'Submission Received — Pending Allocation.',
          data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          found: true,
          isWl: false,
          status: row.status || 'rejected',
          message: 'NOT WL YET — Submission was not allocated GTD.',
          data: { x_handle: row.x_handle, wallet_address: row.wallet_address, status: row.status }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      found: false,
      isWl: false,
      status: 'not_found',
      message: 'NOT WL YET — Complete the tasks below and submit.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error checking status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
