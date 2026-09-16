# $GOLE Token System - Supabase Setup

Run this in your Supabase **SQL Editor** to update for $GOLE tokens.

```sql
-- =========================================================
-- Update cities table: Replace resources with $GOLE balance
-- =========================================================
alter table if exists public.cities 
  drop column if exists resources;

alter table public.cities 
  add column if not exists gole_balance bigint not null default 0,
  add column if not exists gole_claimed_at timestamptz default now();

-- =========================================================
-- gole_token_pool: Track total emission & rewards
-- =========================================================
create table if not exists public.gole_token_pool (
  id text primary key default 'main',
  total_supply bigint not null default 1000000000,  -- 1 billion
  distributed bigint not null default 0,
  daily_emission_rate numeric not null default 0.05,  -- 5% per day
  last_emission_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.gole_token_pool (id, total_supply, daily_emission_rate)
values ('main', 1000000000, 0.05)
on conflict (id) do nothing;

-- =========================================================
-- gole_rewards: Track daily reward claims
-- =========================================================
create table if not exists public.gole_rewards (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  reward_amount bigint not null,
  claimed_at timestamptz not null default now()
);

create index if not exists gole_rewards_city on public.gole_rewards(city_id);
create index if not exists gole_rewards_date on public.gole_rewards(claimed_at);

-- =========================================================
-- Update structures: Remove wood/food, only generate $GOLE
-- =========================================================
-- If you have existing structures, you can migrate them or drop
drop table if exists public.structures cascade;

create table if not exists public.structures (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  structure_type text not null,           -- 'generator', 'wall', 'tower'
  level integer not null default 1,
  gole_production_rate bigint default 0, -- $GOLE per day per level
  defense_value integer default 0,       -- for walls/towers
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists structures_city on public.structures(city_id);

-- =========================================================
-- Enable RLS
-- =========================================================
alter table public.gole_token_pool enable row level security;
alter table public.gole_rewards enable row level security;

-- Allow public to read pool stats
drop policy if exists "public can read pool" on public.gole_token_pool;
create policy "public can read pool"
  on public.gole_token_pool for select
  to anon
  using (true);

-- Allow reading rewards
drop policy if exists "public can read rewards" on public.gole_rewards;
create policy "public can read rewards"
  on public.gole_rewards for select
  to anon
  using (true);
```

## How It Works

### **$GOLE Token Mechanics**
- **Total Supply**: 1,000,000,000 ($GOLE)
- **Daily Yield**: 5% per day (players earn % of their holdings)
- **Claim System**: Players claim daily rewards from structures
- **Raids**: Steal $GOLE from opponent cities

### **$GOLE Generation**
1. Player builds structures (Generator, Wall, Tower)
2. Each structure generates $GOLE per day based on level:
   - Generator Level 1: 1,000 $GOLE/day
   - Generator Level 2: 2,000 $GOLE/day
   - etc.
3. Player claims rewards daily → adds to balance
4. Claimed $GOLE is deducted from emission pool

### **Daily Reward Formula**
```
Daily Reward = City's $GOLE Balance × Daily Emission Rate (5%)
```
- Example: If you hold 1,000,000 $GOLE → earn 50,000/day
- Claim once per 24 hours
- Compounds over time

## Token Contract (Later)
When you add liquidity:
```
Contract: 0x...
Symbol: $GOLE
Decimals: 18
Total Supply: 1,000,000,000
```
