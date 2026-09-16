# Real-time PvP Map with Territory Control - Setup

## Database Schema

Run this in Supabase **SQL Editor**:

```sql
-- =========================================================
-- territories: Player territory control
-- =========================================================
create table if not exists public.territories (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null unique references public.cities(id) on delete cascade,
  territory_radius integer not null default 10,  -- hex radius around city
  controlled_by uuid not null references public.cities(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists territories_controlled on public.territories(controlled_by);
create index if not exists territories_city on public.territories(city_id);

-- =========================================================
-- live_positions: Real-time player positions
-- =========================================================
create table if not exists public.live_positions (
  city_id uuid primary key references public.cities(id) on delete cascade,
  x_coordinate integer not null,
  y_coordinate integer not null,
  last_update timestamptz not null default now(),
  is_online boolean not null default true
);

create index if not exists positions_updated on public.live_positions(last_update);

alter table public.territories enable row level security;
alter table public.live_positions enable row level security;

drop policy if exists "public can read territories" on public.territories;
create policy "public can read territories"
  on public.territories for select
  to anon
  using (true);

drop policy if exists "public can read positions" on public.live_positions;
create policy "public can read positions"
  on public.live_positions for select
  to anon
  using (true);
```

## Map System

### Proximity-Based Raids
- Players can **only raid cities within 15 hex distance**
- Closer cities = stronger raid bonus
- Distance calculation: `sqrt((x2-x1)² + (y2-y1)²)`

### Territory Control
- Each city controls a **10-hex radius territory**
- Overlapping territories = conflict zones
- Controlling territory = +1% daily $GOLE bonus per hex

### Real-time Updates
- Position updates every 30 seconds
- Shows online/offline status
- Live enemy proximity alerts

### Map Grid
- **100x100 hexagonal grid**
- Each player spawns at random location
- Can expand territory by capturing nearby cities
- Fog of war: only see nearby cities (15 hex)

## Raid Mechanics (Updated)

### Before: Can raid anyone
### After: Can ONLY raid nearby cities

**Distance Brackets:**
- 0-5 hex: +50% raid damage
- 6-10 hex: +25% raid damage
- 11-15 hex: Normal damage
- 16+ hex: CANNOT RAID

**Territory Bonus:**
- Control 10 hexes → +10% daily $GOLE
- Control 50 hexes → +50% daily $GOLE
- Control 100+ hexes → +100% daily $GOLE (max)

## Real-time Features

1. **Live Position Tracking**
   - Updates every 30 seconds
   - Shows which players are online
   - Alert when enemies approach

2. **Territory Expansion**
   - Raid nearby city → capture territory
   - Territory grows with each conquest
   - Other players can counter-attack

3. **Proximity Chat** (future)
   - Message players in your territory
   - Form alliances or declare wars

## API Endpoints

- `GET /api/pvp/map` - Get live positions + territories
- `POST /api/pvp/territory/claim` - Claim territory after raid
- `GET /api/pvp/proximity` - Get nearby enemies
- `POST /api/city/raid` - Updated to check proximity
