// PvP NFT Token Stealing Game Logic

export const NFT_MIN_BALANCE = 10;
export const DEFAULT_STAKE = 5; // tokens per match

export function isValidWallet(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

// Match result determination: both players climb simultaneously
// Winner = whoever reaches higher step (or stays in if both reach same step)
// On tie, split the pot, or no transfer
export function determineMatchWinner(player1Step, player2Step) {
  if (player1Step > player2Step) return 'player1';
  if (player2Step > player1Step) return 'player2';
  return 'tie'; // both reached same step
}

// Leaderboard rank calculation: wins, then tokens won
export function rankPlayers(players) {
  return [...players]
    .sort((a, b) => {
      if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
      return b.total_tokens_won - a.total_tokens_won;
    })
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

// Calculate tokens transferred (loser to winner)
export function calculateTokenTransfer(loserBalance, stakeAmount) {
  // Winner takes min(stake, loser's balance) to prevent overdrafts
  return Math.min(stakeAmount, Math.max(loserBalance, 0));
}
