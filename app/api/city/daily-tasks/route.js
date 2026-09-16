import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidWallet } from '@/lib/pvpLogic';
import { DAILY_TASKS, getDailyBonusForTier } from '@/lib/nftTiers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!isValidWallet(wallet)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    // Fetch city
    const { data: city } = await supabaseAdmin
      .from('cities')
      .select('id, nft_balance')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch completed tasks today
    const { data: completed = [] } = await supabaseAdmin
      .from('daily_task_completions')
      .select('task_id')
      .eq('city_id', city.id)
      .gte('completed_at', `${today}T00:00:00`)
      .lte('completed_at', `${today}T23:59:59`);

    const completedIds = completed.map(c => c.task_id);
    const dailyBonus = getDailyBonusForTier(city.nft_balance);

    return new Response(
      JSON.stringify({
        ok: true,
        tasks: DAILY_TASKS.map(task => ({
          id: task.id,
          name: task.name,
          description: task.description,
          reward: task.reward + dailyBonus,  // Add tier bonus
          icon: task.icon,
          completed: completedIds.includes(task.id)
        })),
        tier_bonus: dailyBonus,
        nft_balance: city.nft_balance,
        total_daily_reward: DAILY_TASKS.reduce((sum, t) => sum + t.reward, 0) + (dailyBonus * DAILY_TASKS.length)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Daily tasks error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error fetching daily tasks' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request) {
  try {
    const { wallet_address, task_id } = await request.json();

    if (!isValidWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!DAILY_TASKS.find(t => t.id === task_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid task' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedWallet = wallet_address.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    // Fetch city
    const { data: city } = await supabaseAdmin
      .from('cities')
      .select('id, gole_balance, nft_balance')
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (!city) {
      return new Response(
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if already completed today
    const { data: existing } = await supabaseAdmin
      .from('daily_task_completions')
      .select('id')
      .eq('city_id', city.id)
      .eq('task_id', task_id)
      .gte('completed_at', `${today}T00:00:00`)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Task already completed today' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const task = DAILY_TASKS.find(t => t.id === task_id);
    const dailyBonus = getDailyBonusForTier(city.nft_balance);
    const totalReward = task.reward + dailyBonus;

    // Record completion
    await supabaseAdmin
      .from('daily_task_completions')
      .insert({
        city_id: city.id,
        task_id,
        reward_amount: totalReward
      });

    // Add reward to city balance
    const newBalance = city.gole_balance + totalReward;
    await supabaseAdmin
      .from('cities')
      .update({ gole_balance: newBalance })
      .eq('id', city.id);

    return new Response(
      JSON.stringify({
        ok: true,
        task: task.name,
        reward: totalReward,
        tier_bonus: dailyBonus,
        new_balance: newBalance
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Complete task error:', err);
    return new Response(
      JSON.stringify({ error: 'Server error completing task' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
