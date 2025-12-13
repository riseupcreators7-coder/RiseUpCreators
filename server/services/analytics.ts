/**
 * Analytics Service - MongoDB Implementation for Creator Dashboard
 */

import { ObjectId } from 'mongodb';

// Get database connection
let db: any = null;

async function getDb() {
  if (!db) {
    const { storage } = await import('../storage');
    db = storage.db;
  }
  return db;
}

export class AnalyticsService {
  // Enhanced analytics tracking with MongoDB implementation
  static async logPlay(userId: string, songId: string, artistId: string) {
    return await this.trackEvent(userId, 'song_play', 'audio_player', {
      songId,
      playedAt: new Date().toISOString()
    }, artistId, songId);
  }

  static async trackEvent(
    userId: string | undefined,
    action: string,
    context: string = "unknown",
    metadata: any = {},
    artistId?: string,
    songId?: string,
    value: number = 1
  ) {
    try {
      const database = await getDb();
      
      // Store analytics event in MongoDB
      const analyticsData = {
        _id: new ObjectId(),
        userId: userId || 'anonymous',
        action,
        context,
        metadata,
        artistId: artistId ? new ObjectId(artistId) : undefined,
        songId: songId ? new ObjectId(songId) : undefined,
        value,
        timestamp: new Date(),
        createdAt: new Date()
      };
      
      // Insert into analytics collection
      await database.collection('analytics').insertOne(analyticsData);
      
      return analyticsData;
    } catch (error) {
      return null;
    }
  }

  static async trackSongPlay(userId: string, songId: string, context: string = "player") {
    return await this.trackEvent(userId, 'song_play', context, {
      songId,
      playedAt: new Date().toISOString()
    }, undefined, songId);
  }

  static async trackSongLike(userId: string, songId: string, artistId?: string) {
    return await this.trackEvent(userId, 'song_like', 'song_interaction', {
      songId,
      likedAt: new Date().toISOString()
    }, artistId, songId);
  }

  static async trackSongShare(userId: string, songId: string, platform: string) {
    return await this.trackEvent(userId, 'song_share', 'social_sharing', {
      songId,
      platform,
      sharedAt: new Date().toISOString()
    }, undefined, songId);
  }

  static async trackUserLogin(userId: string) {
    return await this.trackEvent(userId, 'user_login', 'authentication', {
      loginAt: new Date().toISOString()
    });
  }

  static async trackUserSignup(userId: string) {
    return await this.trackEvent(userId, 'user_signup', 'authentication', {
      signupAt: new Date().toISOString()
    });
  }

  static async trackSearch(userId: string | undefined, query: string, results: number) {
    return await this.trackEvent(userId, 'search_performed', 'search', {
      query,
      results,
      searchedAt: new Date().toISOString()
    });
  }

  static async trackPurchase(userId: string, itemId: string, amount: number, itemType?: string, context?: string) {
    return await this.trackEvent(userId, 'purchase_made', context || 'commerce', {
      itemId,
      amount,
      itemType: itemType || 'unknown',
      purchasedAt: new Date().toISOString()
    }, undefined, undefined, amount);
  }

  static async trackSubscription(subscriptionData: any) {
    return await this.trackEvent(
      subscriptionData.userId || subscriptionData.fanId, 
      'subscription_created', 
      'subscription', 
      {
        subscriptionId: subscriptionData._id,
        artistId: subscriptionData.artistId,
        tier: subscriptionData.tier,
        amount: subscriptionData.amount,
        currency: subscriptionData.currency,
        period: subscriptionData.period,
        paymentMethod: subscriptionData.paymentMethod || 'razorpay',
        metadata: subscriptionData.metadata || {}
      }, 
      subscriptionData.artistId.toString(), 
      undefined, 
      subscriptionData.amount
    );
  }

  static async getArtistDashboard(artistId: string) {
    try {
      const database = await getDb();
      const artistObjectId = new ObjectId(artistId);
      
      // Get direct revenue data from artist profile
      const artistProfile = await database.collection('users').findOne({
        _id: artistObjectId,
        role: 'artist'
      });
      
      let directRevenue = {
        merch: artistProfile?.artist?.revenue?.merch || 0,
        events: artistProfile?.artist?.revenue?.events || 0,
        subscriptions: artistProfile?.artist?.revenue?.subscriptions || 0,
        ads: artistProfile?.artist?.revenue?.ads || 0
      };
      
      // Get revenue analytics from completed orders
      const completedOrders = await database.collection('orders').find({
        status: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
      }).toArray();
      
      let calculatedRevenue = {
        merch: 0,
        events: 0,
        subscriptions: 0
      };
      
      // Get merch cost settings for calculation (using new unified structure)
      const costSettings = await database.collection("system_settings").findOne({ type: "merch_costs" });
      const defaultUnifiedCosts = {
        baseCost: 100,
        manufacturingCost: 50,
        shippingCost: 30,
        packagingCost: 20
      };
      const unifiedCosts = costSettings?.costs || defaultUnifiedCosts;
      
      // Calculate revenue from orders for this artist
      for (const order of completedOrders) {
        // Calculate total item value (pre-tax) to determine proportion of tax-inclusive amount
        const totalItemValue = order.items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.qty), 0);
        const orderTaxInclusiveTotal = order.totalAmount || order.total || totalItemValue;
        
        for (const item of order.items) {
          if (item.merchId) {
            try {
              const merch = await database.collection('merch').findOne({ _id: new ObjectId(item.merchId) });
              if (merch && merch.artistId.toString() === artistId) {
                const itemValue = item.unitPrice * item.qty; // Use pre-tax amount for creator dashboard
                
                // Calculate cost using new unified structure (same as webhook)
                const merchPlatformCosts = (unifiedCosts.baseCost || 0) + (unifiedCosts.manufacturingCost || 0) + 
                                          (unifiedCosts.shippingCost || 0) + (unifiedCosts.packagingCost || 0);
                const platformFee = itemValue * 0.10; // 10% fee on pre-tax amount for creator dashboard
                const artistNet = itemValue - merchPlatformCosts - platformFee;
                
                calculatedRevenue.merch += Math.max(0, artistNet);
              }
            } catch (error) {
              
            }
          }
          
          if (item.eventId) {
            try {
              const event = await database.collection('events').findOne({ _id: new ObjectId(item.eventId) });
              if (event && event.artistId.toString() === artistId) {
                const itemValue = item.unitPrice * item.qty; // Use pre-tax amount for creator dashboard
                // Event tickets: Artist gets 90%, platform gets 10%
                const artistNet = itemValue * 0.90; // Artist gets 90% of pre-tax amount for creator dashboard
                calculatedRevenue.events += artistNet;
              }
            } catch (error) {
              
            }
          }
        }
      }
      
      // Get subscription revenue
      const activeSubscriptions = await database.collection('subscriptions').find({
        artistId: artistObjectId,
        active: true
      }).toArray();
      
      // Artist subscriptions: Artist gets 100% (fan-to-artist subscriptions)
      // Note: This is different from platform subscriptions which go 100% to platform
      
      // Platform subscriptions are not included in artist revenue breakdown
      
      // Use the higher values between direct and calculated (in case of sync issues)
      const finalRevenue = {
        merch: Math.max(directRevenue.merch, calculatedRevenue.merch),
        events: Math.max(directRevenue.events, calculatedRevenue.events),
        subscriptions: Math.max(directRevenue.subscriptions, calculatedRevenue.subscriptions), // Artist subscriptions from fans
        ads: directRevenue.ads
      };
      
      // Get analytics metrics (all time for total counts)
      const analyticsMetrics = await database.collection('analytics').aggregate([
        {
          $match: {
            artistId: artistObjectId
            // Remove time filter for total counts
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            totalValue: { $sum: '$value' }
          }
        }
      ]).toArray();
      
      const metrics = analyticsMetrics.reduce((acc: any, item: any) => {
        acc[item._id] = { count: item.count, value: item.totalValue };
        return acc;
      }, {});

      // Get direct counts from songs as fallback/verification
      // Handle both string and ObjectId formats for artistId
      console.log('🔍 Query Debug - artistId:', artistId);
      console.log('🔍 Query Debug - artistObjectId:', artistObjectId);
      
      const artistSongs = await database.collection('songs').find({ 
        $or: [
          { artistId: artistObjectId },
          { artistId: artistId }
        ]
      }).toArray();
      
      console.log('🔍 Query Debug - Found songs:', artistSongs.length);
      if (artistSongs.length > 0) {
        console.log('🔍 Query Debug - First song:', artistSongs[0]);
      }
      const directTotalPlays = artistSongs.reduce((sum: number, song: any) => sum + (song.plays || song.playCount || 0), 0);
      
      // Calculate total likes using favorites-based system (accurate count)
      // Count total song favorites (not unique users) - if a user has 2 songs favorited, count as 2 likes
      const songIds = artistSongs.map((s: any) => s._id.toString());
      let favoriteBasedTotalLikes = 0;
      
      if (songIds.length > 0) {
        const aggregationResult = await database.collection("users").aggregate([
          {
            $match: {
              "favorites.songs": { $in: songIds }
            }
          },
          {
            $project: {
              matchedFavorites: {
                $size: {
                  $filter: {
                    input: "$favorites.songs",
                    as: "song",
                    cond: { $in: ["$$song", songIds] }
                  }
                }
              }
            }
          },
          {
            $group: {
              _id: null,
              totalLikes: { $sum: "$matchedFavorites" }
            }
          }
        ]).toArray();
        
        favoriteBasedTotalLikes = aggregationResult.length > 0 ? aggregationResult[0].totalLikes : 0;
      }
      
      // Get available balance from artist profile
      const availableBalance = (artistProfile?.artist as any)?.availableBalance || 0;
      
      const totalEarnings = finalRevenue.merch + finalRevenue.events + finalRevenue.subscriptions + finalRevenue.ads;
      
      const result = {
        totalPlays: Math.max(metrics.song_play?.count || 0, directTotalPlays),
        totalLikes: favoriteBasedTotalLikes, // Use favorites-based calculation for accurate count
        totalShares: metrics.song_share?.count || 0,
        totalFollowers: metrics.follow?.count || 0,
        subscriptionRevenue: finalRevenue.subscriptions,
        merchRevenue: finalRevenue.merch,
        eventRevenue: finalRevenue.events,
        adRevenue: finalRevenue.ads,
        subscriberCount: activeSubscriptions.length,
        totalEarnings,
        availableBalance, // Include current available balance
        uniqueListeners: metrics.song_play?.count || 0,
        newSubscribers: activeSubscriptions.length,
        playAnalytics: [],
        likeAnalytics: [],
        shareAnalytics: []
      };
      
      return result;
      
    } catch (error) {
      
      // Fallback: Try to get direct counts from songs even if analytics fail
      try {
        const database = await getDb();
        const artistObjectId = new ObjectId(artistId);
        const artistSongs = await database.collection('songs').find({ 
          $or: [
            { artistId: artistObjectId },
            { artistId: artistId }
          ]
        }).toArray();
        const fallbackPlays = artistSongs.reduce((sum: number, song: any) => sum + (song.plays || song.playCount || 0), 0);
        
        // Use favorites-based calculation for fallback too
        const songIds = artistSongs.map((s: any) => new ObjectId(s._id));
        const fallbackLikes = songIds.length > 0 ? await database.collection("users").countDocuments({
          "favorites.songs": { $in: songIds }
        }) : 0;
        
        return {
          totalPlays: fallbackPlays,
          totalLikes: fallbackLikes,
          totalShares: 0,
          totalFollowers: 0,
          subscriptionRevenue: 0,
          subscriberCount: 0,
          merchRevenue: 0,
          eventRevenue: 0,
          totalEarnings: 0,
          availableBalance: 0,
          uniqueListeners: fallbackPlays,
          newSubscribers: 0,
          playAnalytics: [],
          likeAnalytics: [],
          shareAnalytics: []
        };
      } catch (fallbackError) {
        
        return {
          totalPlays: 0,
          totalLikes: 0,
          totalShares: 0,
          totalFollowers: 0,
          subscriptionRevenue: 0,
          subscriberCount: 0,
          merchRevenue: 0,
          eventRevenue: 0,
          totalEarnings: 0,
          availableBalance: 0,
          uniqueListeners: 0,
          newSubscribers: 0,
          playAnalytics: [],
          likeAnalytics: [],
          shareAnalytics: []
        };
      }
    }
  }

  static async getPlatformAnalytics(days: number = 30) {
    try {
      const database = await getDb();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Get basic platform metrics
      const [
        totalSignups,
        totalSubscriptions,
        totalRevenue,
        activeUsers
      ] = await Promise.all([
        database.collection('analytics').countDocuments({
          action: 'user_signup',
          timestamp: { $gte: startDate }
        }),
        database.collection('subscriptions').countDocuments({ active: true }),
        database.collection('orders').aggregate([
          { $match: { status: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]).toArray(),
        database.collection('analytics').aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: '$userId' } },
          { $count: 'uniqueUsers' }
        ]).toArray()
      ]);

      return {
        totalSignups,
        totalSubscriptions,
        totalRevenue: totalRevenue[0]?.total || 0,
        dau: activeUsers[0]?.uniqueUsers || 0,
        mau: activeUsers[0]?.uniqueUsers || 0, // Simplified
        retentionRate7d: 85, // Placeholder
        retentionRate30d: 70, // Placeholder
        trendingSongs: [],
        popularSearches: [],
        merchAnalytics: {},
        subscriptionAnalytics: { activeSubscriptions: totalSubscriptions },
        growthTrends: []
      };
    } catch (error) {
      
      return {
        totalSignups: 0,
        dau: 0,
        mau: 0,
        retentionRate7d: 0,
        retentionRate30d: 0,
        trendingSongs: [],
        popularSearches: [],
        merchAnalytics: {},
        subscriptionAnalytics: {},
        growthTrends: []
      };
    }
  }

  static async getRecentAnalyticsByArtist(artistId: string, date: Date) {
    try {
      const database = await getDb();
      const artistObjectId = new ObjectId(artistId);
      
      // Get recent events for the artist
      const recentEvents = await database.collection('analytics').find({
        artistId: artistObjectId,
        timestamp: { $gte: date }
      }).sort({ timestamp: -1 }).toArray();
      
      return recentEvents;
    } catch (error) {
      
      return [];
    }
  }

  static async trackOrder(orderData: any) {
    // Extract artist ID from the order items if not provided directly
    let artistId = orderData.artistId;
    
    if (!artistId && orderData.items && orderData.items.length > 0) {
      // Try to get artist ID from the first item
      const firstItem = orderData.items[0];
      if (firstItem.itemId) {
        try {
          const database = await getDb();
          
          // Check if it's a merch item
          if (firstItem.itemType === 'merch') {
            const merch = await database.collection('merch').findOne({ _id: new ObjectId(firstItem.itemId) });
            if (merch && merch.artistId) {
              artistId = merch.artistId.toString();
            }
          }
          // Check if it's an event item
          else if (firstItem.itemType === 'event') {
            const event = await database.collection('events').findOne({ _id: new ObjectId(firstItem.itemId) });
            if (event && event.artistId) {
              artistId = event.artistId.toString();
            }
          }
        } catch (error) {
          
        }
      }
    }
    
    return await this.trackEvent(
      orderData.userId, 
      'order_placed', 
      'commerce', 
      {
        orderId: orderData._id,
        amount: orderData.totalAmount || orderData.total,
        items: orderData.items,
        orderType: orderData.type || 'merchandise',
        extractedArtistId: artistId // Add for debugging
      }, 
      artistId, // Pass the extracted artist ID
      undefined, 
      orderData.totalAmount || orderData.total
    );
  }

  static async getPlatformMetrics(days: number = 30) {
    try {
      const database = await getDb();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        totalSongs,
        totalPlays,
        totalRevenue
      ] = await Promise.all([
        database.collection('users').countDocuments(),
        database.collection('songs').countDocuments(),
        database.collection('analytics').countDocuments({ action: 'song_play' }),
        database.collection('orders').aggregate([
          { $match: { status: { $in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]).toArray()
      ]);

      return {
        totalUsers,
        totalSongs,
        totalPlays,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalSignups: 0, // Could be calculated from user creation dates
        dau: 0, // Daily active users - would need session tracking
        mau: 0, // Monthly active users
        retentionRate7d: 0,
        retentionRate30d: 0,
        analyticsData: []
      };
    } catch (error) {
      
      return {
        totalUsers: 0,
        totalSongs: 0,
        totalPlays: 0,
        totalRevenue: 0,
        totalSignups: 0,
        dau: 0,
        mau: 0,
        retentionRate7d: 0,
        retentionRate30d: 0,
        analyticsData: []
      };
    }
  }
}

// Standalone export for trackEvent
export const trackEvent = async (
  action: string,
  metadata: any = {},
  userId?: string,
  artistId?: string,
  songId?: string,
  value: number = 1
) => {
  return await AnalyticsService.trackEvent(
    userId,
    action,
    'system',
    metadata,
    artistId,
    songId,
    value
  );
};

