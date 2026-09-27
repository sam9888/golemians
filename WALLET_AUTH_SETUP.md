# Wallet Sign-In (Connect + Signature + Session) - Setup

## What this is (and isn't)

This is a **login proof**, not a payment flow. Connecting a wallet here:

- ✅ Requests `eth_requestAccounts` (MetaMask account access)
- ✅ Asks the wallet to `personal_sign` a short, human-readable message
- ✅ Verifies that signature server-side and issues a session cookie
- ✅ Reads NFT balance via a read-only `balanceOf()` call

It never:

- ❌ Requests `eth_sendTransaction`
- ❌ Requests a token/NFT `approve()`
- ❌ Calls `.transfer()` on any contract
- ❌ Takes custody of funds, tokens, or NFTs in any way

If you ever see a code path that does one of the above during "connect", that's a bug — flag it.

## Environment variable

Add to `.env` (and set in Vercel/production):

```
SESSION_SECRET=<a long random string, e.g. `openssl rand -hex 32`>
```

This signs the session cookie (`lib/session.js`, HMAC-SHA256). If it's unset, sign-in will fail loudly rather than silently trusting an unsigned session.

## Flow

1. **`GET /api/auth/nonce?wallet=0x..`** — server generates a one-time nonce (`lib/authNonce.js`, in-memory, 5 minute TTL) and returns a message like:
   ```
   Sign in to Golemians
   Wallet: 0x...
   Nonce: ...

   This signature only proves you control this wallet.
   It will NOT trigger a blockchain transaction, spend gas, or move any funds/tokens/NFTs.
   ```
2. **Wallet signs the message** via `personal_sign` (`lib/web3Connect.js`'s `signMessage`).
3. **`POST /api/auth/verify`** `{ wallet, signature }` — server recomputes the expected message, uses `ethers.verifyMessage()` to recover the signer, and compares it to the claimed wallet. On success it sets an httpOnly, `SameSite=Strict` cookie (`golemians_session`, 24h TTL) and consumes the nonce (single-use).
4. **State-changing routes** (`create-city`, `build-structure`, `claim-rewards`, `daily-tasks` (POST), `city/raid`, `pvp/claim-territory`, `pvp/create-match`, `pvp/play-match`) call `requireSessionResponse(request, wallet_address)` (`lib/session.js`) and reject with 401 if the session cookie doesn't prove ownership of the wallet in the request body. This closes the previous hole where anyone could type any address into a text box and act as that wallet.
5. **`POST /api/auth/logout`** clears the cookie.

## Frontend

`app/components/WalletConnect.jsx` drives steps 1-3 and is used by `CityBuilder.jsx` and `PvPGame.jsx` in place of the old manual "paste your address" text field.

## Notes

- Sessions are single-server in-memory for the nonce step (same pattern as `lib/rateLimit.js`) — fine for a single Vercel/Node instance; if you scale to multiple instances behind a load balancer without sticky sessions, move nonce storage to Supabase or Redis.
- Read-only routes (`get-city`, `city/map`, `pvp/realtime-map`, `pvp/verify-nft`, `pvp/leaderboard`, `daily-tasks` GET) intentionally do not require a session — they only expose public game state.
