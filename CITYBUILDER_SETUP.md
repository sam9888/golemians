# City Builder Game - Supabase Setup

Run this in your Supabase **SQL Editor** to create the city-building game tables.

```sql
-- =========================================================
-- cities: Player cities on the global map
-- =========================================================
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  city_name text not null default 'My City',
  nft_balance integer not null default 0,
  x_coordinate integer not null,
  y_coordinate integer not null,
  resources jsonb default '{"gold": 0, "wood": 0, "food": 0}',
  total_strength integer not null default 0,
  last_attacked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cities_wallet on public.cities(wallet_address);
create index if not exists cities_location on public.cities(x_coordinate, y_coordinate);
create index if not exists cities_strength on public.cities(total_strength DESC);

-- =========================================================
-- structures: Buildings in each city
-- =========================================================
create table if not exists public.structures (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  structure_type text not null,           -- 'goldmine', 'lumbermill', 'farm', 'wall', 'tower'
  level integer not null default 1,
  production_rate integer default 0,      -- gold/wood/food per hour
  defense_value integer default 0,        -- for walls/towers
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists structures_city on public.structures(city_id);
create index if not exists structures_type on public.structures(structure_type);

-- =========================================================
-- golemians: NFT units assigned to cities
-- =========================================================
create table if not exists public.golemians (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  nft_id text unique not null,            -- unique token ID from contract
  power integer not null default 1,       -- combat power
  status text not null default 'idle',    -- idle, defending, attacking
  assigned_to_raid_id uuid references public.raids(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists golemians_city on public.golemians(city_id);
create index if not exists golemians_status on public.golemians(status);

-- =========================================================
-- raids: PvP attacks between cities
-- =========================================================
create table if not exists public.raids (
  id uuid primary key default gen_random_uuid(),
  attacker_city_id uuid not null references public.cities(id) on delete cascade,
  defender_city_id uuid not null references public.cities(id) on delete cascade,
  attacker_strength integer not null default 0,
  defender_strength integer not null default 0,
  resources_stolen jsonb default '{"gold": 0, "wood": 0, "food": 0}',
  status text not null default 'active',  -- active, success, defended, draw
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists raids_attacker on public.raids(attacker_city_id);
create index if not exists raids_defender on public.raids(defender_city_id);
create index if not exists raids_status on public.raids(status);

-- =========================================================
-- resource_production: Track passive resource generation
-- =========================================================
create table if not exists public.resource_production (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade unique,
  last_collected_at timestamptz not null default now(),
  total_gold_produced integer not null default 0,
  total_wood_produced integer not null default 0,
  total_food_produced integer not null default 0
);

create index if not exists production_city on public.resource_production(city_id);

-- =========================================================
-- Enable RLS
-- =========================================================
alter table public.cities enable row level security;
alter table public.structures enable row level security;
alter table public.golemians enable row level security;
alter table public.raids enable row level security;
alter table public.resource_production enable row level security;

-- Allow public to see cities on map
drop policy if exists "public can read cities" on public.cities;
create policy "public can read cities"
  on public.cities for select
  to anon
  using (true);

-- Allow public to see structures
drop policy if exists "public can read structures" on public.structures;
create policy "public can read structures"
  on public.structures for select
  to anon
  using (true);

-- Allow public to see raids
drop policy if exists "public can read raids" on public.raids;
create policy "public can read raids"
  on public.raids for select
  to anon
  using (true);
```

## Game Mechanics

- **Cities**: Each player gets one city on a global map (random coordinates)
- **Resources**: Gold, Wood, Food generated by structures (hourly passive generation)
- **Golemians**: Each NFT is a unit with combat power. Assign to defend or raid
- **Structures**: Build generators (goldmine, lumbermill, farm) or defenses (walls, towers)
- **Raids**: Attack other cities, steal resources. Golemians provide attack/defense power
- **Map**: Global grid where players see all cities, can choose targets to raid
