# PvP NFT Token-Stealing Game Setup

Run this in your Supabase **SQL Editor** to create the PvP tables.

```sql
-- =========================================================
-- pvp_players: Track player NFT holdings and stats
-- =========================================================
create table if not exists public.pvp_players (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  nft_balance integer not null default 0,
  tokens_held integer not null default 0,
  total_wins integer not null default 0,
  total_losses integer not null default 0,
  total_tokens_won integer not null default 0,
  total_tokens_lost integer not null default 0,
  last_match_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pvp_players_wallet on public.pvp_players(wallet_address);
create index if not exists pvp_players_stats on public.pvp_players(total_wins DESC, total_tokens_won DESC);

-- =========================================================
-- pvp_matches: Track each duel
-- =========================================================
create table if not exists public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid not null references public.pvp_players(id) on delete cascade,
  player2_id uuid not null references public.pvp_players(id) on delete cascade,
  winner_id uuid references public.pvp_players(id) on delete set null,
  stake_amount integer not null default 1,
  status text not null default 'active',           -- active | completed | draw
  player1_final_step integer default 0,
  player2_final_step integer default 0,
  tokens_transferred integer default 0,
  match_data jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists pvp_matches_players on public.pvp_matches(player1_id, player2_id);
create index if not exists pvp_matches_winner on public.pvp_matches(winner_id);
create index if not exists pvp_matches_status on public.pvp_matches(status);

-- =========================================================
-- pvp_token_transfers: Audit log of token transfers
-- =========================================================
create table if not exists public.pvp_token_transfers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pvp_matches(id) on delete cascade,
  from_player_id uuid not null references public.pvp_players(id) on delete cascade,
  to_player_id uuid not null references public.pvp_players(id) on delete cascade,
  amount integer not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists pvp_transfers_match on public.pvp_token_transfers(match_id);
create index if not exists pvp_transfers_players on public.pvp_token_transfers(from_player_id, to_player_id);

-- =========================================================
-- Enable RLS
-- =========================================================
alter table public.pvp_players enable row level security;
alter table public.pvp_matches enable row level security;
alter table public.pvp_token_transfers enable row level security;

-- RLS policies: public can only read leaderboard and their own data
drop policy if exists "public can read leaderboard" on public.pvp_players;
create policy "public can read leaderboard"
  on public.pvp_players for select
  to anon
  using (true);

drop policy if exists "public can read own data" on public.pvp_players;
create policy "public can read own data"
  on public.pvp_players for select
  to authenticated
  using (wallet_address = current_user_id());

drop policy if exists "public can read match results" on public.pvp_matches;
create policy "public can read match results"
  on public.pvp_matches for select
  to anon
  using (true);
```

## Configuration

Add to your `.env`:
```
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x... (your Robin Hood 4444 collection contract address)
NEXT_PUBLIC_NFT_CHAIN_ID=1 (Ethereum mainnet)
NFT_VERIFICATION_MIN_BALANCE=10
```

## How It Works

1. **Connect Wallet**: Player connects EVM wallet
2. **Verify NFT**: Backend calls Ethers to check NFT balance ≥ 10
3. **Create Match**: Player1 challenges Player2 (both must have 10+ NFTs)
4. **Duel**: Both climb the ladder simultaneously, stake tokens at risk
5. **Winner Takes**: Loser's staked tokens transfer to winner
6. **Leaderboard**: Ranked by wins + tokens stolen
