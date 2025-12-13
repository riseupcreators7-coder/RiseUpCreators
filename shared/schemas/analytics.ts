import { z } from "zod";
import { ObjectIdType } from "./common";

// -----------------------------
// 🔹 Analytics Schema
// -----------------------------
export const analyticsSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType.optional(),   // Reference to User
  artistId: ObjectIdType.optional(), // Reference to User (role=artist)
  songId: ObjectIdType.optional(),   // Reference to Song
  merchId: ObjectIdType.optional(),  // Reference to Merch
  eventId: ObjectIdType.optional(),  // Reference to Event
  subscriptionId: ObjectIdType.optional(), // Reference to Subscription
  orderId: ObjectIdType.optional(),  // Reference to Order
  adId: ObjectIdType.optional(),     // Reference to Ad
  action: z.enum([
    "play", "like", "share", "purchase", "review", "follow", "unfollow", "subscribe",
    "ad_impression", "ad_click", "ad_complete", "search", "view", "signup", "login",
    "download", "share_social", "add_to_playlist", "remove_from_playlist",
    "create_playlist", "follow_artist", "unfollow_artist", "rate_song",
    "comment", "reply", "report", "block", "unblock", "upgrade_premium",
    "cancel_subscription", "renew_subscription", "refund", "return_request",
    "order_placed", "order_cancelled", "payment_success", "payment_failed",
    "event_registration", "event_attendance", "merch_view", "blog_view",
    "profile_view", "discover_browse", "genre_filter", "mood_filter",
    "create_song", "create_blog", "create_event", "create_merch",
    "subscription_payment", "merch_sale", "event_ticket_sale", "ad_revenue",
    // Fan Club & DAO actions
    "fan_club_join", "fan_club_leave", "fan_club_post", "fan_club_comment",
    "dao_proposal_create", "dao_proposal_vote", "dao_proposal_pass", "dao_proposal_fail",
    "dao_token_earned", "dao_token_spent", "dao_governance_participate",
    // Cross-chain actions
    "cross_chain_transfer", "cross_chain_bridge", "cross_chain_swap",
    // Loyalty & Gamification
    "loyalty_points_earned", "loyalty_points_spent", "achievement_unlocked",
    "badge_earned", "level_up", "streak_maintained", "quest_completed"
  ]),
  context: z.enum([
    "home", "profile", "discover", "player", "cart", "admin", "checkout",
    "search_results", "playlist", "artist_page", "song_details", "event_details",
    "merch_store", "blog_post", "settings", "notifications", "favorites",
    "library", "trending", "new_releases", "top_charts", "recommendations",
    "social_feed", "messages", "help", "about"
  ]),
  value: z.number().optional(), // For quantitative metrics (play duration, purchase amount, etc.)
  metadata: z.record(z.any()).default({}), // Additional context-specific data
  sessionId: z.string().optional(), // For session tracking
  deviceInfo: z.object({
    type: z.enum(["mobile", "desktop", "tablet"]).optional(),
    os: z.string().optional(),
    browser: z.string().optional(),
    userAgent: z.string().optional()
  }).optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    ip: z.string().optional()
  }).optional(),
  timestamp: z.date().default(() => new Date())
});

export const insertAnalyticsSchema = analyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 User Session Schema (for DAU/MAU tracking)
// -----------------------------
export const userSessionSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType,
  sessionId: z.string(),
  startTime: z.date(),
  endTime: z.date().optional(),
  duration: z.number().optional(), // in seconds
  pageViews: z.number().default(0),
  actions: z.array(z.string()).default([]), // List of actions in this session
  deviceInfo: z.object({
    type: z.string().optional(),
    os: z.string().optional(),
    browser: z.string().optional()
  }).optional(),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional()
  }).optional(),
  isActive: z.boolean().default(true)
});

export const insertUserSessionSchema = userSessionSchema.omit({ _id: true });

// -----------------------------
// 🔹 Search Analytics Schema
// -----------------------------
export const searchAnalyticsSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType.optional(),
  query: z.string(),
  filters: z.record(z.any()).default({}), // genre, artist, year, etc.
  resultsCount: z.number(),
  clickedResults: z.array(z.object({
    itemId: ObjectIdType,
    itemType: z.enum(["song", "artist", "album", "playlist"]),
    position: z.number()
  })).default([]),
  timeToClick: z.number().optional(), // seconds
  sessionId: z.string().optional(),
  timestamp: z.date().default(() => new Date())
});

export const insertSearchAnalyticsSchema = searchAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Subscription Analytics Schema
// -----------------------------
export const subscriptionAnalyticsSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType,
  subscriptionId: ObjectIdType,
  artistId: ObjectIdType,
  tier: z.enum(["bronze", "silver", "gold"]),
  action: z.enum(["subscribed", "renewed", "cancelled", "expired", "upgraded", "downgraded"]),
  amount: z.number(),
  currency: z.string().default("INR"),
  period: z.object({
    start: z.date(),
    end: z.date()
  }),
  paymentMethod: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertSubscriptionAnalyticsSchema = subscriptionAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 E-commerce Analytics Schema
// -----------------------------
export const ecommerceAnalyticsSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType,
  orderId: ObjectIdType,
  type: z.enum(["merch", "event_ticket"]),
  items: z.array(z.object({
    itemId: ObjectIdType,
    itemType: z.enum(["merch", "event"]),
    quantity: z.number(),
    price: z.number(),
    discount: z.number().default(0)
  })),
  totalAmount: z.number(),
  currency: z.string().default("INR"),
  status: z.enum(["placed", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
  paymentStatus: z.enum(["pending", "completed", "failed", "refunded"]),
  shippingAddress: z.record(z.any()).optional(),
  metadata: z.record(z.any()).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertEcommerceAnalyticsSchema = ecommerceAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Content Performance Schema
// -----------------------------
export const contentPerformanceSchema = z.object({
  _id: ObjectIdType,
  contentId: ObjectIdType,
  contentType: z.enum(["song", "album", "playlist", "blog", "event", "merch"]),
  artistId: ObjectIdType.optional(),
  metrics: z.object({
    views: z.number().default(0),
    uniqueViews: z.number().default(0),
    plays: z.number().default(0),
    uniqueListeners: z.number().default(0),
    likes: z.number().default(0),
    shares: z.number().default(0),
    comments: z.number().default(0),
    saves: z.number().default(0),
    downloads: z.number().default(0),
    revenue: z.number().default(0),
    engagementRate: z.number().default(0) // calculated field
  }),
  trending: z.object({
    score: z.number().default(0),
    rank: z.number().optional(),
    lastCalculated: z.date().optional()
  }).default({}),
  demographics: z.object({
    ageGroups: z.record(z.number()).default({}),
    genders: z.record(z.number()).default({}),
    countries: z.record(z.number()).default({}),
    devices: z.record(z.number()).default({})
  }).default({}),
  lastUpdated: z.date().default(() => new Date())
});

export const insertContentPerformanceSchema = contentPerformanceSchema.omit({ _id: true, lastUpdated: true });



// -----------------------------
// 🔹 Fan Club Analytics Schema
// -----------------------------
export const fanClubAnalyticsSchema = z.object({
  _id: ObjectIdType,
  fanClubId: ObjectIdType,
  artistId: ObjectIdType,
  userId: ObjectIdType.optional(),
  action: z.enum([
    "fan_club_join", "fan_club_leave", "fan_club_post", "fan_club_comment",
    "fan_club_like", "fan_club_share", "fan_club_content_unlock",
    "fan_club_exclusive_access", "fan_club_merch_discount", "fan_club_event_priority"
  ]),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
  value: z.number().optional(), // Revenue, engagement score, etc.
  metadata: z.object({
    contentId: ObjectIdType.optional(),
    contentType: z.string().optional(),
    engagementType: z.string().optional(),
    timeSpent: z.number().optional(), // seconds
    assetsOwned: z.array(ObjectIdType).optional() // Digital assets owned by user
  }).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertFanClubAnalyticsSchema = fanClubAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 DAO Analytics Schema
// -----------------------------
export const daoAnalyticsSchema = z.object({
  _id: ObjectIdType,
  daoId: ObjectIdType,
  userId: ObjectIdType.optional(),
  proposalId: ObjectIdType.optional(),
  action: z.enum([
    "dao_proposal_create", "dao_proposal_vote", "dao_proposal_pass", "dao_proposal_fail",
    "dao_token_earned", "dao_token_spent", "dao_governance_participate",
    "dao_treasury_deposit", "dao_treasury_withdrawal", "dao_member_join", "dao_member_leave"
  ]),
  value: z.number().optional(), // Token amount, vote weight, etc.
  metadata: z.object({
    voteChoice: z.string().optional(),
    tokenAmount: z.number().optional(),
    proposalType: z.string().optional(),
    votingPower: z.number().optional(),
    quorumReached: z.boolean().optional()
  }).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertDaoAnalyticsSchema = daoAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Loyalty & Gamification Analytics Schema
// -----------------------------
export const loyaltyAnalyticsSchema = z.object({
  _id: ObjectIdType,
  userId: ObjectIdType,
  action: z.enum([
    "loyalty_points_earned", "loyalty_points_spent", "achievement_unlocked",
    "badge_earned", "level_up", "streak_maintained", "quest_completed",
    "reward_claimed", "milestone_reached", "leaderboard_rank_up"
  ]),
  value: z.number().optional(), // Points earned/spent
  metadata: z.object({
    achievementId: z.string().optional(),
    badgeId: z.string().optional(),
    level: z.number().optional(),
    streakDays: z.number().optional(),
    questId: z.string().optional(),
    rewardType: z.string().optional(),
    leaderboardPosition: z.number().optional(),
    totalParticipants: z.number().optional()
  }).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertLoyaltyAnalyticsSchema = loyaltyAnalyticsSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Type Exports
// -----------------------------
export type Analytics = z.infer<typeof analyticsSchema>;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type SearchAnalytics = z.infer<typeof searchAnalyticsSchema>;
export type InsertSearchAnalytics = z.infer<typeof insertSearchAnalyticsSchema>;
export type SubscriptionAnalytics = z.infer<typeof subscriptionAnalyticsSchema>;
export type InsertSubscriptionAnalytics = z.infer<typeof insertSubscriptionAnalyticsSchema>;
export type EcommerceAnalytics = z.infer<typeof ecommerceAnalyticsSchema>;
export type InsertEcommerceAnalytics = z.infer<typeof insertEcommerceAnalyticsSchema>;
export type ContentPerformance = z.infer<typeof contentPerformanceSchema>;
export type InsertContentPerformance = z.infer<typeof insertContentPerformanceSchema>;

export type FanClubAnalytics = z.infer<typeof fanClubAnalyticsSchema>;
export type InsertFanClubAnalytics = z.infer<typeof insertFanClubAnalyticsSchema>;
export type DAOAnalytics = z.infer<typeof daoAnalyticsSchema>;
export type InsertDAOAnalytics = z.infer<typeof insertDaoAnalyticsSchema>;
export type LoyaltyAnalytics = z.infer<typeof loyaltyAnalyticsSchema>;
export type InsertLoyaltyAnalytics = z.infer<typeof insertLoyaltyAnalyticsSchema>;
