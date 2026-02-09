/**
 * Database Queries - Central Export
 */

// Game Records
export {
  createGameRecord,
  getGameRecordsByUser,
  getUserHighScore,
  getUserIdByWallet,
  getActiveSeason,
  getUserTotalClub,
  type CreateGameRecordInput,
  type GameRecordResult,
} from './game-records';

// Tickets
export {
  checkTicketStatus,
  useTicket,
  getTicketUsageSummary,
  getTodayDate,
  addTickets,
  type TicketStatus,
  type UseTicketResult,
} from './tickets';

// Leaderboard
export {
  getLeaderboard,
  getTopPlayers,
  getUserRank,
  type TimeFilter,
  type LeaderboardEntry,
  type LeaderboardResult,
} from './leaderboard';
