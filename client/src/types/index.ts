// Import types from shared schemas
import type {
  User,
  Song,
  Merch,
  Event,
  Blog,
  Order,
  Subscription,
  PromoCode,
  OrderTracking,
  ReturnRequest,
  Analytics,
  AdCampaign,
  AudioAd,
  BannerAd,
  AdPlacement,
  AdImpression,
  AdClick,
  AdRevenue
} from "../../../shared/schemas";

// Re-export types for external use
export type {
  User,
  Song,
  Merch,
  Event,
  Blog,
  Order,
  Subscription,
  PromoCode,
  OrderTracking,
  ReturnRequest,
  Analytics,
  AdCampaign,
  AudioAd,
  BannerAd,
  AdPlacement,
  AdImpression,
  AdClick,
  AdRevenue
};

// Additional frontend-specific types
export interface CurrentUser {
  _id: string;
  name: string;
  email: string;
  role: "fan" | "artist" | "admin";
  avatarUrl?: string;
  plan?: {
    type: "FREE" | "PREMIUM" | "ARTIST";
    renewsAt?: Date;
  };
  favorites?: {
    artists: string[];
    songs: Song[];
    events: string[];
  };
  following?: string[];
}

export interface AuthState {
  user: CurrentUser | null;
  token: string | null;
  isLoading: boolean;
}

export interface MusicPlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  queue: Song[];
  currentIndex: number;
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
  duration: number;
  currentTime: number;
}

export interface CartItem {
  type: 'merch' | 'ticket';
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  artistName?: string;
}

export interface CartState {
  items: CartItem[];
  total: number;
  summary?: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchFilters {
  query?: string;
  genre?: string;
  artist?: string;
  priceMin?: number;
  priceMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
  location?: string;
}

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface DashboardStats {
  totalEarnings?: number;
  totalStreams?: number;
  totalFollowers?: number;
  totalLikes?: number;
  recentStreams?: number[];
  topSongs?: Song[];
  pendingArtists?: number;
  activeUsers?: number;
  platformRevenue?: number;
  totalOrders?: number;
  totalUsers?: number;
  totalFans?: number;
  totalArtists?: number;
  verifiedArtists?: number;
  totalSongs?: number;
  totalEvents?: number;
  totalMerch?: number;
  premiumRevenue?: number;
  artistSubRevenue?: number;
  merchRevenue?: number;
  ticketRevenue?: number;
}

export interface AdminStats {
  pendingArtists: number;
  activeUsers: number;
  platformRevenue: number;
  totalOrders: number;
  monthlyStats?: {
    users: number;
    revenue: number;
    streams: number;
  }[];
}

export interface PlatformStats {
  artistsCount: number;
  songsCount: number;
  fansCount: number;
  totalPlays: number;
  pricing: {
    premiumPlanPrice: number;
    artistProPlanPrice: number;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UploadSongForm {
  title: string;
  genre: string;
  visibility: "PUBLIC" | "SUBSCRIBER_ONLY";
  audioFile: File | null;
  artworkFile: File | null;
}

export interface CreateEventForm {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  onlineUrl?: string;
  ticketPrice: number;
  capacity?: number;
}

export interface CreateMerchForm {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: File[];
}

export interface CheckoutForm {
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  paymentMethod: 'razorpay';
}

// Component props interfaces
export interface SongCardProps {
  song: Song;
  showArtist?: boolean;
  showPlayButton?: boolean;
  onPlay?: () => void;
  onLike?: () => void;
  className?: string;
}

export interface ArtistCardProps {
  artist: User;
  user?: { name: string; email: string };
  showFollowButton?: boolean;
  onFollow?: () => void;
  className?: string;
}

export interface EventCardProps {
  event: Event;
  showBuyButton?: boolean;
  onBuyTicket?: () => void;
  className?: string;
}

export interface MerchCardProps {
  item: Merch;
  showAddToCart?: boolean;
  onAddToCart?: () => void;
  className?: string;
}
