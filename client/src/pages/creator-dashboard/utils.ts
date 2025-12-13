import type { CurrentUser } from "@/types";
import type { ArtistProfile } from "./types";
import { getAuthHeaders } from "@/lib/auth";

/**
 * Creates a safe ArtistProfile with default values to prevent undefined errors
 */
export function createSafeArtistProfile(artistProfile?: any | null, user?: CurrentUser | null): ArtistProfile {
  // Handle nested artist structure from API response
  const artistData = artistProfile?.artist || artistProfile;
  
  return {
    _id: artistProfile?._id || "",
    userId: artistProfile?.userId || user?._id || "",
    bio: artistData?.bio || "",
    socialLinks: artistData?.socialLinks || {
      instagram: "",
      youtube: "", 
      website: "",
      x: ""
    },
    followers: artistData?.followers || [],
    totalPlays: artistData?.totalPlays || 0,
    totalLikes: artistData?.totalLikes || 0,
    revenue: {
      subscriptions: artistData?.revenue?.subscriptions || 0,
      merch: artistData?.revenue?.merch || 0,
      events: artistData?.revenue?.events || 0,
      ads: artistData?.revenue?.ads || 0
    },
    trendingScore: artistData?.trendingScore || 0,
    featured: artistData?.featured || false,
    verified: artistData?.verified || false,
    createdAt: artistData?.createdAt || new Date(),
    updatedAt: artistData?.updatedAt || new Date()
  };
}

// Simple interface for creator dashboard analytics
interface DashboardAnalytics {
  monthlyRevenue: number;
  subscriptionRevenue: number;
  merchRevenue: number;
  eventRevenue: number;
  totalPlays: number;
  uniqueListeners: number;
  totalLikes: number;
  newFollowers: number;
  newSubscribers: number;
  topSongs: any[];
}

/**
 * Creates a safe Analytics object with default values to prevent undefined errors
 */
export function createSafeAnalytics(analytics?: any): DashboardAnalytics {
  const analyticsData = analytics?.data || analytics;
  return {
    monthlyRevenue: analyticsData?.monthlyRevenue ?? 0,
    subscriptionRevenue: analyticsData?.subscriptionRevenue ?? 0,
    merchRevenue: analyticsData?.merchRevenue ?? 0,
    eventRevenue: analyticsData?.eventRevenue ?? 0,
    totalPlays: analyticsData?.totalPlays ?? 0,
    uniqueListeners: analyticsData?.uniqueListeners ?? 0,
    totalLikes: analyticsData?.totalLikes ?? 0,
    newFollowers: analyticsData?.newFollowers ?? 0,
    newSubscribers: analyticsData?.newSubscribers ?? 0,
    topSongs: analyticsData?.topSongs || []
  };
}

/**
 * Gets standardized authentication headers for API calls
 */
export function getCreatorAuthHeaders(): HeadersInit {
  return getAuthHeaders();
}