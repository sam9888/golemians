# $GOLE Token Contract - Robin Hood Launchpad

## Current Setup (In-Game Tokens)
- Fully playable with in-game $GOLE economy
- 1 billion supply tracked in database
- No real blockchain yet

## After Robin Hood Launchpad Launch

### 1. **Deploy on Robin Hood Launchpad**
- Standard ERC20 token
- Symbol: `$GOLE`
- Name: `Golemians Token`
- Total Supply: 1,000,000,000 (1B)
- Decimals: 18
- Contract address: `0x...` (Robin Hood will provide)

### 2. **Add to Game Configuration**

Update `.env`:
```
NEXT_PUBLIC_GOLE_TOKEN_CONTRACT=0x...  (from Robin Hood)
NEXT_PUBLIC_GOLE_CHAIN_ID=1            (Ethereum mainnet)
NEXT_PUBLIC_GOLE_DECIMALS=18
```

### 3. **Connect In-Game Rewards to Token Contract**

Two options:

#### **Option A: Claim & Bridge** (Recommended)
- Players claim $GOLE in-game
- Bridge function to transfer to ERC20 contract
- Keep game economy separate but connected

#### **Option B: Sync on Claim**
- When player claims rewards, automatically mint/transfer ERC20
- Requires contract with minter role
- More integrated but requires contract changes

### 4. **Contract Requirements**

```solidity
// Contract should have:
- mint(address to, uint256 amount) - Only from game contract
- balanceOf(address) - Check holdings
- transfer(address to, uint256 amount) - Player transfers
- approve(address spender, uint256 amount) - Approvals for trading

// Game contract address needs MINTER_ROLE
```

### 5. **Safe Integration Steps**

1. **Deploy token** on Robin Hood
2. **Add contract address** to `.env`
3. **Create bridge function** in game
4. **Test on testnet** first
5. **Audit before mainnet**
6. **Migration plan** for existing players

### 6. **Player Flow**

```
In-Game Play
  ↓
Build structures → Earn $GOLE
  ↓
Claim daily rewards
  ↓
$GOLE in game wallet
  ↓
[NEW] Bridge to ERC20
  ↓
Real $GOLE in MetaMask
  ↓
Trade/Sell on DEX
```

### 7. **Security Checklist**

- [ ] Contract audited
- [ ] Testnet deployed & verified
- [ ] Bridge contract tested
- [ ] Rate limits on claims
- [ ] Migration plan documented
- [ ] Player communication ready

## Current Status
✅ In-game economy ready
✅ Reward system functional
✅ Database schema supports token tracking
⏳ Waiting for token contract deployment on Robin Hood

## Next Actions
1. Deploy token on Robin Hood Launchpad
2. Get contract address
3. Update `.env` with contract details
4. Deploy bridge/claim function
5. Launch to mainnet
