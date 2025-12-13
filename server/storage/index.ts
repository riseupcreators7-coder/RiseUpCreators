import { ObjectId } from "mongodb";
import { UserStorage } from "./user";
import { ContentStorage } from "./content";
import { CommerceStorage } from "./commerce";

// Complete storage class with full functionality
export class MongoStorage {
  private userStorage: UserStorage;
  private contentStorage: ContentStorage;
  private commerceStorage: CommerceStorage;

  constructor() {
    this.userStorage = new UserStorage();
    this.contentStorage = new ContentStorage();
    this.commerceStorage = new CommerceStorage();
  }

  async connect(): Promise<void> {
    await this.userStorage.connect();
    await this.commerceStorage.connect();
    // All storage classes share the same database connection
  }

  async disconnect(): Promise<void> {
    await this.userStorage.disconnect();
    await this.commerceStorage.disconnect();
  }

  // User methods - delegate to UserStorage
  async getUser(id: string) { return this.userStorage.getUser(id); }
  async getUserByEmail(email: string) { return this.userStorage.getUserByEmail(email); }
  async createUser(user: any) { return this.userStorage.createUser(user); }
  async updateUser(id: string, updates: Partial<any>) { return this.userStorage.updateUser(id, updates); }
  async deleteUser(id: string) { return this.userStorage.deleteUser(id); }
  async getArtistByUserId(userId: string) { return this.userStorage.getArtistByUserId(userId); }
  async getFeaturedArtists(limit?: number) { return this.userStorage.getFeaturedArtists(limit); }
  async getAllArtists(limit?: number) { return this.userStorage.getAllArtists(limit); }
  async searchArtists(query: string) { return this.userStorage.searchArtists(query); }

  // Content methods - delegate to ContentStorage
  async getSong(id: string) { return this.contentStorage.getSong(id); }
  async getSongsByArtist(artistId: string) { return this.contentStorage.getSongsByArtist(artistId); }
  async createSong(song: any) { return this.contentStorage.createSong(song); }
  async updateSong(id: string, updates: Partial<any>) { return this.contentStorage.updateSong(id, updates); }
  async deleteSong(id: string) { return this.contentStorage.deleteSong(id); }
  async getTrendingSongs(limit?: number) { return this.contentStorage.getTrendingSongs(limit); }
  async searchSongs(query: string) { return this.contentStorage.searchSongs(query); }
  async getAllSongs(options?: { genre?: string; sort?: string; limit?: number; includeSubscriberOnly?: boolean }) { return this.contentStorage.getAllSongs(options); }

  async getMerch(id: string) { return this.contentStorage.getMerch(id); }
  async getMerchByArtist(artistId: string) { return this.contentStorage.getMerchByArtist(artistId); }
  async createMerch(merch: any) { return this.contentStorage.createMerch(merch); }
  async updateMerch(id: string, updates: Partial<any>) { return this.contentStorage.updateMerch(id, updates); }
  async deleteMerch(id: string) { return this.contentStorage.deleteMerch(id); }
  async getAllMerch() { return this.contentStorage.getAllMerch(); }
  async getAllMerchFiltered(filters: any) { return this.contentStorage.getAllMerchFiltered(filters); }
  async searchMerch(query: string) { return this.contentStorage.searchMerch(query); }
  async searchEvents(query: string) { return this.contentStorage.searchEvents(query); }
  async searchBlogs(query: string) { return this.contentStorage.searchBlogs(query); }

  async getEvent(id: string) { return this.contentStorage.getEvent(id); }
  async getEventsByArtist(artistId: string) { return this.contentStorage.getEventsByArtist(artistId); }
  async createEvent(event: any) { return this.contentStorage.createEvent(event); }
  async updateEvent(id: string, updates: Partial<any>) { return this.contentStorage.updateEvent(id, updates); }
  async deleteEvent(id: string) { return this.contentStorage.deleteEvent(id); }
  async getUpcomingEvents() { return this.contentStorage.getUpcomingEvents(); }
  async getAllEventsFiltered(filters: any) { return this.contentStorage.getAllEventsFiltered(filters); }

  // Ticket methods - delegate to ContentStorage
  async getTicket(id: string) { return this.contentStorage.getTicket(id); }
  async getTicketByNumber(ticketNumber: string) { return this.contentStorage.getTicketByNumber(ticketNumber); }
  async getTicketsByOrder(orderId: string) { return this.contentStorage.getTicketsByOrder(orderId); }
  async getTicketsByEvent(eventId: string) { return this.contentStorage.getTicketsByEvent(eventId); }
  async getTicketsByUser(userId: string) { return this.contentStorage.getTicketsByUser(userId); }
  async createTicket(ticket: any) { return this.contentStorage.createTicket(ticket); }
  async updateTicket(id: string, updates: any) { return this.contentStorage.updateTicket(id, updates); }
  async checkInTicket(ticketId: string, checkedInBy: string) { return this.contentStorage.checkInTicket(ticketId, checkedInBy); }
  async getEventTicketStats(eventId: string) { return this.contentStorage.getEventTicketStats(eventId); }
  async deleteTicket(id: string) { return this.contentStorage.deleteTicket(id); }

  async getBlog(id: string) { return this.contentStorage.getBlog(id); }
  async getBlogsByArtist(artistId: string) { return this.contentStorage.getBlogsByArtist(artistId); }
  async getAllBlogs() { return this.contentStorage.getAllBlogs(); }
  async createBlog(blog: any) { return this.contentStorage.createBlog(blog); }
  async updateBlog(id: string, updates: Partial<any>) { return this.contentStorage.updateBlog(id, updates); }
  async deleteBlog(id: string) { return this.contentStorage.deleteBlog(id); }

  // Helper method
  async getArtistNameByProfileId(artistId: string) { return this.userStorage.getArtistNameByProfileId(artistId); }

  // Order methods - delegate to CommerceStorage
  async getOrder(id: string) { return this.commerceStorage.getOrder(id); }
  async getOrdersByUser(userId: string) { return this.commerceStorage.getOrdersByUser(userId); }
  async createOrder(order: any) { return this.commerceStorage.createOrder(order); }
  async updateOrder(id: string, updates: any) { return this.commerceStorage.updateOrder(id, updates); }
  async findOrderByTrackingNumber(trackingNumber: string) { return this.commerceStorage.findOrderByTrackingNumber(trackingNumber); }

  // Subscription methods - delegate to CommerceStorage
  async getSubscription(id: string) { return this.commerceStorage.getSubscription(id); }
  async getSubscriptionsByUser(userId: string) { return this.commerceStorage.getSubscriptionsByUser(userId); }
  async getSubscriptionsByArtist(artistId: string) { return this.commerceStorage.getSubscriptionsByArtist(artistId); }
  async createSubscription(subscription: any) { return this.commerceStorage.createSubscription(subscription); }
  async updateSubscription(id: string, updates: any) { return this.commerceStorage.updateSubscription(id, updates); }

  // PromoCode methods - delegate to CommerceStorage
  async getPromoCode(id: string) { return this.commerceStorage.getPromoCode(id); }
  async getPromoCodeByCode(code: string) { return this.commerceStorage.getPromoCodeByCode(code); }
  async getAllPromoCodes() { return this.commerceStorage.getAllPromoCodes(); }
  async createPromoCode(promoCode: any) { return this.commerceStorage.createPromoCode(promoCode); }
  async updatePromoCode(id: string, updates: any) { return this.commerceStorage.updatePromoCode(id, updates); }
  async deletePromoCode(id: string) { return this.commerceStorage.deletePromoCode(id); }
  async validatePromoCode(code: string, userId: string, orderAmount: number) { 
    return this.commerceStorage.validatePromoCode(code, userId, orderAmount); 
  }

  // Order Tracking methods - delegate to CommerceStorage
  async getOrderTracking(orderId: string) { return this.commerceStorage.getOrderTracking(orderId); }
  async createOrderTracking(tracking: any) { return this.commerceStorage.createOrderTracking(tracking); }
  async updateOrderTracking(id: string, updates: any) { return this.commerceStorage.updateOrderTracking(id, updates); }

  // Return Request methods - delegate to CommerceStorage
  async getReturnRequest(id: string) { return this.commerceStorage.getReturnRequest(id); }
  async getReturnRequestsByUser(userId: string) { return this.commerceStorage.getReturnRequestsByUser(userId); }
  async getReturnRequestsByOrder(orderId: string) { return this.commerceStorage.getReturnRequestsByOrder(orderId); }
  async createReturnRequest(request: any) { return this.commerceStorage.createReturnRequest(request); }
  async updateReturnRequest(id: string, updates: any) { return this.commerceStorage.updateReturnRequest(id, updates); }

  // Ad Campaign methods
  async getAllAdCampaigns() { 
    return this.db.collection("ad_campaigns").find({}).toArray(); 
  }
  async createAdCampaign(campaign: any) { 
    const result = await this.db.collection("ad_campaigns").insertOne(campaign);
    return { ...campaign, _id: result.insertedId };
  }
  async updateAdCampaign(id: string, updates: any) { 
    const result = await this.db.collection("ad_campaigns").updateOne(
      { _id: new ObjectId(id) }, 
      { $set: updates }
    );
    return result.matchedCount > 0 ? { _id: id, ...updates } : undefined;
  }
  async deleteAdCampaign(id: string) { 
    const result = await this.db.collection("ad_campaigns").deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Audio Ad methods
  async getAudioAd(id: string) { 
    return this.db.collection("audio_ads").findOne({ _id: new ObjectId(id) }); 
  }
  async getAudioAdsByCampaign(campaignId: string) { 
    return this.db.collection("audio_ads").find({ campaignId: new ObjectId(campaignId) }).toArray(); 
  }
  async getAllAudioAds() { 
    return this.db.collection("audio_ads").find({}).toArray(); 
  }
  async createAudioAd(ad: any) { 
    const result = await this.db.collection("audio_ads").insertOne(ad);
    return { ...ad, _id: result.insertedId };
  }
  async updateAudioAd(id: string, updates: any) { 
    const result = await this.db.collection("audio_ads").updateOne(
      { _id: new ObjectId(id) }, 
      { $set: { ...updates, updatedAt: new Date() } }
    );
    if (result.matchedCount > 0) {
      return this.db.collection("audio_ads").findOne({ _id: new ObjectId(id) });
    }
    return undefined;
  }
  async deleteAudioAd(id: string) { 
    const result = await this.db.collection("audio_ads").updateOne(
      { _id: new ObjectId(id) }, 
      { $set: { isDeleted: true, updatedAt: new Date() } }
    );
    return result.matchedCount > 0;
  }

  // Banner Ad methods
  async getBannerAd(id: string) { 
    return this.db.collection("banner_ads").findOne({ _id: new ObjectId(id) }); 
  }
  async getBannerAdsByCampaign(campaignId: string) { 
    return this.db.collection("banner_ads").find({ campaignId: new ObjectId(campaignId) }).toArray(); 
  }
  async getAllBannerAds() { 
    return this.db.collection("banner_ads").find({}).toArray(); 
  }
  async createBannerAd(ad: any) { 
    const result = await this.db.collection("banner_ads").insertOne(ad);
    return { ...ad, _id: result.insertedId };
  }
  async updateBannerAd(id: string, updates: any) { 
    const result = await this.db.collection("banner_ads").updateOne(
      { _id: new ObjectId(id) }, 
      { $set: { ...updates, updatedAt: new Date() } }
    );
    if (result.matchedCount > 0) {
      return this.db.collection("banner_ads").findOne({ _id: new ObjectId(id) });
    }
    return undefined;
  }
  async deleteBannerAd(id: string) { 
    const result = await this.db.collection("banner_ads").updateOne(
      { _id: new ObjectId(id) }, 
      { $set: { isDeleted: true, updatedAt: new Date() } }
    );
    return result.matchedCount > 0;
  }

  // Ad Analytics methods
  async createAdImpression(impression: any) { 
    const result = await this.db.collection("ad_impressions").insertOne(impression);
    return { ...impression, _id: result.insertedId };
  }
  async getAdImpressions(adId: string, adType: string) { 
    return this.db.collection("ad_impressions").find({ adId: new ObjectId(adId), adType }).toArray(); 
  }
  async createAdClick(click: any) { 
    const result = await this.db.collection("ad_clicks").insertOne(click);
    return { ...click, _id: result.insertedId };
  }
  async getAdClicks(adId: string, adType: string) { 
    return this.db.collection("ad_clicks").find({ adId: new ObjectId(adId), adType }).toArray(); 
  }
  async createAdRevenue(revenue: any) { 
    const result = await this.db.collection("ad_revenue").insertOne(revenue);
    return { ...revenue, _id: result.insertedId };
  }
  async getAdRevenue(adId: string, adType: string) { 
    return this.db.collection("ad_revenue").find({ adId: new ObjectId(adId), adType }).toArray(); 
  }
  async getAdRevenueByArtist(artistId: string) { 
    return this.db.collection("ad_revenue").find({ artistId: new ObjectId(artistId) }).toArray(); 
  }
  async getAdStats(adId: string, adType: string) {
    const impressions = await this.db.collection("ad_impressions").countDocuments({ adId: new ObjectId(adId), adType });
    const clicks = await this.db.collection("ad_clicks").countDocuments({ adId: new ObjectId(adId), adType });
    const revenueData = await this.db.collection("ad_revenue").find({ adId: new ObjectId(adId), adType }).toArray();
    const revenue = revenueData.reduce((sum, r) => sum + r.amount, 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    
    return { impressions, clicks, ctr, revenue };
  }

  // Stub methods for analytics operations
  async logAnalytics(analytics: any): Promise<void> { 
    
  }
  
  async getRecentPlaysByUser(userId: string): Promise<any[]> { 
    
    return []; 
  }

  // System Settings methods
  async getSystemSettings(): Promise<any> {
    return this.db.collection("system_settings").findOne({});
  }

  async updateSystemSettings(updates: any): Promise<any> {
    return this.db.collection("system_settings").updateOne(
      {},
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  // Direct database access for admin operations
  get db() {
    return this.userStorage.db;
  }

  // Direct client access for transactions
  get client() {
    return (this.userStorage as any).client;
  }

  // Platform Statistics methods
  async getArtistsCount(): Promise<number> {
    // Artists are stored in users collection with role: 'artist'
    return this.db.collection("users").countDocuments({ role: "artist" });
  }

  async getSongsCount(): Promise<number> {
    return this.db.collection("songs").countDocuments({});
  }

  async getFansCount(): Promise<number> {
    // Fans are users with role: "user" or "fan"
    return this.db.collection("users").countDocuments({ 
      $or: [
        { role: "user" },
        { role: "fan" }
      ]
    });
  }

  async getTotalPlays(): Promise<number> {
    // Sum up all play counts from songs
    const result = await this.db.collection("songs").aggregate([
      {
        $group: {
          _id: null,
          totalPlays: { $sum: { $ifNull: ["$playCount", 0] } }
        }
      }
    ]).toArray();
    
    return result.length > 0 ? result[0].totalPlays : 0;
  }
}

// Export the main storage instance
export const storage = new MongoStorage();

// Export individual storage classes for advanced usage
export {
  UserStorage,
  ContentStorage,
  CommerceStorage
};

