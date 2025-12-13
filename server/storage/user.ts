import { ObjectId, Collection } from "mongodb";
import { BaseStorage } from "./base";
import { User, InsertUser } from "../../shared/schemas";

// MongoDB document types (with ObjectId)
interface UserDoc extends Omit<User, '_id'> {
  _id: ObjectId;
}

export class UserStorage extends BaseStorage {
  private users: Collection<UserDoc>;

  constructor() {
    super();
    this.users = this.db.collection("users");
  }

  private convertUserDoc(doc: UserDoc): User {
    return {
      ...doc,
      _id: doc._id.toString()
    };
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const user = await this.users.findOne({ _id: new ObjectId(id) });
      return user ? this.convertUserDoc(user) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Make email lookup case-insensitive
      const user = await this.users.findOne({ 
        email: { $regex: new RegExp(`^${email}$`, 'i') } 
      });
      return user ? this.convertUserDoc(user) : undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    // Don't hash the password here as it should already be hashed in the auth route
    const userDoc: Omit<UserDoc, '_id'> = {
      ...user,
      createdAt: new Date()
    };

    const result = await this.users.insertOne(userDoc as UserDoc);
    const newUser = await this.users.findOne({ _id: result.insertedId });
    return this.convertUserDoc(newUser!);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      // Remove _id from updates if present to avoid conflicts
      const { _id, ...updateData } = updates;

      await this.users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      return this.getUser(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;

      const result = await this.users.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  // Artist methods (using User collection with embedded artist data)
  async getArtistByUserId(userId: string): Promise<User | undefined> {
    try {
      if (!ObjectId.isValid(userId)) {
        
        return undefined;
      }

      const user = await this.users.findOne({ _id: new ObjectId(userId), role: 'artist' });

      if (!user) {
        
        return undefined;
      }

      // Ensure artist object exists on user
      if (!user.artist) {
        

        // Create default artist profile
        const updatedUser = await this.updateUser(userId, {
          artist: {
            bio: "",
            socialLinks: {},
            followers: [],
            totalPlays: 0,
            totalLikes: 0,
            revenue: { subscriptions: 0, merch: 0, events: 0, ads: 0, totalPaidOut: 0 },
            availableBalance: 0,
            bankDetails: {
              verified: false
            },
            trendingScore: 0,
            featured: false,
            verified: false,
          }
        });

        return updatedUser;
      }

      return this.convertUserDoc(user);
    } catch (error) {
      
      return undefined;
    }
  }

  async getFeaturedArtists(limit = 6): Promise<User[]> {
    try {
      // Get featured artists first, then fall back to all artists if no featured ones exist
      let users = await this.users.find({
        role: 'artist',
        'artist.featured': true
      }).limit(limit).toArray();

      // If no featured artists, get the most recent artists
      if (users.length === 0) {
        users = await this.users.find({ role: 'artist' }).sort({ createdAt: -1 }).limit(limit).toArray();
      }

      return users.map(u => this.convertUserDoc(u));
    } catch (error) {
      
      return [];
    }
  }

  async getAllArtists(limit = 20): Promise<User[]> {
    try {
      const users = await this.users.find({ role: 'artist' })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return users.map(u => this.convertUserDoc(u));
    } catch (error) {
      
      return [];
    }
  }

  // Helper method to get artist name by artist profile ID
  async getArtistNameByProfileId(artistId: string): Promise<string> {
    try {
      const artist = await this.getArtistByUserId(artistId);
      return artist?.name || "Unknown Artist";
    } catch (error) {
      
      return "Unknown Artist";
    }
  }

  // Search artists by name or bio
  async searchArtists(query: string): Promise<User[]> {
    try {
      const artists = await this.users.find({
        role: 'artist',
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { 'artist.bio': { $regex: query, $options: 'i' } }
        ]
      }).toArray();
      return artists.map(a => this.convertUserDoc(a));
    } catch (error) {
      
      return [];
    }
  }

  // Placeholder implementations for abstract methods not implemented in this class
  async getSong(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getSongsByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createSong(song: any): Promise<any> { throw new Error("Not implemented"); }
  async updateSong(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async deleteSong(id: string): Promise<boolean> { throw new Error("Not implemented"); }
  async getTrendingSongs(limit?: number): Promise<any[]> { throw new Error("Not implemented"); }
  async searchSongs(query: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getAllSongs(options?: { genre?: string; sort?: string; limit?: number }): Promise<any[]> { throw new Error("Not implemented"); }

  async getMerch(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getMerchByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createMerch(merch: any): Promise<any> { throw new Error("Not implemented"); }
  async updateMerch(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async deleteMerch(id: string): Promise<boolean> { throw new Error("Not implemented"); }
  async getAllMerch(): Promise<any[]> { throw new Error("Not implemented"); }
  async getAllMerchFiltered(filters: any): Promise<any[]> { throw new Error("Not implemented"); }

  async getEvent(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getEventsByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createEvent(event: any): Promise<any> { throw new Error("Not implemented"); }
  async updateEvent(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async deleteEvent(id: string): Promise<boolean> { throw new Error("Not implemented"); }
  async getUpcomingEvents(): Promise<any[]> { throw new Error("Not implemented"); }
  async getAllEventsFiltered(filters: any): Promise<any[]> { throw new Error("Not implemented"); }

  async getOrder(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getOrdersByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createOrder(order: any): Promise<any> { throw new Error("Not implemented"); }
  async updateOrder(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

  async getSubscription(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getSubscriptionsByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getSubscriptionsByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createSubscription(subscription: any): Promise<any> { throw new Error("Not implemented"); }
  async updateSubscription(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

  async getBlog(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getBlogsByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getAllBlogs(): Promise<any[]> { throw new Error("Not implemented"); }
  async createBlog(blog: any): Promise<any> { throw new Error("Not implemented"); }
  async updateBlog(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async deleteBlog(id: string): Promise<boolean> { throw new Error("Not implemented"); }

  async getPromoCode(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getPromoCodeByCode(code: string): Promise<any> { throw new Error("Not implemented"); }
  async getAllPromoCodes(): Promise<any[]> { throw new Error("Not implemented"); }
  async createPromoCode(promoCode: any): Promise<any> { throw new Error("Not implemented"); }
  async updatePromoCode(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async deletePromoCode(id: string): Promise<boolean> { throw new Error("Not implemented"); }
  async validatePromoCode(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; discount: number; message: string }> { throw new Error("Not implemented"); }

  async getOrderTracking(orderId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createOrderTracking(tracking: any): Promise<any> { throw new Error("Not implemented"); }
  async updateOrderTracking(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

  async getReturnRequest(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getReturnRequestsByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getReturnRequestsByOrder(orderId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createReturnRequest(request: any): Promise<any> { throw new Error("Not implemented"); }
  async updateReturnRequest(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

  async logAnalytics(analytics: any): Promise<void> { throw new Error("Not implemented"); }

  async getRecentPlaysByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getSongsWithArtistNames(options?: { genre?: string; sort?: string; limit?: number }): Promise<any[]> { throw new Error("Not implemented"); }
  async getEventsWithArtistNames(filters: any): Promise<any[]> { throw new Error("Not implemented"); }
  async getMerchWithArtistNames(filters: any): Promise<any[]> { throw new Error("Not implemented"); }



  async searchMerch(query: string): Promise<any[]> { throw new Error("Not implemented"); }
  async searchEvents(query: string): Promise<any[]> { throw new Error("Not implemented"); }
  async searchBlogs(query: string): Promise<any[]> { throw new Error("Not implemented"); }
}

