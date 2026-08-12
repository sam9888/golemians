import { supabaseAdmin } from '@/lib/supabaseAdmin';

function isAuthorized(request) {
  const provided = request.headers.get('x-admin-key');
  const expected = process.env.ADMIN_API_KEY;
  return Boolean(expected) && provided === expected;
}

// GET /api/admin/submissions — list all submissions (admin only)
export async function GET(request) {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch submissions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PATCH /api/admin/submissions — approve/allocate/claim a submission (admin only)
export async function PATCH(request) {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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

    let query = supabaseAdmin.from('submissions').update(updateData);

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
