import { z } from "zod";
import { ObjectIdType } from "./common";

// -----------------------------
// User Schema (Fans + Artists + Admins)
// -----------------------------
export const userSchema = z.object({
  _id: ObjectIdType,
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["fan", "artist", "admin"]),
  passwordHash: z.string(),
  avatarUrl: z.string().optional(),

  // Fan-related fields
  subscriptions: z.array(z.object({
    artistId: ObjectIdType,   // Reference to User (role=artist)
    tier: z.string().default("SUPPORTER"),
    startDate: z.date(),
    endDate: z.date(),
    active: z.boolean()
  })).default([]),

  favorites: z.object({
    artists: z.array(ObjectIdType).default([]),  // Reference to User (role=artist)
    songs: z.array(ObjectIdType).default([]),    // Reference to Song
    events: z.array(ObjectIdType).default([]),   // Reference to Event
    merch: z.array(ObjectIdType).default([])     // Reference to Merch
  }).default({ artists: [], songs: [], events: [], merch: [] }),

  playlists: z.array(z.object({
    name: z.string(),
    songs: z.array(ObjectIdType).default([]),    // Reference to Song
    createdAt: z.date()
  })).default([]),

  following: z.array(ObjectIdType).default([]),  // Reference to User (role=artist)

  adPreference: z.object({
    personalized: z.boolean(),
    categories: z.array(z.string())
  }).default({ personalized: true, categories: [] }),

  plan: z.object({
    type: z.enum(["FREE", "PREMIUM", "ARTIST"]),
    renewsAt: z.date().optional(),
    paymentId: z.string().optional(),
    subscriptionId: z.string().optional()
  }).default({ type: "FREE" }),

  // Artist-only fields (applies only if role = artist)
  artist: z.object({
    bio: z.string().optional(),
    socialLinks: z.object({
      instagram: z.string().optional(),
      youtube: z.string().optional(),
      x: z.string().optional(),
      website: z.string().optional()
    }).default({}),
    followers: z.array(ObjectIdType).default([]),   // Reference to User
    totalPlays: z.number().default(0),
    totalLikes: z.number().default(0),
    revenue: z.object({
      subscriptions: z.number().default(0),
      merch: z.number().default(0),
      events: z.number().default(0),
      ads: z.number().default(0),
      totalPaidOut: z.number().default(0), // Track total payouts for history
    }).default({}),
    // Single source of truth for available balance
    availableBalance: z.number().default(0),
      bankDetails: z.object({
      accountNumber: z.string().optional(),
      ifscCode: z.string().optional(),
      accountHolderName: z.string().optional(),
      bankName: z.string().optional(),
      razorpayContactId: z.string().optional(), // For Razorpay X payouts
      razorpayFundAccountId: z.string().optional(), // For Razorpay X payouts
      phoneNumber: z.string().optional(), // Phone number for payouts
      panNumber: z.string().optional(), // PAN card number
      aadharNumber: z.string().optional(), // Aadhar card number
      verified: z.boolean().default(false)
    }).default({}),
    subscriptionSettings: z.object({
      monthlyPrice: z.number().default(99),
      yearlyPrice: z.number().default(999),
      benefits: z.array(z.string()).default(["Early access to new releases", "Exclusive content", "Behind the scenes"]),
      isActive: z.boolean().default(false),
      updatedAt: z.date().optional()
    }).optional(),
    trendingScore: z.number().default(0),
    featured: z.boolean().default(false),
    verified: z.boolean().default(false),
  }).optional(),

  // Admin fields
  banned: z.boolean().default(false),
  banReason: z.string().optional(),
  banUntil: z.date().optional(),
  bannedAt: z.date().optional(),
  bannedBy: z.string().optional(),
  unbannedAt: z.date().optional(),
  unbannedBy: z.string().optional(),
  passwordResetAt: z.date().optional(),
  passwordResetBy: z.string().optional(),
  roleChangedAt: z.date().optional(),
  roleChangedBy: z.string().optional(),
  roleChangeReason: z.string().optional(),
  deleted: z.boolean().default(false),

  createdAt: z.date().default(() => new Date()),
  lastLogin: z.date().optional()
});

export const insertUserSchema = userSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// Type Exports
// -----------------------------
export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
