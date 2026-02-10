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
  updateLeaderboard,
  type TimeFilter,
  type LeaderboardEntry,
  type LeaderboardResult,
} from './leaderboard';

// Shop
export {
  getShopProducts,
  getProductById,
  createPurchase,
  completePurchase,
  getPurchaseById,
  getPendingPurchase,
  getUserPurchases,
  failPurchase,
  getUserStarTickets,
  type ShopProduct,
  type Purchase,
  type CreatePurchaseInput,
} from './shop';

// Quests
export {
  getQuestsForUser,
  updateQuestProgress,
  claimQuestReward,
  calculateProgress,
  syncQuestProgress,
  type Quest,
  type UserQuest,
  type QuestWithProgress,
  type QuestsResult,
  type ClaimResult,
} from './quests';
