// ---------- INTERFACES ----------
export interface ArtistProfile {
  _id: string;
  userId: string;
  bio: string;
  socialLinks: Record<string, string>;
  followers: string[];
  totalPlays: number;
  totalLikes: number;
  revenue: { subscriptions: number; merch: number; events: number; ads: number };
  trendingScore: number;
  featured: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Song {
  _id: string;
  artistId: string;
  title: string;
  genre: string;
  fileUrl: string;
  artworkUrl: string;
  durationSec: number;
  plays: number;
  uniqueListeners: number;
  likes: number;
  shares: number;
  visibility: "PUBLIC" | "SUBSCRIBER_ONLY";
  adEnabled: boolean;
  createdAt: Date;
}

export interface Event {
  _id: string;
  artistId: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  onlineUrl?: string;
  ticketPrice: number;
  capacity?: number;
  imageUrl?: string;
  attendees: string[];
  createdAt: Date;
}

export interface Merch {
  _id: string;
  artistId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  orders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  monthlyRevenue: number;
  subscriptionRevenue: number;
  merchRevenue: number;
  eventRevenue: number;
  totalPlays: number;
  uniqueListeners: number;
  totalLikes: number;
  newFollowers: number;
  newSubscribers: number;
  conversionRate: number;
  topSongs: Song[];
}

export interface Blog {
  _id: string;
  artistId: string;
  title: string;
  content: string;
  visibility: "PUBLIC" | "SUBSCRIBER_ONLY";
  images: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
