import { supabase } from '@/lib/supabaseClient';

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, wallet, status, allocation, claimed } = body;

    if (!id && !wallet) {
      return new Response(JSON.stringify({ error: 'Submission ID or wallet address required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (allocation !== undefined) updateData.allocation = allocation;
    if (claimed !== undefined) updateData.claimed = claimed;
    updateData.updated_at = new Date().toISOString();

    let query = supabase.from('submissions').update(updateData);

    if (id) {
      query = query.eq('id', id);
    } else if (wallet) {
      query = query.or(`evm_address.eq.${wallet.toLowerCase()},wallet_address.ilike.${wallet}`);
    }

    const { data, error } = await query.select();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, updated: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error updating allocation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
