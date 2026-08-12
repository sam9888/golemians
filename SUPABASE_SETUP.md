# Supabase Setup

Run this once in your Supabase project's **SQL Editor** (Dashboard → SQL Editor → New query).
It creates the two tables the app needs and locks them down with Row Level
Security so the public can only ever INSERT a submission or READ aggregate
stats — never edit anyone else's data. All actual read/write from this app's
API routes goes through the **service role key** (`SUPABASE_SECRET_KEY`),
which bypasses RLS entirely, so these policies are a safety net in case the
tables are ever queried with the public anon key too.

```sql
-- =========================================================
-- submissions table
-- =========================================================
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  x_handle text not null,
  quote_link text not null,
  tweet_link text,
  wallet_address text not null,
  evm_address text not null,
  status text not null default 'pending',       -- pending | approved | allocated | rejected
  allocation numeric not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate wallets (case-insensitive already handled by storing
-- evm_address lowercase from the app, but this is a hard backstop).
create unique index if not exists submissions_evm_address_key
  on public.submissions (evm_address);

alter table public.submissions enable row level security;

-- The app's API routes use the SECRET key and bypass RLS automatically.
-- These policies only matter if something ever queries with the anon key.
drop policy if exists "public can insert" on public.submissions;
create policy "public can insert"
  on public.submissions for insert
  to anon
  with check (true);

-- No public SELECT/UPDATE/DELETE policy is created on purpose — the anon
-- key should not be able to read the full submissions list or edit rows.

-- =========================================================
-- project_stats table (lets you set a starting/legacy claimed count)
-- =========================================================
create table if not exists public.project_stats (
  id text primary key,
  base_claimed_count integer not null default 0,
  total_spots integer not null default 1200
);

insert into public.project_stats (id, base_claimed_count, total_spots)
values ('gtd', 0, 1200)
on conflict (id) do nothing;

alter table public.project_stats enable row level security;

drop policy if exists "public can read stats" on public.project_stats;
create policy "public can read stats"
  on public.project_stats for select
  to anon
  using (true);
```

## How the numbers work

- `project_stats.base_claimed_count` is a manual number you can set once
  (e.g. if you're carrying over 340 claims from a previous phase/platform).
  Set it directly in the table editor if you need it — it does **not**
  update automatically.
- The `/api/stats` route adds `base_claimed_count` + the count of
  `submissions` rows where `claimed = true` OR `status` is `approved`/`allocated`.
- Nothing on the public submission form ever changes these numbers. A
  submission only counts toward "claimed" once you approve it (see below).

## Approving a submission (granting a WL claim)

There is no admin UI yet — approve submissions with a request like this
(replace `YOUR_ADMIN_API_KEY` with the value from your `.env`, and either
`id` or `wallet`):

```bash
curl -X PATCH https://yourdomain.com/api/admin/submissions \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -d '{"wallet":"0xabc123...","status":"approved","allocation":1,"claimed":true}'
```

To see all submissions:

```bash
curl https://yourdomain.com/api/admin/submissions \
  -H "x-admin-key: YOUR_ADMIN_API_KEY"
```
