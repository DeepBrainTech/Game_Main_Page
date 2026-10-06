/**
 * User-facing API barrel: re-exports domain modules for backward-compatible imports.
 */
export { getUserTimezone } from "@/services/apiClient";

export type { UserNotificationData } from "@/services/notificationsApi";
export {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationsApi";

export type { RewardsData } from "@/services/rewardsApi";
export { fetchRewards, postCheckIn, claimTask, fetchAssets } from "@/services/rewardsApi";

export type { CognitiveScoresData } from "@/services/cognitiveApi";
export { fetchCognitiveScores, updateCognitiveScores } from "@/services/cognitiveApi";

export { fetchShopItems, fetchShopInventory, redeemShopItem } from "@/services/shopApi";

export type {
  HomeSystemCost,
  HomeSystemData,
  HomeSystemItem,
  HomeSystemLoadout,
  HomeSystemSlot,
  HomeSystemTier,
} from "@/types/homeSystem";
export {
  fetchHomeSystem,
  redeemHomeSystemItem,
  updateHomeSystemLoadout,
} from "@/services/homeSystemApi";

export type { GameLikeState } from "@/services/gamesApi";
export { postGamePlayedRecord, fetchGameLikes, likeGame, unlikeGame } from "@/services/gamesApi";

export type { LeaderboardEntry } from "@/services/leaderboardApi";
export { fetchLeaderboard } from "@/services/leaderboardApi";

export {
  membershipErrorKeyFromDetail,
  createStripeCheckoutSession,
  createDiamondCheckoutSession,
  createCoinCheckoutSession,
  createStripeBillingPortalSession,
  changeStripeSubscription,
  cancelScheduledStripeSubscriptionChange,
  previewStripeSubscriptionChange,
  createStripePaymentMethodSetup,
  updateStripeSubscriptionPaymentMethod,
  fetchBillingStatus,
} from "@/services/billingApi";
export type { StripeSubscriptionChangePreview } from "@/services/billingApi";

export type { CurrentUserProfile, AuthMeMembership } from "@/services/authApi";
export { fetchAuthMeMembership, fetchCurrentUserProfile } from "@/services/authApi";

export type {
  MakingWholeQuestionVideoResponse,
  MentalMathBundleAccessData,
  LearningTopicProgressData,
  LearningModuleProgressData,
  LearningSubjectProgressModuleData,
  LearningSubjectProgressData,
  LearningStudyTimeData,
} from "@/services/learningApi";
export {
  fetchMentalMathBundleAccess,
  unlockMentalMathWithDiamonds,
  fetchMakingWholeQuestionVideo,
  fetchLearningModuleProgress,
  recordLearningQuestionAttempt,
  resetLearningTopicProgress,
  fetchLearningSubjectProgress,
  upsertLearningPracticeReport,
  fetchLearningPracticeReport,
  fetchLearningPracticeReportHistory,
  fetchLearningPracticeReportById,
  fetchLearningStudyTime,
  recordLearningStudyTime,
} from "@/services/learningApi";

export type {
  AssessmentTopicStatPayload,
  AssessmentAnswerPayload,
  AssessmentSessionPayload,
  AssessmentSessionSummary,
  AssessmentSessionDetail,
  AssessmentCompareResult,
  AssessmentTrendPoint,
} from "@/services/assessmentApi";
export {
  createAssessmentSession,
  fetchAssessmentHistory,
  fetchAssessmentDetail,
  compareAssessmentSessions,
  fetchAssessmentTrend,
} from "@/services/assessmentApi";
