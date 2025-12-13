import { ObjectId, Collection } from "mongodb";
import { BaseStorage } from "./base";
import { Song, InsertSong, Merch, InsertMerch, Event, InsertEvent, Ticket, InsertTicket, Blog, InsertBlog } from "../../shared/schemas";

// MongoDB document types (with ObjectId)
interface SongDoc extends Omit<Song, '_id' | 'artistId'> {
  _id: ObjectId;
  artistId: ObjectId; // ObjectId in database
}

interface MerchDoc extends Omit<Merch, '_id'> {
  _id: ObjectId;
}

interface EventDoc extends Omit<Event, '_id'> {
  _id: ObjectId;
}

interface TicketDoc extends Omit<Ticket, '_id' | 'orderId' | 'eventId' | 'userId' | 'checkedInBy'> {
  _id: ObjectId;
  orderId: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  checkedInBy?: ObjectId;
}

interface BlogDoc extends Omit<Blog, '_id' | 'artistId'> {
  _id: ObjectId;
  artistId: ObjectId;
}

export class ContentStorage extends BaseStorage {
  private songs: Collection<SongDoc>;
  private merch: Collection<MerchDoc>;
  private events: Collection<EventDoc>;
  private tickets: Collection<TicketDoc>;
  private blogs: Collection<BlogDoc>;

  constructor() {
    super();
    this.songs = this.db.collection("songs");
    this.merch = this.db.collection("merch");
    this.events = this.db.collection("events");
    this.tickets = this.db.collection("tickets");
    this.blogs = this.db.collection("blogs");
  }

  private convertSongDoc(doc: SongDoc): Song {
    return {
      ...doc,
      _id: doc._id.toString(),
      artistId: doc.artistId.toString(), // Convert ObjectId to string
      artistName: doc.artistName || "Unknown Artist" // Fallback for missing artist names
    };
  }

  private convertMerchDoc(doc: MerchDoc): Merch {
    return {
      ...doc,
      _id: doc._id.toString()
    };
  }

  private convertEventDoc(doc: EventDoc): Event {
    return {
      ...doc,
      _id: doc._id.toString()
    };
  }

  private convertTicketDoc(doc: TicketDoc): Ticket {
    return {
      ...doc,
      _id: doc._id.toString(),
      orderId: doc.orderId.toString(),
      eventId: doc.eventId.toString(),
      userId: doc.userId.toString(),
      checkedInBy: doc.checkedInBy?.toString()
    };
  }

  private convertBlogDoc(doc: BlogDoc): Blog {
    return {
      ...doc,
      _id: doc._id.toString(),
      artistId: doc.artistId.toString()
    };
  }

  // Song methods
  async getSong(id: string): Promise<Song | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const song = await this.songs.findOne({ _id: new ObjectId(id) });
      return song ? this.convertSongDoc(song) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getSongsByArtist(artistId: string): Promise<Song[]> {
    try {
      if (!ObjectId.isValid(artistId)) return [];
      const songs = await this.songs.find({ artistId: new ObjectId(artistId) } as any).toArray();
      return songs.map(s => this.convertSongDoc(s));
    } catch (error) {
      
      return [];
    }
  }

  async createSong(song: InsertSong): Promise<Song> {
    const songDoc: Omit<SongDoc, '_id'> = {
      ...song,
      artistId: new ObjectId(song.artistId), // Ensure artistId is ObjectId
      createdAt: new Date()
    };

    const result = await this.songs.insertOne(songDoc as SongDoc);
    const newSong = await this.songs.findOne({ _id: result.insertedId });
    return this.convertSongDoc(newSong!);
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      const { _id, artistId, ...updateData } = updates;
      
      // Convert artistId to ObjectId if provided
      const docUpdates: any = { ...updateData };
      if (artistId) {
        docUpdates.artistId = new ObjectId(artistId);
      }

      await this.songs.updateOne(
        { _id: new ObjectId(id) },
        { $set: docUpdates }
      );

      return this.getSong(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async deleteSong(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;
      const result = await this.songs.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  async getTrendingSongs(limit = 10): Promise<Song[]> {
    try {
      const songs = await this.songs.find({
        visibility: "PUBLIC"
      })
        .sort({ plays: -1, likes: -1, createdAt: -1 })
        .limit(limit)
        .toArray();
      return songs.map(s => this.convertSongDoc(s));
    } catch (error) {
      
      return [];
    }
  }

  async searchSongs(query: string): Promise<Song[]> {
    try {
      const songs = await this.songs.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { genre: { $regex: query, $options: 'i' } }
        ]
      }).toArray();
      return songs.map(s => this.convertSongDoc(s));
    } catch (error) {
      
      return [];
    }
  }

  async searchMerch(query: string): Promise<Merch[]> {
    try {
      const merch = await this.merch.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }).toArray();
      return merch.map(m => this.convertMerchDoc(m));
    } catch (error) {
      
      return [];
    }
  }

  async searchEvents(query: string): Promise<Event[]> {
    try {
      const events = await this.events.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { location: { $regex: query, $options: 'i' } }
        ]
      }).toArray();
      return events.map(e => this.convertEventDoc(e));
    } catch (error) {
      
      return [];
    }
  }

  async searchBlogs(query: string): Promise<Blog[]> {
    try {
      const blogs = await this.blogs.find({
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }).toArray();
      return blogs.map(b => this.convertBlogDoc(b));
    } catch (error) {
      
      return [];
    }
  }

  async getAllSongs(options: { 
    genre?: string; 
    artistId?: string;
    search?: string;
    sort?: string; 
    limit?: number;
    offset?: number;
    includeSubscriberOnly?: boolean;  // New parameter to include subscriber-only songs
  } = {}): Promise<Song[]> {
    try {
      const { genre, artistId, search, sort = 'latest', limit = 20, offset = 0, includeSubscriberOnly = false } = options;

      // Build query
      const query: any = {};
      
      // ✅ FIX: Only filter by visibility if not including subscriber-only songs
      if (!includeSubscriberOnly) {
        query.visibility = "PUBLIC";  // Only show public songs by default
      }
      
      if (genre && genre !== 'all') {
        query.genre = { $regex: genre, $options: 'i' };
      }
      
      if (artistId) {
        query.artistId = new ObjectId(artistId);
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { artistName: { $regex: search, $options: 'i' } },
          { genre: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort
      let sortQuery: any = {};
      switch (sort) {
        case 'popular':
          sortQuery = { plays: -1, likes: -1 };
          break;
        case 'trending':
          sortQuery = { plays: -1, createdAt: -1 };
          break;
        case 'alphabetical':
          sortQuery = { title: 1 };
          break;
        case 'latest':
        default:
          sortQuery = { createdAt: -1 };
          break;
      }

      const songs = await this.songs.find(query)
        .sort(sortQuery)
        .skip(offset)
        .limit(limit)
        .toArray();

      const convertedSongs = songs.map(s => this.convertSongDoc(s));
      
      // Debug logging to check song data
      if (convertedSongs.length > 0) {
        
      }

      return convertedSongs;
    } catch (error) {
      
      return [];
    }
  }

  // Merch methods
  async getMerch(id: string): Promise<Merch | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const item = await this.merch.findOne({ _id: new ObjectId(id) });
      return item ? this.convertMerchDoc(item) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getMerchByArtist(artistId: string): Promise<Merch[]> {
    try {
      if (!artistId) return [];
      
      // Try both string and ObjectId queries since data might be inconsistent
      const stringQuery = await this.merch.find({ artistId: artistId } as any).toArray();
      const objectIdQuery = ObjectId.isValid(artistId) 
        ? await this.merch.find({ artistId: new ObjectId(artistId) } as any).toArray()
        : [];
      
      // Combine results and remove duplicates
      const allResults = [...stringQuery, ...objectIdQuery];
      const uniqueResults = allResults.filter((item, index, self) => 
        index === self.findIndex(t => t._id.toString() === item._id.toString())
      );
      
      return uniqueResults.map(m => this.convertMerchDoc(m));
    } catch (error) {
      
      return [];
    }
  }

  async createMerch(merch: InsertMerch): Promise<Merch> {
    const merchDoc: Omit<MerchDoc, '_id'> = {
      ...merch,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.merch.insertOne(merchDoc as MerchDoc);
    const newMerch = await this.merch.findOne({ _id: result.insertedId });
    return this.convertMerchDoc(newMerch!);
  }

  async updateMerch(id: string, updates: Partial<Merch>): Promise<Merch | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      const { _id, ...updateData } = updates;

      await this.merch.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updateData, updatedAt: new Date() } }
      );

      return this.getMerch(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async deleteMerch(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;
      const result = await this.merch.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  async getAllMerch(): Promise<Merch[]> {
    try {
      const items = await this.merch.find({}).toArray();
      return items.map(m => this.convertMerchDoc(m));
    } catch (error) {
      
      return [];
    }
  }

  async getAllMerchFiltered(filters: any): Promise<Merch[]> {
    try {
      // Clean up undefined filter values
      const cleanFilters: any = {};
      
      if (filters.artistId) {
        cleanFilters.artistId = filters.artistId;
      }
      
      if (filters.category) {
        cleanFilters.category = filters.category;
      }
      
      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        cleanFilters.price = {};
        if (filters.minPrice !== undefined) {
          cleanFilters.price.$gte = filters.minPrice;
        }
        if (filters.maxPrice !== undefined) {
          cleanFilters.price.$lte = filters.maxPrice;
        }
      }

      const items = await this.merch.find(cleanFilters).toArray();
      return items.map(m => this.convertMerchDoc(m));
    } catch (error) {
      
      return [];
    }
  }

  // Event methods
  async getEvent(id: string): Promise<Event | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const event = await this.events.findOne({ _id: new ObjectId(id) });
      return event ? this.convertEventDoc(event) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getEventsByArtist(artistId: string): Promise<Event[]> {
    try {
      if (!artistId) {
        
        return [];
      }
      
      
      
      // Try both string and ObjectId queries
      let events: any[] = [];
      
      try {
        // First try with string comparison
        
        events = await this.events.find({ artistId: artistId }).toArray();
        
        
        if (events.length === 0 && ObjectId.isValid(artistId)) {
          // Try with ObjectId if string query failed
          
          events = await this.events.find({ artistId: new ObjectId(artistId) } as any).toArray();
          
        }
      } catch (queryError) {
        
        return [];
      }
      
      
      const convertedEvents = events.map(e => this.convertEventDoc(e));
      
      return convertedEvents;
    } catch (error) {
      
      return [];
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const eventDoc: Omit<EventDoc, '_id'> = {
      ...event,
      createdAt: new Date()
    };

    
    const result = await this.events.insertOne(eventDoc as EventDoc);
    
    
    const newEvent = await this.events.findOne({ _id: result.insertedId });
    
    
    return this.convertEventDoc(newEvent!);
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      const { _id, ...updateData } = updates;

      await this.events.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      return this.getEvent(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;
      const result = await this.events.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  async getUpcomingEvents(): Promise<Event[]> {
    try {
      const events = await this.events.find({
        date: { $gte: new Date() }
      }).sort({ date: 1 }).toArray();
      return events.map(e => this.convertEventDoc(e));
    } catch (error) {
      
      return [];
    }
  }

  async getAllEventsFiltered(filters: any): Promise<Event[]> {
    try {
      // Clean up undefined filter values
      const cleanFilters: any = {};
      
      if (filters.artistId) {
        cleanFilters.artistId = filters.artistId;
      }
      
      if (filters.type) {
        cleanFilters.type = filters.type;
      }
      
      if (filters.startDate || filters.endDate) {
        cleanFilters.date = {};
        if (filters.startDate) {
          cleanFilters.date.$gte = filters.startDate;
        }
        if (filters.endDate) {
          cleanFilters.date.$lte = filters.endDate;
        }
      }

      const events = await this.events.find(cleanFilters)
        .sort({ date: 1 })
        .toArray();
      return events.map(e => this.convertEventDoc(e));
    } catch (error) {
      
      return [];
    }
  }

  // ========================================
  // TICKET METHODS
  // ========================================

  async getTicket(id: string): Promise<Ticket | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const ticket = await this.tickets.findOne({ _id: new ObjectId(id) });
      return ticket ? this.convertTicketDoc(ticket) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getTicketByNumber(ticketNumber: string): Promise<Ticket | undefined> {
    try {
      const ticket = await this.tickets.findOne({ ticketNumber });
      return ticket ? this.convertTicketDoc(ticket) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getTicketsByOrder(orderId: string): Promise<Ticket[]> {
    try {
      if (!ObjectId.isValid(orderId)) return [];
      const tickets = await this.tickets.find({ orderId: new ObjectId(orderId) }).toArray();
      return tickets.map(t => this.convertTicketDoc(t));
    } catch (error) {
      
      return [];
    }
  }

  async getTicketsByEvent(eventId: string): Promise<Ticket[]> {
    try {
      if (!ObjectId.isValid(eventId)) return [];
      const tickets = await this.tickets.find({ eventId: new ObjectId(eventId) }).toArray();
      return tickets.map(t => this.convertTicketDoc(t));
    } catch (error) {
      
      return [];
    }
  }

  async getTicketsByUser(userId: string): Promise<Ticket[]> {
    try {
      if (!ObjectId.isValid(userId)) return [];
      const tickets = await this.tickets.find({ userId: new ObjectId(userId) }).toArray();
      return tickets.map(t => this.convertTicketDoc(t));
    } catch (error) {
      
      return [];
    }
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    try {
      const ticketDoc: Omit<TicketDoc, '_id'> = {
        ...ticket,
        orderId: new ObjectId(ticket.orderId),
        eventId: new ObjectId(ticket.eventId),
        userId: new ObjectId(ticket.userId),
        checkedInBy: ticket.checkedInBy ? new ObjectId(ticket.checkedInBy) : undefined,
        createdAt: new Date()
      };

      const result = await this.tickets.insertOne(ticketDoc as TicketDoc);
      const newTicket = await this.tickets.findOne({ _id: result.insertedId });
      return this.convertTicketDoc(newTicket!);
    } catch (error) {
      
      throw error;
    }
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      const { _id, orderId, eventId, userId, checkedInBy, ...updateData } = updates;
      
      // Convert ObjectId fields if provided
      const docUpdates: any = { 
        ...updateData, 
        updatedAt: new Date() 
      };
      
      if (orderId) docUpdates.orderId = new ObjectId(orderId);
      if (eventId) docUpdates.eventId = new ObjectId(eventId);
      if (userId) docUpdates.userId = new ObjectId(userId);
      if (checkedInBy) docUpdates.checkedInBy = new ObjectId(checkedInBy);

      await this.tickets.updateOne(
        { _id: new ObjectId(id) },
        { $set: docUpdates }
      );

      return this.getTicket(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async checkInTicket(ticketId: string, checkedInBy: string): Promise<Ticket | undefined> {
    try {
      if (!ObjectId.isValid(ticketId) || !ObjectId.isValid(checkedInBy)) return undefined;

      await this.tickets.updateOne(
        { _id: new ObjectId(ticketId) },
        { 
          $set: { 
            status: 'USED',
            checkedInAt: new Date(),
            checkedInBy: new ObjectId(checkedInBy),
            updatedAt: new Date()
          }
        }
      );

      return this.getTicket(ticketId);
    } catch (error) {
      
      return undefined;
    }
  }

  async getEventTicketStats(eventId: string): Promise<{
    totalTickets: number;
    soldTickets: number;
    availableTickets: number;
    checkedInTickets: number;
    validTickets: number;
  }> {
    try {
      if (!ObjectId.isValid(eventId)) {
        return { totalTickets: 0, soldTickets: 0, availableTickets: 0, checkedInTickets: 0, validTickets: 0 };
      }

      const event = await this.events.findOne({ _id: new ObjectId(eventId) });
      if (!event) {
        return { totalTickets: 0, soldTickets: 0, availableTickets: 0, checkedInTickets: 0, validTickets: 0 };
      }

      const tickets = await this.tickets.find({ eventId: new ObjectId(eventId) }).toArray();
      
      const totalTickets = event.maxTickets || 100;
      const soldTickets = tickets.length;
      const availableTickets = Math.max(0, totalTickets - soldTickets);
      const checkedInTickets = tickets.filter(t => t.status === 'USED').length;
      const validTickets = tickets.filter(t => t.status === 'VALID').length;

      return {
        totalTickets,
        soldTickets,
        availableTickets,
        checkedInTickets,
        validTickets
      };
    } catch (error) {
      
      return { totalTickets: 0, soldTickets: 0, availableTickets: 0, checkedInTickets: 0, validTickets: 0 };
    }
  }

  async deleteTicket(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;
      const result = await this.tickets.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  // Blog methods
  async getBlog(id: string): Promise<Blog | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;
      const blog = await this.blogs.findOne({ _id: new ObjectId(id) });
      return blog ? this.convertBlogDoc(blog) : undefined;
    } catch (error) {
      
      return undefined;
    }
  }

  async getBlogsByArtist(artistId: string): Promise<Blog[]> {
    try {
      if (!artistId) return [];
      
      // Try both string and ObjectId queries since data might be inconsistent
      const stringQuery = await this.blogs.find({ artistId: artistId } as any).toArray();
      const objectIdQuery = ObjectId.isValid(artistId) 
        ? await this.blogs.find({ artistId: new ObjectId(artistId) } as any).toArray()
        : [];
      
      // Combine results and remove duplicates
      const allResults = [...stringQuery, ...objectIdQuery];
      const uniqueResults = allResults.filter((item, index, self) => 
        index === self.findIndex(t => t._id.toString() === item._id.toString())
      );
      
      return uniqueResults.map(b => this.convertBlogDoc(b));
    } catch (error) {
      
      return [];
    }
  }

  async getAllBlogs(): Promise<Blog[]> {
    try {
      const blogs = await this.blogs.find({}).sort({ createdAt: -1 }).toArray();
      return blogs.map(b => this.convertBlogDoc(b));
    } catch (error) {
      
      return [];
    }
  }

  async createBlog(blog: InsertBlog): Promise<Blog> {
    const blogDoc: Omit<BlogDoc, '_id'> = {
      ...blog,
      artistId: new ObjectId(blog.artistId), // Ensure artistId is ObjectId
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.blogs.insertOne(blogDoc as BlogDoc);
    const newBlog = await this.blogs.findOne({ _id: result.insertedId });
    return this.convertBlogDoc(newBlog!);
  }

  async updateBlog(id: string, updates: Partial<Blog>): Promise<Blog | undefined> {
    try {
      if (!ObjectId.isValid(id)) return undefined;

      const { _id, artistId, ...updateData } = updates;
      
      // Convert artistId to ObjectId if provided
      const finalUpdateData: any = { ...updateData, updatedAt: new Date() };
      if (artistId) {
        finalUpdateData.artistId = new ObjectId(artistId);
      }

      await this.blogs.updateOne(
        { _id: new ObjectId(id) },
        { $set: finalUpdateData }
      );

      return this.getBlog(id);
    } catch (error) {
      
      return undefined;
    }
  }

  async deleteBlog(id: string): Promise<boolean> {
    try {
      if (!ObjectId.isValid(id)) return false;
      const result = await this.blogs.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  // Placeholder implementations for abstract methods not implemented in this class
  async getUser(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getUserByEmail(email: string): Promise<any> { throw new Error("Not implemented"); }
  async createUser(user: any): Promise<any> { throw new Error("Not implemented"); }
  async updateUser(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }
  async getArtistByUserId(userId: string): Promise<any> { throw new Error("Not implemented"); }
  async getFeaturedArtists(limit?: number): Promise<any[]> { throw new Error("Not implemented"); }
  async getAllArtists(limit?: number): Promise<any[]> { throw new Error("Not implemented"); }

  async getOrder(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getOrdersByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createOrder(order: any): Promise<any> { throw new Error("Not implemented"); }
  async updateOrder(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

  async getSubscription(id: string): Promise<any> { throw new Error("Not implemented"); }
  async getSubscriptionsByUser(userId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async getSubscriptionsByArtist(artistId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async createSubscription(subscription: any): Promise<any> {
    try {
      // Add subscription to the fan's subscriptions array
      await this.db.collection("users").updateOne(
        { _id: new ObjectId(subscription.fanId) },
        {
          $push: {
            subscriptions: {
              artistId: new ObjectId(subscription.artistId),
              tier: subscription.tier,
              startDate: subscription.startDate,
              endDate: subscription.endDate,
              active: subscription.active
            }
          }
        } as any
      );

      // Update artist's revenue
      await this.db.collection("users").updateOne(
        { _id: new ObjectId(subscription.artistId) },
        {
          $inc: {
            "artist.revenue.subscriptions": subscription.amount,
            "artist.availableBalance": subscription.amount // Artist gets 100% of fan subscription
          }
        }
      );

      // Create a subscription record for tracking
      const result = await this.db.collection("subscriptions").insertOne({
        ...subscription,
        _id: new ObjectId(),
        fanId: new ObjectId(subscription.fanId),
        artistId: new ObjectId(subscription.artistId),
        createdAt: new Date()
      });

      return { _id: result.insertedId, ...subscription };
    } catch (error) {
      
      throw error;
    }
  }
  async updateSubscription(id: string, updates: Partial<any>): Promise<any> { throw new Error("Not implemented"); }

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
  async getArtistNameByProfileId(artistId: string): Promise<string> { throw new Error("Not implemented"); }
  async getSongsWithArtistNames(options?: { genre?: string; sort?: string; limit?: number }): Promise<any[]> { throw new Error("Not implemented"); }
  async getEventsWithArtistNames(filters: any): Promise<any[]> { throw new Error("Not implemented"); }
  async getMerchWithArtistNames(filters: any): Promise<any[]> { throw new Error("Not implemented"); }

  async deleteUser(id: string): Promise<boolean> { throw new Error("Not implemented"); }
}

