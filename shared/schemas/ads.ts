import { z } from "zod";
import { ObjectIdType } from "./common";

// -----------------------------
// 🔹 Ad Campaign Schema
// -----------------------------
export const adCampaignSchema = z.object({
  _id: ObjectIdType,
  name: z.string(),
  type: z.enum(["AUDIO", "BANNER", "GOOGLE_ADSENSE"]),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "DRAFT"]),
  targeting: z.object({
    genres: z.array(z.string()).default([]),
    regions: z.array(z.string()).default([]),
    ageRanges: z.array(z.object({
      min: z.number(),
      max: z.number()
    })).default([]),
    userTypes: z.array(z.enum(["FREE", "PREMIUM"])).default(["FREE"])
  }).default({}),
  schedule: z.object({
    startDate: z.date(),
    endDate: z.date().optional(),
    dailyLimit: z.number().optional(), // impressions per day
    totalLimit: z.number().optional()  // total impressions
  }),
  budget: z.object({
    total: z.number().default(0),
    spent: z.number().default(0),
    currency: z.string().default("INR")
  }).default({}),
  createdBy: ObjectIdType, // Reference to User (admin)
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertAdCampaignSchema = adCampaignSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// 🔹 Audio Ad Schema
// -----------------------------
export const audioAdSchema = z.object({
  _id: ObjectIdType,
  campaignId: ObjectIdType.optional(), // Optional reference to AdCampaign
  title: z.string(),
  audioUrl: z.string(),
  imageUrl: z.string().optional(), // Ad artwork/image for display during playback
  durationSec: z.number(),
  callToAction: z.object({
    text: z.string(),
    url: z.string().optional()
  }).optional(),
  // Eligibility fields
  status: z.enum(["ACTIVE", "PAUSED", "DRAFT"]).default("ACTIVE"),
  approved: z.boolean().default(true),
  isDeleted: z.boolean().default(false),
  placements: z.array(z.string()).default(["PRE_ROLL"]), // e.g., ["PRE_ROLL", "MID_ROLL"]
  startAt: z.date().optional(),
  endAt: z.date().optional(),
  remainingBudget: z.number().optional(),
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  completions: z.number().default(0),
  revenue: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertAudioAdSchema = audioAdSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// 🔹 Banner Ad Schema
// -----------------------------
export const bannerAdSchema = z.object({
  _id: ObjectIdType,
  campaignId: ObjectIdType.optional(), // Optional reference to AdCampaign
  title: z.string(),
  imageUrl: z.string(),
  size: z.union([
    z.enum(["300x250", "728x90", "320x50", "300x600"]), // Predefined sizes
    z.object({ // Custom size
      width: z.number().min(100).max(2000),
      height: z.number().min(50).max(2000)
    })
  ]),
  callToAction: z.object({
    text: z.string(),
    url: z.string().optional()
  }).optional(),
  // Eligibility fields
  status: z.enum(["ACTIVE", "PAUSED", "DRAFT"]).default("ACTIVE"),
  approved: z.boolean().default(true),
  isDeleted: z.boolean().default(false),
  placements: z.array(z.string()).default(["HOME"]), // Changed to uppercase for consistency
  startAt: z.date().optional(),
  endAt: z.date().optional(),
  remainingBudget: z.number().optional(),
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  revenue: z.number().default(0),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertBannerAdSchema = bannerAdSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// 🔹 Ad Placement Schema
// -----------------------------
export const adPlacementSchema = z.object({
  _id: ObjectIdType,
  type: z.enum(["PRE_ROLL", "MID_ROLL", "BANNER_HOME", "BANNER_DISCOVER", "BANNER_PROFILE"]),
  createdAt: z.date().default(() => new Date()),
  adId: ObjectIdType,
  adType: z.enum(["AUDIO", "BANNER"]),
  priority: z.number(),
  isActive: z.boolean(),
  conditions: z.object({
    minPlays: z.number().optional(),
    timeInterval: z.number().optional(),
    maxPerSession: z.number().optional(),
  }),
  targeting: z.object({
    ageRange: z.array(z.number()).optional(), // [minAge, maxAge]
    regions: z.array(z.string()).optional(), // ["US", "IN", "UK", etc.]
    genres: z.array(z.string()).optional(), // ["pop", "rock", "hip-hop", etc.]
    userTypes: z.array(z.enum(["FREE", "PREMIUM"])).optional(),
    deviceTypes: z.array(z.enum(["mobile", "desktop", "tablet"])).optional(),
  }).optional(),
});

export const insertAdPlacementSchema = adPlacementSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// 🔹 Ad Impression Schema (for tracking)
// -----------------------------
export const adImpressionSchema = z.object({
  _id: ObjectIdType,
  adId: ObjectIdType, // Reference to AudioAd or BannerAd
  adType: z.enum(["AUDIO", "BANNER"]),
  userId: ObjectIdType.optional(), // Reference to User
  songId: ObjectIdType.optional(), // Reference to Song (for audio ads)
  placement: z.string(), // e.g., "home", "discover", "player"
  deviceInfo: z.object({
    type: z.string().optional(),
    os: z.string().optional(),
    browser: z.string().optional()
  }).default({}),
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional()
  }).default({}),
  timestamp: z.date().default(() => new Date())
});

export const insertAdImpressionSchema = adImpressionSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Ad Click Schema (for tracking)
// -----------------------------
export const adClickSchema = z.object({
  _id: ObjectIdType,
  impressionId: ObjectIdType, // Reference to AdImpression
  adId: ObjectIdType, // Reference to AudioAd or BannerAd
  adType: z.enum(["AUDIO", "BANNER"]),
  userId: ObjectIdType.optional(), // Reference to User
  timestamp: z.date().default(() => new Date())
});

export const insertAdClickSchema = adClickSchema.omit({ _id: true, timestamp: true });

// -----------------------------
// 🔹 Ad Revenue Schema
// -----------------------------
export const adRevenueSchema = z.object({
  _id: ObjectIdType,
  adId: ObjectIdType, // Reference to AudioAd or BannerAd
  adType: z.enum(["AUDIO", "BANNER", "GOOGLE_ADSENSE"]),
  amount: z.number(),
  currency: z.string().default("INR"),
  source: z.enum(["INTERNAL", "GOOGLE_ADSENSE"]),
  artistId: ObjectIdType.optional(), // Reference to User (artist) for revenue sharing
  platformShare: z.number(), // Platform's share
  artistShare: z.number(), // Artist's share
  date: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date())
});

export const insertAdRevenueSchema = adRevenueSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// 🔹 Song Ad Settings Schema (for artist controls)
// -----------------------------
export const songAdSettingsSchema = z.object({
  _id: ObjectIdType,
  songId: ObjectIdType, // Reference to Song
  artistId: ObjectIdType, // Reference to User (artist)
  adsEnabled: z.boolean().default(true),
  adTypes: z.array(z.enum(["PRE_ROLL", "MID_ROLL", "BANNER"])).default(["PRE_ROLL", "MID_ROLL"]),
  customAdSettings: z.object({
    skipEnabled: z.boolean().default(true),
    maxAdsPerSession: z.number().default(3),
    adFrequency: z.number().default(5), // minutes between ads
  }).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertSongAdSettingsSchema = songAdSettingsSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// 🔹 Type Exports
// -----------------------------
export type AdCampaign = z.infer<typeof adCampaignSchema>;
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;
export type AudioAd = z.infer<typeof audioAdSchema>;
export type InsertAudioAd = z.infer<typeof insertAudioAdSchema>;
export type BannerAd = z.infer<typeof bannerAdSchema>;
export type InsertBannerAd = z.infer<typeof insertBannerAdSchema>;
export type AdPlacement = z.infer<typeof adPlacementSchema>;
export type InsertAdPlacement = z.infer<typeof insertAdPlacementSchema>;
export type AdImpression = z.infer<typeof adImpressionSchema>;
export type InsertAdImpression = z.infer<typeof insertAdImpressionSchema>;
export type AdClick = z.infer<typeof adClickSchema>;
export type InsertAdClick = z.infer<typeof insertAdClickSchema>;
export type AdRevenue = z.infer<typeof adRevenueSchema>;
export type InsertAdRevenue = z.infer<typeof insertAdRevenueSchema>;
export type SongAdSettings = z.infer<typeof songAdSettingsSchema>;
export type InsertSongAdSettings = z.infer<typeof insertSongAdSettingsSchema>;
