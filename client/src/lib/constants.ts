export const APP_NAME = "Rise Up Creators";
export const APP_DESCRIPTION = "Empowering Music Creators, Connecting Fans";

// API endpoints
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-domain.com/api'
  : '/api';

// Routes
export const ROUTES = {
  HOME: '/',
  LANDING: '/',
  DASHBOARD: '/dashboard',
  CREATOR_DASHBOARD: '/creator',
  ADMIN_PANEL: '/admin',
  DISCOVER: '/discover',
  SEARCH: '/search',
  ARTIST_PROFILE: '/artist',
  MERCH: '/merch',
  EVENTS: '/events',
  CART: '/cart',
  CHECKOUT: '/checkout',
  LOGIN: '/login',
  SIGNUP: '/signup',
  SETTINGS: '/settings',
  NOTIFICATIONS: '/notifications',
  HELP: '/help',
  PLANS: '/plans',
} as const;

// User roles
export const USER_ROLES = {
  FAN: 'fan',
  ARTIST: 'artist',
  ADMIN: 'admin',
} as const;

// Song visibility options
export const SONG_VISIBILITY = {
  PUBLIC: 'PUBLIC',
  SUBSCRIBER_ONLY: 'SUBSCRIBER_ONLY',
} as const;

// Order status
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
} as const;

// Plan types
export const PLAN_TYPES = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
} as const;

// Music genres
export const MUSIC_GENRES = [
  'Pop',
  'Rock',
  'Hip Hop',
  'Electronic',
  'R&B',
  'Country',
  'Jazz',
  'Classical',
  'Folk',
  'Blues',
  'Reggae',
  'Alternative',
  'Indie',
  'Metal',
  'Punk',
  'Funk',
  'Soul',
  'Gospel',
  'World',
  'Ambient',
  'Bollywood',
  'Punjabi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Other'
] as const;

// Merch categories
export const MERCH_CATEGORIES = [
  'Clothing',
  'Accessories',
  'Music',
  'Art',
  'Electronics',
  'Books',
  'Other',
] as const;

// File upload limits
export const FILE_LIMITS = {
  AUDIO_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  IMAGE_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  AUDIO_FORMATS: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
  IMAGE_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'ruc_auth_token',
  USER_DATA: 'ruc_user_data',
  SESSION_ID: 'ruc_session_id',
  PLAYER_QUEUE: 'ruc_player_queue',
  PLAYER_SETTINGS: 'ruc_player_settings',
  CART_ITEMS: 'ruc_cart_items',
  THEME: 'ruc_theme',
} as const;

// Toast messages
export const TOAST_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  LOGIN_ERROR: 'Invalid credentials. Please try again.',
  SIGNUP_SUCCESS: 'Account created successfully!',
  SIGNUP_ERROR: 'Failed to create account. Please try again.',
  LOGOUT_SUCCESS: 'Logged out successfully',
  UPLOAD_SUCCESS: 'Upload successful!',
  UPLOAD_ERROR: 'Upload failed. Please try again.',
  SAVE_SUCCESS: 'Changes saved successfully!',
  SAVE_ERROR: 'Failed to save changes. Please try again.',
  DELETE_SUCCESS: 'Deleted successfully!',
  DELETE_ERROR: 'Failed to delete. Please try again.',
  FOLLOW_SUCCESS: 'Now following!',
  UNFOLLOW_SUCCESS: 'Unfollowed successfully',
  LIKE_SUCCESS: 'Added to favorites!',
  UNLIKE_SUCCESS: 'Removed from favorites',
  ADD_TO_CART_SUCCESS: 'Added to cart!',
  REMOVE_FROM_CART_SUCCESS: 'Removed from cart',
  ORDER_SUCCESS: 'Order placed successfully!',
  ORDER_ERROR: 'Failed to place order. Please try again.',
  PAYMENT_SUCCESS: 'Payment successful!',
  PAYMENT_ERROR: 'Payment failed. Please try again.',
} as const;

// Animation durations
export const ANIMATION_DURATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
} as const;

// Breakpoints (matching Tailwind)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Social media platforms
export const SOCIAL_PLATFORMS = {
  INSTAGRAM: 'instagram',
  YOUTUBE: 'youtube',
  X: 'x',
  WEBSITE: 'website',
  SPOTIFY: 'spotify',
  APPLE_MUSIC: 'apple_music',
} as const;

// Event types
export const EVENT_TYPES = {
  CONCERT: 'concert',
  FESTIVAL: 'festival',
  ACOUSTIC: 'acoustic',
  ONLINE: 'online',
  WORKSHOP: 'workshop',
  MEET_AND_GREET: 'meet_and_greet',
} as const;

// Analytics actions
export const ANALYTICS_ACTIONS = {
  PLAY: 'play',
  LIKE: 'like',
  SHARE: 'share',
  PURCHASE: 'purchase',
  REVIEW: 'review',
  FOLLOW: 'follow',
  SUBSCRIBE: 'subscribe',
  AD_IMPRESSION: 'ad_impression',
  AD_CLICK: 'ad_click',
  AD_COMPLETE: 'ad_complete',
  SEARCH: 'search',
  VIEW: 'view',
} as const;

// Analytics contexts
export const ANALYTICS_CONTEXTS = {
  HOME: 'home',
  PROFILE: 'profile',
  DISCOVER: 'discover',
  PLAYER: 'player',
  CART: 'cart',
  ADMIN: 'admin',
} as const;

// Email templates
export const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
  ORDER_CONFIRMATION: 'order_confirmation',
  TICKET: 'ticket',
  ARTIST_VERIFICATION: 'artist_verification',
  SUBSCRIPTION_RENEWAL: 'subscription_renewal',
  SHIPPING_UPDATE: 'shipping_update',
} as const;

// Feature flags
export const FEATURES = {
  GOOGLE_AUTH: true,
  RAZORPAY_PAYMENTS: true,
  EMAIL_NOTIFICATIONS: true,
  SOCIAL_SHARING: true,
  ANALYTICS: true,
  ADS: false, // Placeholder for future implementation
  CHAT: false, // Phase 2 feature
  REVIEWS: false, // Phase 2 feature
} as const;

// Cloudinary folders
export const CLOUDINARY_FOLDERS = {
  SONGS: 'ruc/songs',
  ARTWORK: 'ruc/artwork',
  MERCH: 'ruc/merch',
  AVATARS: 'ruc/avatars',
  EVENTS: 'ruc/events',
  ADS: 'ruc/ads',
} as const;

// Error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
