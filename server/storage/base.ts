import { MongoClient, Db, ObjectId, Collection } from "mongodb";
import {
  User, InsertUser, Song, InsertSong, Merch, InsertMerch, Event, InsertEvent,
  Order, InsertOrder, Subscription, InsertSubscription, Analytics, InsertAnalytics,
  Blog, InsertBlog, PromoCode, InsertPromoCode, OrderTracking, InsertOrderTracking,
  ReturnRequest, InsertReturnRequest,
  AdCampaign, InsertAdCampaign, AudioAd, InsertAudioAd, BannerAd, InsertBannerAd,
  AdPlacement, InsertAdPlacement, AdImpression, InsertAdImpression, AdClick, InsertAdClick, AdRevenue, InsertAdRevenue
} from "../../shared/schemas";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Artist methods (working with User collection)
  getArtistByUserId(userId: string): Promise<User | undefined>;
  getFeaturedArtists(limit?: number): Promise<User[]>;
  getAllArtists(limit?: number): Promise<User[]>;

  // Song methods
  getSong(id: string): Promise<Song | undefined>;
  getSongsByArtist(artistId: string): Promise<Song[]>;
  createSong(song: InsertSong): Promise<Song>;
  updateSong(id: string, updates: Partial<Song>): Promise<Song | undefined>;
  deleteSong(id: string): Promise<boolean>;
  getTrendingSongs(limit?: number): Promise<Song[]>;
  searchSongs(query: string): Promise<Song[]>;
  getAllSongs(options?: { genre?: string; sort?: string; limit?: number }): Promise<Song[]>;

  // Merch methods
  getMerch(id: string): Promise<Merch | undefined>;
  getMerchByArtist(artistId: string): Promise<Merch[]>;
  createMerch(merch: InsertMerch): Promise<Merch>;
  updateMerch(id: string, updates: Partial<Merch>): Promise<Merch | undefined>;
  deleteMerch(id: string): Promise<boolean>;
  getAllMerch(): Promise<Merch[]>;
  getAllMerchFiltered(filters: any): Promise<Merch[]>;

  // Event methods
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByArtist(artistId: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  getUpcomingEvents(): Promise<Event[]>;
  getAllEventsFiltered(filters: any): Promise<Event[]>;

  // Order methods
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;

  // Subscription methods
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  getSubscriptionsByArtist(artistId: string): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;

  // Blog methods
  getBlog(id: string): Promise<Blog | undefined>;
  getBlogsByArtist(artistId: string): Promise<Blog[]>;
  getAllBlogs(): Promise<Blog[]>;
  createBlog(blog: InsertBlog): Promise<Blog>;
  updateBlog(id: string, updates: Partial<Blog>): Promise<Blog | undefined>;
  deleteBlog(id: string): Promise<boolean>;

  // Promo Code methods
  getPromoCode(id: string): Promise<PromoCode | undefined>;
  getPromoCodeByCode(code: string): Promise<PromoCode | undefined>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  updatePromoCode(id: string, updates: Partial<PromoCode>): Promise<PromoCode | undefined>;
  deletePromoCode(id: string): Promise<boolean>;
  validatePromoCode(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; discount: number; message: string }>;

  // Order Tracking methods
  getOrderTracking(orderId: string): Promise<OrderTracking[]>;
  createOrderTracking(tracking: InsertOrderTracking): Promise<OrderTracking>;
  updateOrderTracking(id: string, updates: Partial<OrderTracking>): Promise<OrderTracking | undefined>;

  // Return Request methods
  getReturnRequest(id: string): Promise<ReturnRequest | undefined>;
  getReturnRequestsByUser(userId: string): Promise<ReturnRequest[]>;
  getReturnRequestsByOrder(orderId: string): Promise<ReturnRequest[]>;
  createReturnRequest(request: InsertReturnRequest): Promise<ReturnRequest>;
  updateReturnRequest(id: string, updates: Partial<ReturnRequest>): Promise<ReturnRequest | undefined>;

  // Analytics methods
  logAnalytics(analytics: InsertAnalytics): Promise<void>;

  // Additional methods for dashboard
  getRecentPlaysByUser(userId: string): Promise<Song[]>;
  getArtistNameByProfileId(artistId: string): Promise<string>;
  getSongsWithArtistNames(options?: { genre?: string; sort?: string; limit?: number }): Promise<(Song & { artistName: string })[]>;
  getEventsWithArtistNames(filters: any): Promise<(Event & { artistName: string })[]>;
  getMerchWithArtistNames(filters: any): Promise<(Merch & { artistName: string })[]>;

  // Search methods
  searchMerch(query: string): Promise<Merch[]>;
  searchEvents(query: string): Promise<Event[]>;
  searchBlogs(query: string): Promise<Blog[]>;

  // Ad methods
  getAdCampaign(id: string): Promise<AdCampaign | undefined>;
  getAllAdCampaigns(): Promise<AdCampaign[]>;
  createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign>;
  updateAdCampaign(id: string, updates: Partial<AdCampaign>): Promise<AdCampaign | undefined>;
  deleteAdCampaign(id: string): Promise<boolean>;

  getAudioAd(id: string): Promise<AudioAd | undefined>;
  getAudioAdsByCampaign(campaignId: string): Promise<AudioAd[]>;
  getAllAudioAds(): Promise<AudioAd[]>;
  createAudioAd(ad: InsertAudioAd): Promise<AudioAd>;
  updateAudioAd(id: string, updates: Partial<AudioAd>): Promise<AudioAd | undefined>;
  deleteAudioAd(id: string): Promise<boolean>;

  getBannerAd(id: string): Promise<BannerAd | undefined>;
  getBannerAdsByCampaign(campaignId: string): Promise<BannerAd[]>;
  getAllBannerAds(): Promise<BannerAd[]>;
  createBannerAd(ad: InsertBannerAd): Promise<BannerAd>;
  updateBannerAd(id: string, updates: Partial<BannerAd>): Promise<BannerAd | undefined>;
  deleteBannerAd(id: string): Promise<boolean>;

  getAdPlacement(id: string): Promise<AdPlacement | undefined>;
  getAdPlacementsByType(type: string): Promise<AdPlacement[]>;
  createAdPlacement(placement: InsertAdPlacement): Promise<AdPlacement>;
  updateAdPlacement(id: string, updates: Partial<AdPlacement>): Promise<AdPlacement | undefined>;
  deleteAdPlacement(id: string): Promise<boolean>;

  createAdImpression(impression: InsertAdImpression): Promise<AdImpression>;
  getAdImpressions(adId: string, adType: string): Promise<AdImpression[]>;

  createAdClick(click: InsertAdClick): Promise<AdClick>;
  getAdClicks(adId: string, adType: string): Promise<AdClick[]>;

  createAdRevenue(revenue: InsertAdRevenue): Promise<AdRevenue>;
  getAdRevenue(adId: string, adType: string): Promise<AdRevenue[]>;
  getAdRevenueByArtist(artistId: string): Promise<AdRevenue[]>;

  getAdStats(adId: string, adType: string): Promise<{
    impressions: number;
    clicks: number;
    ctr: number;
    revenue: number;
  }>;
}

export class BaseStorage {
  protected client: MongoClient;
  public db: Db;

  constructor(mongoUri?: string) {
    const uri = mongoUri || process.env.MONGODB_URI || "mongodb://localhost:27017";
    this.client = new MongoClient(uri);
    this.db = this.client.db("riseupcreator");
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      // Create essential indexes for performance
      await this.createIndexes();
    } catch (error) {
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Ad impressions indexes for duplicate detection and analytics
      await this.db.collection("ad_impressions").createIndexes([
        { key: { adId: 1, timestamp: 1 } },
        { key: { adId: 1, ip: 1, timestamp: 1 } },
        { key: { adId: 1, userId: 1, timestamp: 1 } },
        { key: { timestamp: 1 }, expireAfterSeconds: 7776000 }, // 90 days TTL
      ]);

      // Ad clicks indexes
      await this.db.collection("ad_clicks").createIndexes([
        { key: { adId: 1, timestamp: 1 } },
        { key: { timestamp: 1 }, expireAfterSeconds: 7776000 }, // 90 days TTL
      ]);

      // User-related indexes
      await this.db.collection("users").createIndexes([
        { key: { email: 1 }, unique: true },
        { key: { role: 1 } },
      ]);

      // Artists indexes
      await this.db.collection("artists").createIndexes([
        { key: { userId: 1 }, unique: true },
        { key: { verified: 1 } },
      ]);

      // Songs indexes
      await this.db.collection("songs").createIndexes([
        { key: { artistId: 1 } },
        { key: { title: 1 } },
        { key: { plays: -1 } }, // For trending/popular sorts
      ]);

      // Banner ads indexes
      await this.db.collection("banner_ads").createIndexes([
        { key: { placement: 1, isActive: 1 } },
        { key: { startDate: 1, endDate: 1 } },
      ]);
    } catch (error) {
      // Indexes may already exist, continue silently
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      // Silently handle disconnection errors
    }
  }
}

