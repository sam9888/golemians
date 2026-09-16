# Daily Tasks & NFT Tier System - Database Setup

Run this in your Supabase **SQL Editor** to add daily tasks support.

```sql
-- =========================================================
-- daily_task_completions: Track completed daily tasks
-- =========================================================
create table if not exists public.daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  task_id text not null,
  reward_amount bigint not null,
  completed_at timestamptz not null default now()
);

create index if not exists daily_tasks_city on public.daily_task_completions(city_id);
create index if not exists daily_tasks_date on public.daily_task_completions(completed_at);
create index if not exists daily_tasks_unique on public.daily_task_completions(city_id, task_id, completed_at);

alter table public.daily_task_completions enable row level security;

drop policy if exists "public can read tasks" on public.daily_task_completions;
create policy "public can read tasks"
  on public.daily_task_completions for select
  to anon
  using (true);
```

## NFT Tier System

### Tier Badges & Daily Bonuses

```
Tier        | NFTs    | Badge | Daily Bonus | Battle Bonus | Description
------------|---------|-------|-------------|--------------|--------------------
Initiate    | 10-14   | ⚔️   | 500 $GOLE  | 1.0x (1%)   | Entry level
Warrior     | 15-24   | 🗡️   | 1,000 $GOLE | 1.25x (25%) | Seasoned fighter
Guardian    | 25-49   | 🛡️   | 2,500 $GOLE | 1.5x (50%)  | Protector
Lord        | 50-99   | 👑   | 5,000 $GOLE | 2.0x (100%) | Master of armies
Titan       | 100+    | ⚡   | 10,000 $GOLE | 3.0x (300%) | Legendary force
```

## Daily Tasks

Each task can be completed once per day:
- 🏗️ **Build Structure** - 100 $GOLE + tier bonus
- 💰 **Claim Daily Rewards** - 200 $GOLE + tier bonus
- ⚔️ **Launch Raid** - 150 $GOLE + tier bonus
- 🛡️ **Defend City** - 250 $GOLE + tier bonus

**Total daily reward**: 700 $GOLE + (tier bonus × 4)

Example: Warrior with 15 NFTs = 700 + (1,000 × 4) = 4,700 $GOLE/day

## How It Works

1. **Daily Tasks**: Players complete 1-4 tasks per day
2. **NFT Tiers**: More NFTs = higher tier = more rewards
3. **Battle Advantage**: Higher tier = better odds in PvP raids
4. **Progression**: Build structures → Generate tokens → Earn more rewards → Climb tiers

## Web3 Integration

Players must:
1. Connect MetaMask wallet
2. Verify 10+ Golemians ownership (on-chain check)
3. Sign message for authentication
4. Start playing with tier-based rewards
