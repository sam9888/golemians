# Golemians: Last One Standing — Setup

Run this in your Supabase **SQL Editor** to create the arena tables.

```sql
-- =========================================================
-- arena_players: GLM balance + verified holder status per wallet
-- =========================================================
create table if not exists public.arena_players (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  glm_balance integer not null default 0,
  verified_golem_count integer not null default 0,
  last_ownership_check timestamptz,
  last_daily_claim_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arena_players_wallet on public.arena_players(wallet_address);
create index if not exists arena_players_balance on public.arena_players(glm_balance DESC);

-- =========================================================
-- arena_matches: One row per completed match
-- =========================================================
create table if not exists public.arena_matches (
  id uuid primary key,
  map_id text not null default 'great-collapse',
  status text not null default 'completed',        -- completed (only status reported today)
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  winner_wallet text,
  winner_token_id integer,
  created_at timestamptz not null default now()
);

create index if not exists arena_matches_winner on public.arena_matches(winner_wallet);
create index if not exists arena_matches_created on public.arena_matches(created_at DESC);

-- =========================================================
-- arena_match_participants: Per-player result within a match
-- =========================================================
create table if not exists public.arena_match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.arena_matches(id) on delete cascade,
  wallet_address text not null,
  token_id integer,
  entry_amount integer not null default 0,
  placement integer,                                -- 1 = winner, 2 = runner-up, ...
  eliminated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists arena_participants_match on public.arena_match_participants(match_id);
create index if not exists arena_participants_wallet on public.arena_match_participants(wallet_address);

-- =========================================================
-- arena_glm_ledger: Append-only audit log of every GLM movement
-- =========================================================
create table if not exists public.arena_glm_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  amount integer not null,                          -- positive = credit, negative = debit
  reason text not null,                              -- daily_claim | match_entry | match_win | refund
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arena_ledger_wallet on public.arena_glm_ledger(wallet_address);
create index if not exists arena_ledger_created on public.arena_glm_ledger(created_at DESC);

-- =========================================================
-- character_registry: token_id -> generated Golem name
-- Populated later from a reviewed scripts/generate-golem-names.mjs export,
-- never auto-imported. Until a row exists for a token_id, the client falls
-- back to displaying "GOLEM #<tokenId>".
-- =========================================================
create table if not exists public.character_registry (
  token_id integer primary key,
  character_name text unique not null,
  assigned_at timestamptz not null default now()
);

-- =========================================================
-- Enable RLS
-- =========================================================
alter table public.arena_players enable row level security;
alter table public.arena_matches enable row level security;
alter table public.arena_match_participants enable row level security;
alter table public.arena_glm_ledger enable row level security;
alter table public.character_registry enable row level security;

-- RLS policies: public can read leaderboard-ish data only. All writes go
-- through the Next.js API routes using the service-role key, which bypasses
-- RLS entirely — these policies only govern direct anon/client reads.
drop policy if exists "public can read leaderboard" on public.arena_players;
create policy "public can read leaderboard"
  on public.arena_players for select
  to anon
  using (true);

drop policy if exists "public can read match results" on public.arena_matches;
create policy "public can read match results"
  on public.arena_matches for select
  to anon
  using (true);

drop policy if exists "public can read match participants" on public.arena_match_participants;
create policy "public can read match participants"
  on public.arena_match_participants for select
  to anon
  using (true);
```

## Configuration

Add to your `.env` (Vercel/Next.js side):
```
GAME_SERVER_SECRET=              # shared secret; also set on the Fly.io game-server
NEXT_PUBLIC_GAME_SERVER_URL=     # wss://your-app.fly.dev once deployed
```

Add to `game-server/.env` (Fly.io side — see `game-server/.env.example`):
```
GAME_SERVER_SECRET=              # must match the Vercel value above, byte for byte
ARENA_SETTLE_URL=                # https://your-vercel-app.vercel.app/api/arena/settle
ARENA_REFUND_URL=                # optional; defaults to ARENA_SETTLE_URL's sibling /refund
PORT=2567
```

## How It Works

1. **Connect Wallet**: Player connects EVM wallet, signs in (existing session system).
2. **Verify Holder Status**: `/api/arena/enter` checks live on-chain `balanceOf` ≥ 10 Golemians.
3. **Debit Entry Fee**: 500 GLM debited from `arena_players.glm_balance`, logged to `arena_glm_ledger`.
4. **Mint Join Token**: A short-lived, single-use signed token is returned; the client uses it to authenticate its WebSocket connection to the Fly.io match server — the match server never talks to Supabase directly.
5. **Play**: Up to 8 players battle in real time on the match server; tiles collapse in phases until one player remains.
6. **Settle**: The match server reports final standings to `/api/arena/settle` (authenticated via `GAME_SERVER_SECRET`), which records the match and credits the winner 3,000 GLM.
7. **Refund**: If a player leaves the lobby before the match starts, the match server calls `/api/arena/refund` (same `GAME_SERVER_SECRET` auth) and the entry fee is returned. The route re-derives the amount from the original `match_entry` ledger row rather than trusting the request, and is idempotent per `entryId`, so a retried or duplicated leave event cannot pay twice. Once the match starts the fees are non-refundable — leaving mid-match is an elimination.
8. **Daily Claim**: Any verified 10+ holder can claim 1,000 GLM every 24h via `/api/arena/claim-daily`, independent of playing a match.

## Known limitations (Phase 1)

- `token_id` submitted at entry is **self-reported**, not cryptographically verified against on-chain ownership of that specific token — only the wallet's aggregate NFT balance is checked. This matches the existing `/api/pvp/verify-nft` trust model (balance-only, no `ownerOf` check).
- The refund path covers leaving the lobby. It does **not** cover a player whose entry fee was debited but whose WebSocket never reached the match server at all — the match server never sees that `entryId`, so it cannot report it, and the client's own claim can't be trusted. Those are rare and currently need manual reconciliation from the `arena_glm_ledger` (a `match_entry` row with no matching `arena_match_participants` row and no `refund`).
- `character_registry` starts empty. Run `scripts/generate-golem-names.mjs`, review the generated `golemians-characters.json`/`.csv`, and confirm the token ID numbering (0-indexed vs 1-indexed) matches the real contract before importing any rows.
