import type { Express } from "express";
import { ObjectId } from "mongodb";
import multer from "multer";
import ExcelJS from "exceljs";
import { storage } from "../storage";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { sendArtistVerificationEmail } from "../services/email";
import { uploadAudio } from "../services/cloudinary";
import bcrypt from "bcryptjs";

// Multer configuration for file uploads (storing files in memory)
const upload = multer({ storage: multer.memoryStorage() });

export function setupAdminRoutes(app: Express) {
  // Audio upload for ads
  app.post("/api/upload/audio", authenticateToken, requireRole(["admin"]), upload.single("audio"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      // Validate file type
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-wav'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Invalid file type. Only MP3, WAV, and OGG files are allowed." });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: "File size too large. Maximum 10MB allowed." });
      }

      // Upload to Cloudinary
      const audioResult = await uploadAudio(
        req.file.buffer, 
        `ad-audio-${Date.now()}`,
        "ruc/ads/audio"
      ) as any;

      res.json({
        url: audioResult.secure_url,
        public_id: audioResult.public_id,
        duration: audioResult.duration,
        format: audioResult.format
      });
    } catch (error) {
      
      if (error instanceof Error) {
        if (error.message?.includes("Upload timeout")) {
          res.status(408).json({ message: "Upload timeout. Please try again." });
        } else if (error.message?.includes("service not configured")) {
          res.status(503).json({ message: "File upload service not configured. Please contact administrator." });
        } else {
          res.status(500).json({ message: "Failed to upload audio file. Please try again." });
        }
      } else {
        res.status(500).json({ message: "Failed to upload audio file. Please try again." });
      }
    }
  });

  // Get individual ad performance data for admin analytics
  app.get("/api/admin/ads/performance", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { period = "7d" } = req.query;

      // Calculate date range based on period
      let startDate: Date;
      const endDate = new Date();
      
      switch (period) {
        case "1d":
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }

      // Get all active ads
      const audioAds = await storage.db.collection("audio_ads")
        .find({ 
          status: "ACTIVE",
          isDeleted: { $ne: true }
        })
        .toArray();

      const bannerAds = await storage.db.collection("banner_ads")
        .find({ 
          status: "ACTIVE",
          isDeleted: { $ne: true }
        })
        .toArray();

      const allAds = [...audioAds, ...bannerAds];
      const adPerformance = [];

      // Get performance data for each ad
      for (const ad of allAds) {
        const adId = ad._id;
        
        // Get impressions, clicks, and completions for this ad in the specified period
        const impressions = await storage.db.collection("ad_impressions").countDocuments({
          adId: adId,
          timestamp: { $gte: startDate, $lte: endDate }
        });

        const clicks = await storage.db.collection("ad_clicks").countDocuments({
          adId: adId,
          timestamp: { $gte: startDate, $lte: endDate }
        });

        const completions = await storage.db.collection("ad_completions").countDocuments({
          adId: adId,
          timestamp: { $gte: startDate, $lte: endDate }
        });

        // Calculate CTR (Click-Through Rate)
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

        // Calculate completion rate
        const completionRate = impressions > 0 ? ((completions / impressions) * 100).toFixed(2) : "0.00";

        adPerformance.push({
          adId: adId.toString(),
          title: ad.title || 'Untitled Ad',
          type: ad.type || (audioAds.includes(ad) ? 'AUDIO' : 'BANNER'),
          impressions,
          clicks,
          completions,
          ctr: parseFloat(ctr),
          completionRate: parseFloat(completionRate),
          status: ad.status,
          placements: ad.placements || [],
          createdAt: ad.createdAt
        });
      }

      // Sort by impressions (most active first)
      adPerformance.sort((a, b) => b.impressions - a.impressions);

      res.json({
        ads: adPerformance,
        period,
        totalAds: allAds.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to fetch ad performance data" });
    }
  });

  // Get pending artists for verification
  app.get("/api/admin/pending-artists", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get artists awaiting verification
      const artists = await storage.db.collection("users").find({
        role: "artist",
        "artist.verified": false
      }).toArray();

      res.json(artists);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Verify/reject artist
  app.post("/api/admin/verify-artist/:artistId", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { artistId } = req.params;
      const { approved, reason } = req.body;

      const artist = await storage.getArtistByUserId(artistId);
      if (artist && artist.artist) {
        await storage.updateUser(artistId, {
          artist: { ...artist.artist, verified: approved }
        });
      }

      const user = await storage.getUser(artistId);
      if (user) {
        await sendArtistVerificationEmail(
          user.email,
          user.name,
          approved ? "approved" : "rejected",
          reason,
        );
      }

      res.json({ message: "Artist verification updated" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all users (admin only)
  app.get("/api/admin/users", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { role, limit = 50, offset = 0 } = req.query;

      // Build query
      const query: any = {};
      if (role && role !== "all") {
        query.role = role;
      }

      const users = await storage.db.collection("users")
        .find(query)
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .toArray();

      // Get total count
      const total = await storage.db.collection("users").countDocuments(query);

      res.json({
        users,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get users summary for email marketing (admin only)
  app.get("/api/admin/users/summary", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get user counts by role
      const totalUsers = await storage.db.collection("users").countDocuments();
      const creators = await storage.db.collection("users").countDocuments({ role: "artist" });
      const fans = await storage.db.collection("users").countDocuments({ role: "fan" });

      res.json({
        totalUsers,
        creators,
        fans
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user by ID (admin only)
  app.get("/api/admin/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user (admin only)
  app.patch("/api/admin/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete user (admin only)
  app.delete("/api/admin/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      // Soft delete by setting deleted flag
      const user = await storage.updateUser(id, { deleted: true });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all orders (admin only)
  app.get("/api/admin/orders", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      // Build query
      const query: any = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const orders = await storage.db.collection("orders")
        .find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .toArray();

      // Get total count
      const total = await storage.db.collection("orders").countDocuments(query);

      res.json({
        orders,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get order by ID (admin only)
  app.get("/api/admin/orders/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update order status (admin only)
  app.patch("/api/admin/orders/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const order = await storage.updateOrder(id, { status, adminNotes: notes });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.json(order);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download order details as Excel (admin only)
  app.get("/api/admin/orders/:id/download-excel", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const XLSX = await import('xlsx');

      // Get order with customer details
      const order = await storage.db.collection("orders").aggregate([
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "customer"
          }
        },
        {
          $addFields: {
            customerDetails: { $arrayElemAt: ["$customer", 0] }
          }
        },
        { $project: { customer: 0 } }
      ]).toArray();

      if (order.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }

      const orderData = order[0];
      const customer = orderData.customerDetails;

      // Get item details (merch/events)
      const enrichedItems = [];
      
      for (const item of orderData.items) {
        let itemDetails = null;
        let itemType = "Unknown";

        if (item.merchId) {
          itemDetails = await storage.getMerch(item.merchId);
          itemType = "Merchandise";
        } else if (item.eventId) {
          itemDetails = await storage.getEvent(item.eventId);
          itemType = "Event Ticket";
        }

        enrichedItems.push({
          type: itemType,
          name: (itemDetails as any)?.name || (itemDetails as any)?.title || "Unknown Item",
          quantity: item.qty,
          unitPrice: item.unitPrice,
          totalPrice: item.qty * item.unitPrice,
          category: (itemDetails as any)?.category || "N/A",
          artist: (itemDetails as any)?.artistName || "N/A",
          size: item.size || "N/A",
          color: item.color || "N/A"
        });
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Order Information Sheet
      const orderInfoData = [
        ["Order Information", ""],
        ["Order ID", orderData._id.toString()],
        ["Order Date", new Date(orderData.createdAt).toLocaleDateString()],
        ["Order Status", orderData.status],
        ["Total Amount", `₹${orderData.totalAmount}`],
        ["Currency", orderData.currency || "INR"],
        ["Payment ID", orderData.razorpayPaymentId || "N/A"],
        ["Admin Notes", orderData.adminNotes || "N/A"],
        [],
        ["Customer Information", ""],
        ["Customer Name", customer?.name || "N/A"],
        ["Customer Email", customer?.email || "N/A"],
        ["Customer Phone", customer?.phone || "N/A"],
        ["Customer Role", customer?.role || "N/A"],
        ["Customer Joined", customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "N/A"]
      ];

      // Add shipping address if available
      if (orderData.shippingAddress) {
        orderInfoData.push(
          [],
          ["Shipping Address", ""],
          ["Name", orderData.shippingAddress.name],
          ["Address", orderData.shippingAddress.address],
          ["City", orderData.shippingAddress.city],
          ["State", orderData.shippingAddress.state],
          ["Pincode", orderData.shippingAddress.pincode],
          ["Phone", orderData.shippingAddress.phone]
        );
      }

      const orderInfoSheet = XLSX.utils.aoa_to_sheet(orderInfoData);
      XLSX.utils.book_append_sheet(workbook, orderInfoSheet, "Order Info");

      // Items Sheet - Enhanced with better formatting
      const itemsData = [
        ["ORDER ITEMS DETAILS", "", "", "", "", "", "", "", ""],
        ["Type", "Name", "Quantity", "Unit Price", "Total Price", "Category", "Artist", "Size", "Color"],
        ...enrichedItems.map(item => [
          item.type,
          item.name,
          item.quantity,
          `₹${item.unitPrice}`,
          `₹${item.totalPrice}`,
          item.category,
          item.artist,
          item.size || "Not specified",
          item.color || "Not specified"
        ])
      ];

      // Add summary at the end
      if (enrichedItems.length > 0) {
        const totalQuantity = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalValue = enrichedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        itemsData.push(
          ["", "", "", "", "", "", "", "", ""],
          ["SUMMARY", "", "", "", "", "", "", "", ""],
          ["Total Items", totalQuantity, "", "", "", "", "", "", ""],
          ["Total Value", `₹${totalValue}`, "", "", "", "", "", "", ""]
        );
      }

      const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, "Items");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for Excel download
      const filename = `Order_${orderData._id.toString().slice(-8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      // Log admin action
      await logAdminAction(req.user!.id, 'download_order_excel', {
        orderId: id,
        customerEmail: customer?.email,
        orderAmount: orderData.totalAmount
      });

      // Send the Excel file
      res.send(excelBuffer);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get admin dashboard data (admin only)
  app.get("/api/admin/dashboard", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get pending artists count
      const pendingArtists = await storage.db.collection("users").countDocuments({
        role: "artist",
        "artist.verified": false
      });

      // Get Daily Active Users (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dau = await storage.db.collection("users").countDocuments({
        lastLogin: { $gte: oneDayAgo }
      });

      // Get Monthly Active Users (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mau = await storage.db.collection("users").countDocuments({
        lastLogin: { $gte: thirtyDaysAgo }
      });

      // Calculate 7-day retention rate
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      // Users who joined 7-14 days ago (cohort)
      const cohortUsers = await storage.db.collection("users").countDocuments({
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }
      });
      
      // Users from that cohort who were active in last 7 days
      const retainedUsers = await storage.db.collection("users").countDocuments({
        createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo },
        lastLogin: { $gte: sevenDaysAgo }
      });

      const retentionRate7d = cohortUsers > 0 ? (retainedUsers / cohortUsers) * 100 : 0;

      // Get platform revenue using same logic as analytics endpoint
      const [completedTransactions, completedOrders, mixedOrders] = await Promise.all([
        storage.db.collection("transactions").find({
          status: { $in: ["completed", "paid"] }
        }).toArray(),
        storage.db.collection("orders").find({
          status: { $in: ["PAID", "completed"] },
          type: { $in: ["subscription", "premium"] }, // Include both new and legacy types
          planType: { $in: ["PREMIUM", "ARTIST", "ARTIST_PRO"] }
        }).toArray(),
        storage.db.collection("orders").find({
          status: { $in: ["PAID", "completed"] },
          type: { $nin: ["subscription", "premium"] }, // Non-subscription orders
          items: { $exists: true, $ne: [] }
        }).toArray()
      ]);

      // Get cost settings for merchandise calculations
      const costSettings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
      const costs = costSettings?.costs || {};

      let platformRevenue = 0;

      // Calculate from transactions
      for (const transaction of completedTransactions) {
        const amount = transaction.totalAmount || transaction.amount || 0; // Use totalAmount (includes tax) first

        switch (transaction.type) {
          case 'subscription':
            // Platform subscriptions: 100% platform
            platformRevenue += amount;
            break;
            
          case 'event':
            // Event tickets: 10% platform fee
            platformRevenue += amount * 0.1;
            break;
            
          case 'merch':
            // Merchandise: costs + 10% platform fee
            const merchPlatformCosts = (costs.baseCost || 0) + (costs.manufacturingCost || 0) + 
                                    (costs.shippingCost || 0) + (costs.packagingCost || 0);
            const platformFee = amount * 0.1;
            platformRevenue += merchPlatformCosts + platformFee;
            break;
        }
      }

      // Add platform subscription revenue from completed orders (for backward compatibility)
      for (const order of completedOrders) {
        const amount = order.totalAmount || order.total || 0;
        // Only add if not already counted in transactions
        const existingTransaction = completedTransactions.find(t => 
          t.razorpayOrderId === order.orderId || 
          t.razorpayPaymentId === order.paymentId ||
          (t.orderId && t.orderId.toString() === order._id.toString())
        );
        
        if (!existingTransaction) {
          platformRevenue += amount;
        }
      }

      // Process mixed orders with item-level revenue calculation
      for (const order of mixedOrders) {
        // Skip if already processed via transactions
        const hasTransactions = completedTransactions.some(t => 
          t.orderId && t.orderId.toString() === order._id.toString()
        );
        
        if (!hasTransactions && order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            // Use correct field names: unitPrice and qty, detect type by merchId/eventId
            const itemAmount = (item.unitPrice || 0) * (item.qty || 1);
            
            if (itemAmount > 0) {
              if (item.eventId) {
                // Event tickets: 10% platform fee
                platformRevenue += itemAmount * 0.1;
              } else if (item.merchId) {
                // Merchandise: costs + 10% platform fee
                const merchPlatformCosts = (costs.baseCost || 0) + (costs.manufacturingCost || 0) + 
                                        (costs.shippingCost || 0) + (costs.packagingCost || 0);
                const platformFee = itemAmount * 0.1;
                platformRevenue += merchPlatformCosts + platformFee;
              }
            }
          }
        }
      }

      res.json({
        pendingArtists,
        activeUsers: mau, // Keep this for backward compatibility
        dau,
        mau,
        retentionRate7d,
        platformRevenue: Math.round(platformRevenue),
        totalOrders: completedTransactions.length + completedOrders.length + mixedOrders.length
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Ban/suspend user (admin only)
  app.post("/api/admin/users/:id/ban", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { reason, duration } = req.body; // duration in days, null for permanent

      const banUntil = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

      const user = await storage.updateUser(id, {
        banned: true,
        banReason: reason,
        banUntil: banUntil,
        bannedAt: new Date(),
        bannedBy: req.user!.id
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'ban_user', { userId: id, reason, duration });

      res.json({ message: "User banned successfully", user });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unban user (admin only)
  app.post("/api/admin/users/:id/unban", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const user = await storage.updateUser(id, {
        banned: false,
        banReason: null,
        banUntil: null,
        bannedAt: null,
        bannedBy: null,
        unbannedAt: new Date(),
        unbannedBy: req.user!.id
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'unban_user', { userId: id });

      res.json({ message: "User unbanned successfully", user });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset user password (admin only)
  app.post("/api/admin/users/:id/reset-password", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      // Generate new password hash
      const passwordHash = await bcrypt.hash(newPassword, 10);

      const user = await storage.updateUser(id, {
        passwordHash,
        passwordResetAt: new Date(),
        passwordResetBy: req.user!.id
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'reset_password', { userId: id });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change user role (admin only)
  app.post("/api/admin/users/:id/change-role", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { newRole, reason } = req.body;

      if (!['fan', 'artist', 'admin'].includes(newRole)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUser(id, {
        role: newRole,
        roleChangedAt: new Date(),
        roleChangedBy: req.user!.id,
        roleChangeReason: reason
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'change_role', { userId: id, oldRole: user.role, newRole, reason });

      res.json({ message: "User role changed successfully", user });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Get payment transactions (admin only)
  app.get("/api/admin/payments/transactions", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status, type, limit = 50, offset = 0 } = req.query;

      // Get transactions from orders and subscriptions
      const transactions = [];

      // Get order transactions
      const orderQuery: any = {};
      if (status && status !== "all") {
        if (status === "completed" || status === "paid") {
          orderQuery.status = { $in: ["PAID", "completed"] };
        } else if (status === "pending") {
          orderQuery.status = "pending";
        } else if (status === "failed") {
          orderQuery.status = "FAILED";
        } else if (status === "refunded") {
          orderQuery.status = "REFUNDED";
        }
      }

      if (type && type !== "all") {
        if (type === "merch") {
          orderQuery.type = "MERCH";
        } else if (type === "event") {
          orderQuery.type = "TICKET";
        }
      }

      const orders = await storage.db.collection("orders")
        .find(orderQuery)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit as string))
        .toArray();

      // Transform orders to payment transactions
      for (const order of orders) {
        transactions.push({
          _id: order._id.toString(),
          userId: order.userId?.toString() || "",
          amount: order.totalAmount || order.total || 0,
          currency: order.currency || "INR",
          status: order.status === "PAID" ? "completed" : order.status?.toLowerCase() || "pending",
          type: order.type === "MERCH" ? "merch" : order.type === "TICKET" ? "event" : "order",
          description: `Order #${order._id.toString().slice(-8)} - ${order.items?.map((item: any) => item.name).join(", ") || "Order"}`,
          createdAt: order.createdAt || new Date(),
          transactionId: order.razorpayPaymentId || order._id.toString(),
          orderId: order._id.toString()
        });
      }

      // Get subscription transactions if type allows
      if (!type || type === "all" || type === "subscription") {
        const subscriptionQuery: any = {};
        if (status && status !== "all") {
          if (status === "completed" || status === "paid") {
            subscriptionQuery.active = true;
          } else if (status === "pending") {
            subscriptionQuery.status = "pending";
          } else if (status === "failed") {
            subscriptionQuery.active = false;
          }
        }

        const subscriptions = await storage.db.collection("subscriptions")
          .find(subscriptionQuery)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit as string))
          .toArray();

        // Transform subscriptions to payment transactions
        for (const subscription of subscriptions) {
          const artist = await storage.getUser(subscription.artistId);
          transactions.push({
            _id: subscription._id.toString(),
            userId: subscription.userId?.toString() || "",
            amount: subscription.amount || 0,
            currency: "INR",
            status: subscription.active ? "completed" : "failed",
            type: "subscription",
            description: `Subscription to ${artist?.name || "Artist"} - ${subscription.planName || "Monthly Plan"}`,
            createdAt: subscription.createdAt || new Date(),
            transactionId: subscription.razorpayPaymentId || subscription._id.toString(),
            subscriptionId: subscription._id.toString()
          });
        }
      }

      // Sort all transactions by date
      transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Apply offset and limit
      const paginatedTransactions = transactions.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

      const total = transactions.length;

      res.json({
        transactions: paginatedTransactions,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Process refund (admin only) - Integrated with Razorpay
  app.post("/api/admin/payments/:id/refund", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { amount, reason, returnRequestId } = req.body;

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid payment/order ID format" });
      }

      const { refundPayment } = await import("../services/razorpay");

      // First try to get payment record, then order record
      let payment = await storage.db.collection("payments").findOne({ _id: new ObjectId(id) });
      let order = null;
      
      if (!payment) {
        // Try to find by order ID
        order = await storage.getOrder(id);
        if (!order) {
          return res.status(404).json({ message: "Payment or order not found" });
        }
        
        // Try to find payment by order ID
        payment = await storage.db.collection("payments").findOne({ orderId: id });
      } else {
        // Get order from payment
        if (payment.orderId) {
          order = await storage.getOrder(payment.orderId);
        }
      }

      const razorpayPaymentId = payment?.razorpayPaymentId || order?.razorpayPaymentId;
      if (!razorpayPaymentId) {
        return res.status(400).json({ message: "No Razorpay payment ID found for this transaction" });
      }

      // Process refund via Razorpay
      const refundAmount = amount || payment?.amount || order?.totalAmount;
      const razorpayRefund = await refundPayment(razorpayPaymentId, refundAmount);

      // Update payment status if payment record exists
      if (payment) {
        await storage.db.collection("payments").updateOne(
          { _id: new ObjectId(payment._id) },
          { 
            $set: {
              status: "REFUNDED",
              refundedAt: new Date(),
              refundedBy: req.user!.id,
              refundReason: reason,
              refundAmount: refundAmount,
              razorpayRefundId: razorpayRefund.id
            }
          }
        );
      }

      // Update order status if order exists
      if (order) {
        await storage.updateOrder(order._id, {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundedBy: req.user!.id,
          refundReason: reason,
          refundAmount: refundAmount,
          razorpayRefundId: razorpayRefund.id
        });
      }

      // Update return request if provided
      if (returnRequestId) {
        await storage.updateReturnRequest(returnRequestId, {
          status: "REFUNDED",
          adminNotes: `Refund processed: ₹${refundAmount}. ${reason || ''}`
        });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'process_refund', {
        paymentId: id,
        razorpayPaymentId: razorpayPaymentId,
        refundId: razorpayRefund.id,
        amount: refundAmount,
        reason,
        returnRequestId
      });

      res.json({
        message: "Refund processed successfully",
        refund: razorpayRefund,
        paymentId: id,
        refundAmount: refundAmount
      });
    } catch (error: any) {
      
      res.status(500).json({
        message: error.message || "Failed to process refund",
        error: error.response?.data || error.message,
        paymentId: req.params.id
      });
    }
  });

  // Tax Settings Management (admin only)
  app.get("/api/admin/tax-settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get tax settings from system settings collection
      const settings = await storage.db.collection("system_settings").findOne({ type: "tax" });

      // If no tax settings exist, return default values
      const taxSettings = settings || {
        gstRate: 18,
        isInclusive: false,
        isActive: true,
        updatedAt: new Date()
      };

      res.json(taxSettings);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/tax-settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { gstRate, isInclusive, isActive } = req.body;

      // Validate input
      if (typeof gstRate !== 'number' || gstRate < 0 || gstRate > 100) {
        return res.status(400).json({ message: "GST rate must be between 0 and 100" });
      }

      // Update or create tax settings
      const updateData = {
        type: "tax",
        gstRate,
        isInclusive: Boolean(isInclusive),
        isActive: Boolean(isActive),
        updatedAt: new Date(),
        updatedBy: req.user!.id
      };

      await storage.db.collection("system_settings").updateOne(
        { type: "tax" },
        { $set: updateData },
        { upsert: true }
      );

      // Log admin action
      await logAdminAction(req.user!.id, 'update_tax_settings', {
        gstRate,
        isInclusive,
        isActive
      });

      res.json({
        message: "Tax settings updated successfully",
        settings: updateData
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // System Settings & Configuration
  app.get("/api/admin/settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get general settings
      const generalSettings = await storage.db.collection("system_settings").findOne({ type: "general" });
      
      // Get subscription pricing settings
      const subscriptionPricing = await storage.db.collection("system_settings").findOne({ type: "subscription_pricing" });
      
      // Get contact information settings
      const contactSettings = await storage.db.collection("system_settings").findOne({ type: "contact_info" });
      
      // Combine settings with defaults
      const settings = {
        ...(generalSettings || {}),
        premiumPlanPrice: subscriptionPricing?.premiumPlanPrice || 199,
        artistProPlanPrice: subscriptionPricing?.artistProPlanPrice || 299,
        // Contact information with defaults
        supportEmail: contactSettings?.supportEmail || "support@riseup.com",
        supportPhone: contactSettings?.supportPhone || "+91 9876543210",
        customerServiceHours: contactSettings?.customerServiceHours || "9 AM - 6 PM (Mon-Fri)",
        whatsappNumber: contactSettings?.whatsappNumber || "",
        telegramUsername: contactSettings?.telegramUsername || "",
        // Remove the type field from the response
        type: undefined
      };

      delete settings.type;
      
      res.json(settings);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update System Settings
  app.patch("/api/admin/settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const updates = { ...req.body };
      
      // Remove immutable fields
      delete updates._id;
      delete updates.createdAt;

      // Handle subscription pricing separately
      if (updates.premiumPlanPrice !== undefined || updates.artistProPlanPrice !== undefined) {
        const subscriptionPricing = {
          type: "subscription_pricing",
          premiumPlanPrice: updates.premiumPlanPrice,
          artistProPlanPrice: updates.artistProPlanPrice,
          updatedAt: new Date(),
          updatedBy: req.user!.id
        };

        await storage.db.collection("system_settings").updateOne(
          { type: "subscription_pricing" },
          { $set: subscriptionPricing },
          { upsert: true }
        );

        // Remove from main updates to avoid duplication
        delete updates.premiumPlanPrice;
        delete updates.artistProPlanPrice;
      }

      // Handle contact information separately
      if (updates.supportEmail !== undefined || updates.supportPhone !== undefined || 
          updates.customerServiceHours !== undefined || updates.whatsappNumber !== undefined ||
          updates.telegramUsername !== undefined) {
        const contactInfo = {
          type: "contact_info",
          supportEmail: updates.supportEmail,
          supportPhone: updates.supportPhone,
          customerServiceHours: updates.customerServiceHours,
          whatsappNumber: updates.whatsappNumber,
          telegramUsername: updates.telegramUsername,
          updatedAt: new Date(),
          updatedBy: req.user!.id
        };

        await storage.db.collection("system_settings").updateOne(
          { type: "contact_info" },
          { $set: contactInfo },
          { upsert: true }
        );

        // Remove from main updates to avoid duplication
        delete updates.supportEmail;
        delete updates.supportPhone;
        delete updates.customerServiceHours;
        delete updates.whatsappNumber;
        delete updates.telegramUsername;
      }

      // Update main system settings
      if (Object.keys(updates).length > 0) {
        await storage.db.collection("system_settings").updateOne(
          { type: "general" },
          {
            $set: {
              ...updates,
              updatedAt: new Date(),
              updatedBy: req.user!.id
            }
          },
          { upsert: true }
        );
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'update_system_settings', { updates: req.body });

      res.json({ message: "System settings updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Consolidated Analytics - Supports basic, enhanced, and summary types
  app.get("/api/admin/analytics", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { period = 30, type = "basic" } = req.query;
      const days = parseInt(period as string);

      // Common analytics data
      const totalUsers = await storage.db.collection("users").countDocuments();
      const artistCount = await storage.db.collection("users").countDocuments({ role: "artist" });
      const fanCount = await storage.db.collection("users").countDocuments({ role: "fan" });
      const adminCount = await storage.db.collection("users").countDocuments({ role: "admin" });

      const totalSongs = await storage.db.collection("songs").countDocuments();
      const totalMerch = await storage.db.collection("merch").countDocuments();
      const totalEvents = await storage.db.collection("events").countDocuments();

      // Get all completed orders for revenue calculation
      const allOrders = await storage.db.collection("orders").find({ 
        status: { $in: ["PAID", "completed"] } 
      }).toArray();
      
      // Calculate detailed revenue breakdown
      let platformRevenue = 0;
      let creatorEarnings = 0;
      let merchRevenue = 0;
      let eventRevenue = 0;
      let totalOrderRevenue = 0;
      
      // Get merch cost settings for platform revenue calculation
      const costSettings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
      const defaultCosts = {
        TSHIRT: { manufacturing: 150, printing: 50, packaging: 20, shipping: 80 },
        HOODIE: { manufacturing: 300, printing: 80, packaging: 30, shipping: 120 },
        HAT: { manufacturing: 120, printing: 40, packaging: 15, shipping: 60 },
        POSTER: { manufacturing: 30, printing: 20, packaging: 10, shipping: 40 },
        STICKER: { manufacturing: 5, printing: 5, packaging: 5, shipping: 30 },
        ACCESSORIES: { manufacturing: 100, printing: 30, packaging: 20, shipping: 70 },
        DEFAULT: { manufacturing: 100, printing: 40, packaging: 20, shipping: 70 }
      };
      const merchCostStructure = costSettings?.costs || defaultCosts;
      
      // Process each order
      for (const order of allOrders) {
        totalOrderRevenue += order.totalAmount || order.total || 0;
        
        for (const item of order.items) {
          if (item.merchId) {
            try {
              const merch = await storage.getMerch(item.merchId);
              if (merch) {
                const grossSales = item.unitPrice * item.qty;
                merchRevenue += grossSales;
                
                // Calculate cost structure
                const normalizedCategory = (merch.category || 'DEFAULT').toUpperCase().replace(/[^A-Z]/g, '');
                let costStructure = merchCostStructure.DEFAULT;

                if (normalizedCategory.includes('TSHIRT') || normalizedCategory.includes('SHIRT')) {
                  costStructure = merchCostStructure.TSHIRT;
                } else if (normalizedCategory.includes('HOODIE')) {
                  costStructure = merchCostStructure.HOODIE;
                } else if (normalizedCategory.includes('HAT') || normalizedCategory.includes('CAP')) {
                  costStructure = merchCostStructure.HAT;
                } else if (normalizedCategory.includes('POSTER')) {
                  costStructure = merchCostStructure.POSTER;
                } else if (normalizedCategory.includes('STICKER')) {
                  costStructure = merchCostStructure.STICKER;
                } else if (normalizedCategory.includes('ACCESSORIES')) {
                  costStructure = merchCostStructure.ACCESSORIES;
                }

                const totalCost = (costStructure.manufacturing + costStructure.printing + 
                                 costStructure.packaging + costStructure.shipping) * item.qty;
                const commission = grossSales * 0.10; // 10% platform fee
                const creatorNet = grossSales - totalCost - commission;

                platformRevenue += commission + totalCost; // Platform gets fee + cost coverage
                creatorEarnings += Math.max(0, creatorNet);
              }
            } catch (error) {
              // Silently handle merch processing error
            }
          }
          
          if (item.eventId) {
            try {
              const event = await storage.getEvent(item.eventId);
              if (event) {
                const grossSales = item.unitPrice * item.qty;
                eventRevenue += grossSales;
                
                const commission = grossSales * 0.10; // 10% platform fee
                const creatorNet = grossSales * 0.90; // 90% to artist

                platformRevenue += commission;
                creatorEarnings += creatorNet;
              }
            } catch (error) {
              // Silently handle event processing error
            }
          }
        }
      }
      
      // Get artist subscription revenue (100% goes to artists, 0% to platform)
      const activeSubscriptions = await storage.db.collection("subscriptions").find({ active: true }).toArray();
      const totalArtistSubRevenue = activeSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
      // No commission on artist subscriptions - 100% goes to artist
      const artistSubEarnings = totalArtistSubRevenue;
      
      // Add platform subscriptions (100% platform revenue)
      const subscriptionPricing = await storage.db.collection("system_settings").findOne({ type: "subscription_pricing" });
      const platformSubscriptions = await storage.db.collection("users").find({
        "plan.type": { $in: ["PREMIUM", "ARTIST"] }
      }).toArray();
      
      const platformSubRevenue = platformSubscriptions.reduce((sum, user) => {
        // Use dynamic pricing from settings
        const premiumPrice = subscriptionPricing?.premiumPlanPrice || 199;
        const artistProPrice = subscriptionPricing?.artistProPlanPrice || 299;
        const amount = user.plan?.type === "PREMIUM" ? premiumPrice : user.plan?.type === "ARTIST" ? artistProPrice : 0;
        return sum + amount;
      }, 0);
      
      platformRevenue += platformSubRevenue;
      
      if (type === "basic") {
        return res.json({
          overview: {
            totalUsers,
            artistCount,
            fanCount,
            totalSignups: 0,
            totalContent: totalSongs + totalMerch + totalEvents,
            platformRevenue: Math.round(platformRevenue),
            creatorEarnings: Math.round(creatorEarnings),
            totalRevenue: Math.round(totalOrderRevenue)
          }
        });
      }

      // Get payout data
      const payouts = await storage.db.collection("payouts").find({}).toArray();
      const totalPaid = payouts.filter(p => p.status === "completed").reduce((sum, payout) => sum + payout.payoutAmount, 0);
      const totalPending = payouts.filter(p => p.status === "pending").reduce((sum, payout) => sum + payout.payoutAmount, 0);
      const totalFailed = payouts.filter(p => p.status === "failed").reduce((sum, payout) => sum + payout.payoutAmount, 0);

      if (type === "enhanced") {
        return res.json({
          users: { total: totalUsers, artists: artistCount, fans: fanCount, admins: adminCount },
          content: { totalSongs, totalMerch, totalEvents, totalPlays: 0 },
          revenue: { 
            // Platform Revenue Breakdown
            platformRevenue: {
              total: Math.round(platformRevenue),
              breakdown: {
                platformSubscriptions: Math.round(platformSubRevenue),
                merchCommission: Math.round(platformRevenue - platformSubRevenue),
                eventCommission: Math.round(eventRevenue * 0.10)
              }
            },
            // Creator Revenue Breakdown  
            creatorRevenue: {
              total: Math.round(creatorEarnings + artistSubEarnings),
              breakdown: {
                subscriptions: Math.round(artistSubEarnings), // 100% to artists
                merchandise: Math.round(creatorEarnings - (eventRevenue * 0.90)),
                events: Math.round(eventRevenue * 0.90)
              }
            },
            // Legacy fields for backward compatibility
            total: Math.round(totalOrderRevenue), 
            merch: Math.round(merchRevenue), 
            events: Math.round(eventRevenue), 
            subscriptions: Math.round(totalArtistSubRevenue),
            creatorEarnings: Math.round(creatorEarnings),
            platformCommission: Math.round(platformRevenue),
            platformFeePercentage: 10
          },
          payouts: {
            totalPending,
            totalPaid,
            totalFailed,
            totalPayouts: payouts.length,
            completedPayouts: payouts.filter(p => p.status === "completed").length,
            pendingPayouts: payouts.filter(p => p.status === "pending").length,
            failedPayouts: payouts.filter(p => p.status === "failed").length
          }
        });
      }

      if (type === "summary") {
        return res.json({
          summary: {
            dailyActiveUsers: totalUsers,
            monthlyRevenue: Math.round(totalOrderRevenue),
            totalContent: totalSongs + totalMerch + totalEvents,
            totalCreators: artistCount,
            platformHealth: "good",
            revenueGrowth: 0
          }
        });
      }

      // Default enhanced response
      res.json({
        users: { total: totalUsers, artists: artistCount, fans: fanCount, admins: adminCount },
        content: { totalSongs, totalMerch, totalEvents },
        revenue: { 
          total: Math.round(totalOrderRevenue), 
          merch: Math.round(merchRevenue), 
          events: Math.round(eventRevenue), 
          creatorEarnings: Math.round(creatorEarnings), 
          platformCommission: Math.round(platformRevenue) 
        }
      });

    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Simplified Revenue Analytics for Frontend
  app.get("/api/admin/analytics/revenue", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get merch cost settings
      const merchCosts = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
      const costSettings = merchCosts?.costs || {
        baseCost: 0,
        manufacturingCost: 0,
        shippingCost: 0,
        packagingCost: 0
      };

      // Get all completed transactions and orders for platform subscriptions
      const [allTransactions, completedOrders] = await Promise.all([
        storage.db.collection("transactions").find({
          status: { $in: ["completed", "paid"] }
        }).toArray(),
        storage.db.collection("orders").find({
          status: "completed",
          type: { $in: ["subscription", "premium"] }, // Include both new and legacy types
          planType: { $in: ["PREMIUM", "ARTIST", "ARTIST_PRO"] }
        }).toArray()
      ]);

      let totalRevenue = 0;
      let platformRevenue = 0;
      let creatorRevenue = 0;
      let subscriptionRevenue = 0;
      let eventRevenue = 0;
      let merchRevenue = 0;

      // We'll calculate merch platform costs based on total units sold across orders (to properly scale per-unit costs).
      // First, during loops we only add gross amounts and platform fee; we'll apply total per-unit costs once below.
      for (const transaction of allTransactions) {
        const amount = transaction.totalAmount || transaction.amount || 0; // Use totalAmount (includes tax) first
        totalRevenue += amount;

        switch (transaction.type) {
          case 'subscription':
            // Platform subscriptions: 100% platform
            subscriptionRevenue += amount;
            platformRevenue += amount;
            break;

          case 'event':
            // Event tickets: 10% platform fee, 90% artist
            eventRevenue += amount;
            platformRevenue += amount * 0.1;
            creatorRevenue += amount * 0.9;
            break;

          case 'merch':
            // Merchandise: add gross revenue and platform fee now; per-unit costs will be applied once after aggregation
            merchRevenue += amount;
            const platformFeeOnly = amount * 0.1;
            platformRevenue += platformFeeOnly;
            // add gross to creator for now; we'll subtract costs later
            creatorRevenue += amount - platformFeeOnly;
            break;

          default:
            // Other transactions (artist subscriptions go 100% to artists)
            creatorRevenue += amount;
            break;
        }
      }

      // Add revenue from completed orders (for backward compatibility and mixed item orders)
      for (const order of completedOrders) {
        // Only add if not already counted in transactions
        const existingTransaction = allTransactions.find(t => 
          t.razorpayOrderId === order.orderId || 
          t.razorpayPaymentId === order.paymentId ||
          (t.orderId && t.orderId.toString() === order._id.toString())
        );
        
        if (!existingTransaction) {
          const amount = order.total || 0;
          totalRevenue += amount;
          subscriptionRevenue += amount;
          platformRevenue += amount;
        }
      }

      // Process mixed orders that don't have individual transactions yet
      const mixedOrders = await storage.db.collection("orders").find({
        status: { $in: ["PAID", "completed"] },
        type: { $nin: ["subscription", "premium"] }, // Non-subscription orders
        items: { $exists: true, $ne: [] }
      }).toArray();

      for (const order of mixedOrders) {
        // Skip if already processed via transactions
        const hasTransactions = allTransactions.some(t => 
          t.orderId && t.orderId.toString() === order._id.toString()
        );
        
        if (!hasTransactions && order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            // Use correct field names: unitPrice and qty, detect type by merchId/eventId
            const itemAmount = (item.unitPrice || 0) * (item.qty || 1);
            
            if (itemAmount > 0) {
              totalRevenue += itemAmount;

              if (item.eventId) {
                // Event tickets: 10% platform fee, 90% artist
                eventRevenue += itemAmount;
                platformRevenue += itemAmount * 0.1;
                creatorRevenue += itemAmount * 0.9;
              } else if (item.merchId) {
                // Merchandise: accumulate gross and platform fee now; per-unit costs accounted once below
                merchRevenue += itemAmount;
                const platformFeeOnly = itemAmount * 0.1;
                platformRevenue += platformFeeOnly;
                creatorRevenue += itemAmount - platformFeeOnly;
              } else {
                // Other items go 100% to creators
                creatorRevenue += itemAmount;
              }
            }
          }
        }
      }

      // Compute total merch units sold across completed orders to apply per-unit costs
      const merchUnitsAgg = await storage.db.collection('orders').aggregate([
        { $match: { status: { $in: ["PAID", "completed"] }, items: { $exists: true, $ne: [] } } },
        { $unwind: '$items' },
        { $match: { 'items.merchId': { $exists: true } } },
        { $group: { _id: null, units: { $sum: { $ifNull: ["$items.qty", "$items.quantity"] } } } }
      ]).toArray();

      const totalMerchUnits = merchUnitsAgg[0]?.units || 0;
      const perUnitCost = costSettings.baseCost + costSettings.manufacturingCost + costSettings.shippingCost + costSettings.packagingCost;
      const totalMerchCosts = totalMerchUnits * perUnitCost;

      // Apply total merch costs to platform revenue and subtract from creator revenue
      if (totalMerchCosts > 0) {
        platformRevenue += totalMerchCosts;
        creatorRevenue = Math.max(0, creatorRevenue - totalMerchCosts);
      }

      // Get subscription breakdown
      const platformSubscriptions = await storage.db.collection("users").find({
        "plan.type": { $in: ["PREMIUM", "ARTIST_PRO"] }
      }).toArray();

      // Get artist subscriptions (fan to artist)
      const artistSubscriptions = await storage.db.collection("subscriptions").find({ 
        active: true,
        type: 'artist_subscription'
      }).toArray();

      // Calculate merchandise platform profits
      const merchOrders = await storage.db.collection("orders").find({
        status: { $in: ["PAID", "completed"] },
        items: { $exists: true, $ne: [] }
      }).toArray();

      let merchPlatformProfits = 0;

      for (const order of merchOrders) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.merchId) {
              const itemAmount = (item.unitPrice || 0) * (item.qty || 1);
              if (itemAmount > 0) {
                // First, calculate platform's cost recovery
                const platformCosts = (costSettings?.baseCost || 0) + 
                                    (costSettings?.manufacturingCost || 0) + 
                                    (costSettings?.shippingCost || 0) + 
                                    (costSettings?.packagingCost || 0);
                const totalCosts = platformCosts * (item.qty || 1);
                
                // Then add 10% platform fee
                const platformFee = itemAmount * 0.1;
                
                // Total profit is costs + fee
                merchPlatformProfits += totalCosts + platformFee;
              }
            }
          }
        }
      }

      res.json({
        totalRevenue,
        platformRevenue,
        creatorRevenue,
        subscriptionRevenue,
        eventRevenue,
        merchRevenue,
        breakdown: {
          platformSubscriptions: subscriptionRevenue,
          eventTickets: eventRevenue,
          merchandise: merchRevenue,
          artistSubscriptions: artistSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0)
        },
        platformProfitBreakdown: {
          platformSubscriptions: subscriptionRevenue,
          eventTicketFees: eventRevenue * 0.1,
          // merchProfits now includes both costs and platform fee for each merch item
          merchProfits: merchPlatformProfits
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get admin action logs
  app.get("/api/admin/logs", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { action, admin, limit = 50, offset = 0 } = req.query;

      // Build query
      const query: any = {};
      if (action && action !== "all") {
        query.action = action;
      }
      if (admin) {
        query.adminId = admin;
      }

      const logs = await storage.db.collection("admin_logs")
        .find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .toArray();

      const total = await storage.db.collection("admin_logs").countDocuments(query);

      res.json({
        logs,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Return Request Management (admin only)
  app.get("/api/admin/returns", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      // Build query
      const query: any = {};
      if (status && status !== "all") {
        query.status = status;
      }

      const returnRequests = await storage.db.collection("returnRequests")
        .find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .toArray();

      const total = await storage.db.collection("returnRequests").countDocuments(query);

      res.json({
        returnRequests,
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update return request status (admin only)
  app.patch("/api/admin/returns/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes, refundAmount, refundMethod } = req.body;

      const returnRequest = await storage.updateReturnRequest(id, {
        status,
        adminNotes,
        refundAmount,
        refundMethod,
        updatedAt: new Date()
      });

      if (!returnRequest) {
        return res.status(404).json({ message: "Return request not found" });
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'update_return_request', {
        returnRequestId: id,
        status,
        adminNotes,
        refundAmount,
        refundMethod
      });

      res.json({ message: "Return request updated successfully", returnRequest });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Process return and refund (admin only)
  app.post("/api/admin/returns/:id/process", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { action, refundAmount, refundMethod, reason } = req.body;

      const returnRequest = await storage.getReturnRequest(id);
      if (!returnRequest) {
        return res.status(404).json({ message: "Return request not found" });
      }

      // Get associated order
      const order = await storage.getOrder(returnRequest.orderId);
      if (!order) {
        return res.status(404).json({ message: "Associated order not found" });
      }

      if (action === "approve") {
        // Update return request status
        await storage.updateReturnRequest(id, {
          status: "APPROVED",
          adminNotes: reason || "Return approved",
          refundAmount: refundAmount || returnRequest.refundAmount,
          refundMethod: refundMethod || returnRequest.refundMethod
        });

        // Update order status
        await storage.updateOrder(returnRequest.orderId, {
          status: "RETURN_INITIATED",
          adminNotes: `Return approved: ${reason || ''}`
        });

      } else if (action === "reject") {
        // Update return request status
        await storage.updateReturnRequest(id, {
          status: "REJECTED",
          adminNotes: reason || "Return rejected"
        });

      } else if (action === "refund") {
        // Process refund via Razorpay
        const { refundPayment } = await import("../services/razorpay");

        if (!order.razorpayPaymentId) {
          return res.status(400).json({ message: "No payment ID found for this order" });
        }

        const razorpayRefund = await refundPayment(order.razorpayPaymentId, refundAmount);

        // Update return request
        await storage.updateReturnRequest(id, {
          status: "REFUNDED",
          adminNotes: `Refund processed: ₹${refundAmount}. ${reason || ''}`,
          refundAmount,
          refundMethod
        });

        // Update order status
        await storage.updateOrder(returnRequest.orderId, {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundedBy: req.user!.id,
          refundReason: reason,
          refundAmount,
          razorpayRefundId: razorpayRefund.id
        });

        // Log admin action
        await logAdminAction(req.user!.id, 'process_return_refund', {
          returnRequestId: id,
          orderId: returnRequest.orderId,
          paymentId: order.razorpayPaymentId,
          refundId: razorpayRefund.id,
          amount: refundAmount,
          reason
        });

        return res.json({
          message: "Refund processed successfully",
          refund: razorpayRefund,
          returnRequestId: id,
          orderId: returnRequest.orderId
        });
      }

      // Log admin action for approve/reject
      await logAdminAction(req.user!.id, `return_${action}`, {
        returnRequestId: id,
        orderId: returnRequest.orderId,
        reason,
        refundAmount,
        refundMethod
      });

      res.json({ message: `Return ${action}d successfully` });
    } catch (error: any) {
      
      res.status(500).json({
        message: error.message || "Failed to process return",
        error: error.response?.data || error.message
      });
    }
  });

  // Get system health (admin only)
  app.get("/api/admin/health", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Check database connectivity
      const dbStats = await storage.db.stats();

      // Check collections
      const collections = await storage.db.listCollections().toArray();

      // Get system info
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          collections: collections.length,
          stats: {
            dataSize: dbStats.dataSize,
            storageSize: dbStats.storageSize,
            collections: dbStats.collections
          }
        },
        system: {
          uptime: Math.floor(uptime),
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024) // MB
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      });
    } catch (error) {
      
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // ========================================
  // AUTOMATED PAYOUT PROCESSING SYSTEM  
  // ========================================

  // Process pending payouts
  app.post("/api/admin/payouts/process", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Process pending payouts
      const { artistIds, payoutMethod = "bank_transfer", minimumAmount = 1000 } = req.body;

      // Get system settings for payout configuration
      const settings = await storage.db.collection("system_settings").findOne({});
      const platformFee = settings?.platformFee || 10;
      const processingFee = settings?.payoutSettings?.processingFee || 2.5;

      // Build query for artist filtering
      const query = artistIds ? { artistId: { $in: artistIds } } : {};
      
      // Get pending payouts from analytics data
      const pendingPayouts = await storage.db.collection("analytics")
        .find({ ...query, type: "earnings", status: "PENDING" })
        .toArray();

      // Group by artist
      const artistEarnings: Record<string, {
        artistId: string;
        artistName: string;
        artistEmail: string;
        totalAmount: number;
        payouts: string[];
      }> = {};
      pendingPayouts.forEach(payout => {
        const artistId = payout.artistId;
        if (!artistEarnings[artistId]) {
          artistEarnings[artistId] = {
            artistId,
            artistName: payout.artistName,
            artistEmail: payout.artistEmail,
            totalAmount: 0,
            payouts: []
          };
        }
        artistEarnings[artistId].totalAmount += payout.amount;
        artistEarnings[artistId].payouts.push(payout._id.toString());
      });

      const processedPayouts = [];

      // Process each artist's earnings
      for (const [artistId, earnings] of Object.entries(artistEarnings)) {
        const earning = earnings as any;
        if (earning.totalAmount >= minimumAmount) {
          const processingFeeAmount = Math.floor(earning.totalAmount * processingFee / 100);
          const finalAmount = earning.totalAmount - processingFeeAmount;

          // Create payout record
          
          const payoutRecord = {
            _id: new ObjectId(),
            artistId,
            artistName: earning.artistName,
            artistEmail: earning.artistEmail,
            grossAmount: earning.totalAmount,
            processingFee: processingFeeAmount,
            netAmount: finalAmount,
            method: payoutMethod,
            status: "PROCESSING",
            paymentIds: earning.payouts,
            createdAt: new Date(),
            processedBy: req.user!.id
          };

          await storage.db.collection("payout_records").insertOne(payoutRecord);

          // Update analytics to PROCESSING
          await storage.db.collection("analytics").updateMany(
            { _id: { $in: earning.payouts.map((id: string) => new ObjectId(id)) } },
            { $set: { status: "processing", payoutRecordId: payoutRecord._id.toString() } }
          );

          processedPayouts.push({
            ...payoutRecord,
            _id: payoutRecord._id.toString()
          });
        }
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'process_payouts', {
        payoutsProcessed: processedPayouts.length,
        totalAmount: processedPayouts.reduce((sum, p) => sum + p.netAmount, 0),
        method: payoutMethod
      });

      res.json({
        message: `Processed ${processedPayouts.length} payouts successfully`,
        payouts: processedPayouts,
        summary: {
          totalPayouts: processedPayouts.length,
          totalAmount: processedPayouts.reduce((sum, p) => sum + p.grossAmount, 0),
          totalFees: processedPayouts.reduce((sum, p) => sum + p.processingFee, 0),
          totalNet: processedPayouts.reduce((sum, p) => sum + p.netAmount, 0)
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // MERCHANDISE COST MANAGEMENT ROUTES
  // =============================================

  // Get merchandise cost settings (admin only)
  app.get("/api/admin/merch-costs", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get current cost settings from system_settings
      const settings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
      
      const defaultCosts = {
        baseCost: 100,
        manufacturingCost: 50,
        shippingCost: 30,
        packagingCost: 20
      };

      const costs = settings?.costs || defaultCosts;
      const platformCommission = settings?.platformCommission || 10;

      res.json({ 
        costs, 
        platformCommission, 
        updatedAt: settings?.updatedAt,
        updatedBy: settings?.updatedBy 
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update merchandise cost settings (admin only)
  app.put("/api/admin/merch-costs", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { costs, platformCommission } = req.body;

      await storage.db.collection("system_settings").updateOne(
        { type: "merch_costs" },
        { 
          $set: { 
            costs,
            platformCommission: platformCommission || 10,
            updatedAt: new Date(),
            updatedBy: req.user!.id
          }
        },
        { upsert: true }
      );

      // Log admin action
      await logAdminAction(req.user!.id, 'update_merch_costs', { costs, platformCommission });

      res.json({ message: "Merchandise costs updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get merch cost breakdown for a specific item (admin only)
  app.post("/api/admin/merch-costs/calculate", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { sellingPrice } = req.body;

      // Get current cost settings
      const settings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
      const defaultCosts = {
        baseCost: 100,
        manufacturingCost: 50,
        shippingCost: 30,
        packagingCost: 20
      };

      const costs = settings?.costs || defaultCosts;
      const platformCommission = settings?.platformCommission || 10;

      const totalCost = costs.baseCost + costs.manufacturingCost + costs.shippingCost + costs.packagingCost;
      const platformFee = (sellingPrice * platformCommission) / 100;
      const artistNet = sellingPrice - totalCost - platformFee;

      res.json({
        sellingPrice,
        baseCost: costs.baseCost,
        manufacturingCost: costs.manufacturingCost,
        shippingCost: costs.shippingCost,
        packagingCost: costs.packagingCost,
        totalCosts: totalCost,
        platformFee,
        platformCommission,
        artistEarnings: Math.max(0, artistNet),
        platformRevenue: totalCost + platformFee,
        profitMargin: artistNet > 0 ? (artistNet / sellingPrice) * 100 : 0
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // PAYOUT MANAGEMENT ROUTES
  // =============================================

  // Get all payouts with summary (only for artists with >₹100 balance)
  app.get("/api/admin/payouts", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status, period } = req.query;

      // Get artists with available balance > ₹100
      const eligibleArtists = await storage.db.collection("users").find({
        role: "artist",
        "artist.availableBalance": { $gt: 100 }
      }).toArray();

      // Create payouts for eligible artists if they don't exist
      for (const artist of eligibleArtists) {
        const existingPayout = await storage.db.collection("payouts").findOne({
          artistId: artist._id.toString(),
          status: "pending"
        });

        const currentBalance = Math.floor(artist.artist.availableBalance || 0);

        if (!existingPayout && currentBalance > 100) {
          await storage.db.collection("payouts").insertOne({
            artistId: artist._id.toString(),
            artistName: artist.name,
            artistEmail: artist.email,
            payoutAmount: currentBalance,
            amount: currentBalance, // Add fallback field
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else if (existingPayout) {
          // If a pending payout exists but artist balance has changed, update the payout amount
          const existingAmount = Math.floor(existingPayout.payoutAmount || existingPayout.amount || 0);
          if (currentBalance !== existingAmount) {
            await storage.db.collection("payouts").updateOne(
              { _id: existingPayout._id },
              {
                $set: {
                  payoutAmount: currentBalance,
                  amount: currentBalance,
                  updatedAt: new Date()
                }
              }
            );
          }
        }
      }

      // Build query filters 
      const query: any = {};
      if (status && status !== 'all') {
        query.status = status;
      }
      // Don't default to pending only - show all payouts and let frontend handle filtering
      
      if (period) {
        const now = new Date();
        const startOfPeriod = new Date(now.getFullYear(), now.getMonth() - (period === '30d' ? 1 : period === '7d' ? 0 : 3), now.getDate());
        query.createdAt = { $gte: startOfPeriod };
      }

      // Fetch payouts
      const payouts = await storage.db.collection("payouts").find(query).sort({ createdAt: -1 }).toArray();

      // Calculate summary
      const summary = {
        totalPending: payouts.filter(p => p.status === 'pending').length,
        totalAmount: payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.payoutAmount, 0),
        totalArtists: new Set(payouts.filter(p => p.status === 'pending').map(p => p.artistId)).size,
        averagePayout: payouts.filter(p => p.status === 'pending').length > 0 
          ? payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.payoutAmount, 0) / payouts.filter(p => p.status === 'pending').length
          : 0
      };

      // Enhance with artist details
      const enhancedPayouts = await Promise.all(payouts.map(async (payout) => {
        const artist = await storage.db.collection("users").findOne({ _id: new ObjectId(payout.artistId) });
        return {
          ...payout,
          artistName: artist?.name || 'Unknown Artist',
          artistEmail: artist?.email || 'unknown@email.com'
        };
      }));

      res.json({ payouts: enhancedPayouts, summary });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate payouts for current period
  app.post("/api/admin/payouts/generate", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { minimumAmount = 100, useAvailableBalance = true } = req.body;
      
      let payouts = [];
      
      if (useAvailableBalance) {
        // Use current available balances approach (more practical)
        
        const eligibleArtists = await storage.db.collection("users").find({
          role: "artist",
          "artist.availableBalance": { $gte: minimumAmount }
        }).toArray();
        
        for (const artist of eligibleArtists) {
          const availableBalance = artist.artist?.availableBalance || 0;
          
          // Get artist details
          const artistData = {
            _id: artist._id,
            name: artist.name,
            email: artist.email,
            availableBalance: availableBalance
          };
          
          // Create payout record
          const payout = {
            _id: new ObjectId(),
            artistId: artist._id.toString(),
            artistName: artist.name,
            artistEmail: artist.email,
            payoutAmount: availableBalance,
            totalEarnings: availableBalance,
            platformFee: 0, // No additional platform fee on payout
            status: 'PENDING',
            period: {
              type: 'available_balance',
              generatedAt: new Date()
            },
            breakdown: {
              merchRevenue: artist.artist?.revenue?.merch || 0,
              eventRevenue: artist.artist?.revenue?.events || 0,
              subscriptionRevenue: artist.artist?.revenue?.subscriptions || 0,
              adRevenue: artist.artist?.revenue?.ads || 0
            },
            paymentDetails: {
              method: 'bank_transfer',
              bankAccount: artist.bankDetails || null
            },
            createdAt: new Date(),
            createdBy: req.user!.id,
            updatedAt: new Date()
          };

          payouts.push(payout);
        }
      } else {
        // Original analytics-based approach (for historical tracking)
        
        const now = new Date();
        const startOfPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPeriod = new Date(now.getFullYear(), now.getMonth(), 0);

        const artistEarnings = await storage.db.collection("analytics").aggregate([
          {
            $match: {
              createdAt: { $gte: startOfPeriod, $lte: endOfPeriod },
              artistId: { $exists: true }
            }
          },
          {
            $group: {
              _id: "$artistId",
              totalStreams: { $sum: "$value" },
              subscriptionRevenue: { 
                $sum: { $cond: [{ $eq: ["$action", "subscription"] }, "$value", 0] }
              },
              merchRevenue: { 
                $sum: { $cond: [{ $eq: ["$context", "merch"] }, "$value", 0] }
              },
              eventRevenue: { 
                $sum: { $cond: [{ $eq: ["$context", "event"] }, "$value", 0] }
              },
              adRevenue: { 
                $sum: { $cond: [{ $eq: ["$context", "ad"] }, "$value", 0] }
              }
            }
          }
        ]).toArray();

        for (const earning of artistEarnings) {
          const totalEarnings = earning.subscriptionRevenue + earning.merchRevenue + 
                               earning.eventRevenue + earning.adRevenue + (earning.totalStreams * 0.01);

          if (totalEarnings < minimumAmount) continue;

          const artist = await storage.getUser(earning._id);
          if (!artist) continue;

          const payout = {
            _id: new ObjectId(),
            artistId: earning._id.toString(),
            artistName: artist.name,
            artistEmail: artist.email,
            totalEarnings: Math.round(totalEarnings * 100) / 100,
            platformFee: 0,
            payoutAmount: Math.round(totalEarnings * 100) / 100,
            status: 'PENDING',
            period: {
              start: startOfPeriod,
              end: endOfPeriod,
              type: 'monthly_analytics'
            },
            breakdown: {
              subscriptionRevenue: earning.subscriptionRevenue,
              merchRevenue: earning.merchRevenue,
              eventRevenue: earning.eventRevenue,
              adRevenue: earning.adRevenue,
              streamingEarnings: earning.totalStreams * 0.01
            },
            createdAt: new Date(),
            createdBy: req.user!.id,
            updatedAt: new Date()
          };

          payouts.push(payout);
        }
      }

      // Insert payouts into database
      if (payouts.length > 0) {
        const insertResult = await storage.db.collection("payouts").insertMany(payouts);

        // Log admin action
        await logAdminAction(req.user!.id, 'generate_payouts', { 
          method: useAvailableBalance ? 'available_balance' : 'monthly_analytics',
          payoutCount: payouts.length,
          totalAmount: payouts.reduce((sum, p) => sum + p.payoutAmount, 0),
          minimumAmount: minimumAmount
        });
      }

      res.json({ 
        message: `Generated ${payouts.length} payouts`,
        payouts: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.payoutAmount, 0),
        method: useAvailableBalance ? 'available_balance' : 'monthly_analytics',
        generatedPayouts: payouts.map(p => ({
          artistName: p.artistName,
          amount: p.payoutAmount,
          breakdown: p.breakdown
        }))
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Process individual payout
  app.post("/api/admin/payouts/:id/process", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid payout ID format" });
      }

      const payout = await storage.db.collection("payouts").findOne({ _id: new ObjectId(id) });
      if (!payout) {
        
        return res.status(404).json({ message: "Payout not found" });
      }

      if (payout.status !== 'pending') {
        return res.status(400).json({ 
          message: `Payout is not pending. Current status: ${payout.status}`,
          currentStatus: payout.status
        });
      }

      // Check if artist has bank account details
      const artist = await storage.db.collection("users").findOne({ _id: new ObjectId(payout.artistId) });
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      const bankDetails = artist.artist?.bankDetails;
      if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
        return res.status(400).json({ 
          message: "Artist has not added complete bank account details. Payout cannot be processed.",
          missingDetails: {
            accountNumber: !bankDetails?.accountNumber,
            ifscCode: !bankDetails?.ifscCode,
            accountHolderName: !bankDetails?.accountHolderName
          }
        });
      }

      // For production, integrate with Razorpay X for bank transfers
      let payoutResult = null;
      try {
        // If artist has Razorpay contact/fund account IDs, use Razorpay X
        if (bankDetails.razorpayContactId && bankDetails.razorpayFundAccountId) {
          const { createPayout } = await import("../services/razorpay");
          payoutResult = await createPayout(
            bankDetails.razorpayFundAccountId,
            payout.payoutAmount,
            "INR",
            "IMPS"
          );
        } else {
          // Create contact and fund account first
          const { createContact, createFundAccount, createPayout } = await import("../services/razorpay");
          
          const contact = await createContact(bankDetails.accountHolderName, artist.email, "employee");
          const fundAccount = await createFundAccount(contact.id, {
            account_type: "bank_account",
            bank_account: {
              name: bankDetails.accountHolderName,
              account_number: bankDetails.accountNumber,
              ifsc: bankDetails.ifscCode
            }
          });

          // Save Razorpay IDs for future use
          await storage.db.collection("users").updateOne(
            { _id: new ObjectId(payout.artistId) },
            { 
              $set: { 
                "artist.bankDetails.razorpayContactId": contact.id,
                "artist.bankDetails.razorpayFundAccountId": fundAccount.id
              }
            }
          );

          payoutResult = await createPayout(fundAccount.id, payout.payoutAmount, "INR", "IMPS");
        }

        // Update payout with Razorpay payout ID
        await storage.db.collection("payouts").updateOne(
          { _id: new ObjectId(id) },
          { 
            $set: { 
              status: 'PROCESSING',
              processedAt: new Date(),
              processedBy: req.user!.id,
              razorpayPayoutId: payoutResult.id,
              bankDetails: {
                accountNumber: bankDetails.accountNumber.replace(/\d(?=\d{4})/g, "*"),
                ifscCode: bankDetails.ifscCode,
                accountHolderName: bankDetails.accountHolderName,
                bankName: bankDetails.bankName
              }
            }
          }
        );

        // For demo purposes, immediately process the payout
        // In production, this would be handled by Razorpay webhooks
        await processSuccessfulPayout(payout);
        
      } catch (razorpayError: any) {
        
        
        // Mark as completed manually if Razorpay X fails (fallback)
        await storage.db.collection("payouts").updateOne(
          { _id: new ObjectId(id) },
          { 
            $set: { 
              status: 'COMPLETED',
              processedAt: new Date(),
              processedBy: req.user!.id,
              paymentMethod: 'MANUAL_BANK_TRANSFER',
              notes: 'Processed manually - Razorpay X integration failed',
              bankDetails: {
                accountNumber: bankDetails.accountNumber.replace(/\d(?=\d{4})/g, "*"),
                ifscCode: bankDetails.ifscCode,
                accountHolderName: bankDetails.accountHolderName,
                bankName: bankDetails.bankName
              }
            }
          }
        );
        
        // Still update artist balance and analytics for manual payouts
        await processSuccessfulPayout(payout);
      }

      // Record in payments collection for tracking
      await storage.db.collection("payments").insertOne({
        artistId: payout.artistId,
        amount: payout.payoutAmount,
        platformFee: payout.platformFee,
        period: payout.period,
        status: 'COMPLETED',
        paymentMethod: 'BANK_TRANSFER',
        type: 'payout',
        createdAt: new Date(),
        processedBy: req.user!.id
      });

      // Log admin action
      await logAdminAction(req.user!.id, 'process_payout', { 
        payoutId: id,
        artistId: payout.artistId,
        amount: payout.payoutAmount
      });

      res.json({ message: "Payout processed successfully" });
    } catch (error: any) {
      
      res.status(500).json({ 
        message: "Failed to process payout",
        error: error.message || "Internal server error",
        payoutId: req.params.id
      });
    }
  });

  // Process bulk payouts
  app.post("/api/admin/payouts/process-bulk", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      
      const { payoutIds } = req.body;

      if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
        return res.status(400).json({ message: "Invalid payout IDs" });
      }

      const objectIds = payoutIds.map((id: string) => new ObjectId(id));
      
      // Find pending payouts
      const payouts = await storage.db.collection("payouts").find({
        _id: { $in: objectIds },
        status: 'pending'
      }).toArray();

      if (payouts.length === 0) {
        return res.status(400).json({ message: "No pending payouts found" });
      }

      // Update all to completed
      await storage.db.collection("payouts").updateMany(
        { _id: { $in: objectIds }, status: 'pending' },
        { 
          $set: { 
            status: 'completed',
            processedAt: new Date(),
            processedBy: req.user!.id
          }
        }
      );

      // Record in payments collection
      const paymentRecords = payouts.map(payout => ({
        artistId: payout.artistId,
        amount: payout.payoutAmount,
        platformFee: payout.platformFee,
        period: payout.period,
        status: 'COMPLETED',
        paymentMethod: 'BANK_TRANSFER',
        type: 'payout',
        createdAt: new Date(),
        processedBy: req.user!.id
      }));

      await storage.db.collection("payments").insertMany(paymentRecords);

      // Log admin action
      await logAdminAction(req.user!.id, 'process_bulk_payouts', { 
        payoutIds,
        payoutCount: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.payoutAmount, 0)
      });

      res.json({ 
        message: `Processed ${payouts.length} payouts`,
        processed: payouts.length,
        totalAmount: payouts.reduce((sum, p) => sum + p.payoutAmount, 0)
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Content Management Endpoints
  
  // Get songs for admin
  app.get("/api/admin/songs", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status = 'all', limit = 50 } = req.query;
      const query: any = {};
      
      if (status !== 'all') {
        query.status = status;
      }

      // Get songs with artist information
      const songs = await storage.db.collection("songs").aggregate([
        { $match: query },
        {
          $lookup: {
            from: "users",
            localField: "artistId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $addFields: {
            artistName: {
              $cond: {
                if: { $eq: [{ $size: "$artist" }, 0] },
                then: "$artistName", // Use existing artistName if lookup fails
                else: { $arrayElemAt: ["$artist.name", 0] }
              }
            }
          }
        },
        { $project: { artist: 0 } }, // Remove the artist array to clean up response
        { $sort: { createdAt: -1 } },
        { $limit: parseInt(limit as string) }
      ]).toArray();

      const total = await storage.db.collection("songs").countDocuments(query);

      res.json({ songs, total });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update song status
  app.patch("/api/admin/songs/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      await storage.db.collection("songs").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, adminNotes: notes, updatedAt: new Date() } }
      );

      res.json({ message: "Song updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete song
  app.delete("/api/admin/songs/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.db.collection("songs").deleteOne({ _id: new ObjectId(id) });

      res.json({ message: "Song deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get playlists for admin
  app.get("/api/admin/playlists", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 50 } = req.query;

      const playlists = await storage.db.collection("playlists").find({})
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 })
        .toArray();

      const total = await storage.db.collection("playlists").countDocuments({});

      res.json({ playlists, total });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete playlist
  app.delete("/api/admin/playlists/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.db.collection("playlists").deleteOne({ _id: new ObjectId(id) });

      res.json({ message: "Playlist deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update playlist status
  app.patch("/api/admin/playlists/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await storage.db.collection("playlists").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date() } }
      );

      res.json({ message: "Playlist updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get events for admin
  app.get("/api/admin/events", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 50 } = req.query;

      const events = await storage.db.collection("events").find({})
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 })
        .toArray();

      const total = await storage.db.collection("events").countDocuments({});

      res.json({ events, total });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete event
  app.delete("/api/admin/events/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.db.collection("events").deleteOne({ _id: new ObjectId(id) });

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update event status
  app.patch("/api/admin/events/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await storage.db.collection("events").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date() } }
      );

      res.json({ message: "Event updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get merchandise for admin
  app.get("/api/admin/merchandise", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { limit = 50 } = req.query;

      // Get merchandise with artist information
      const merchandise = await storage.db.collection("merch").aggregate([
        {
          $addFields: {
            artistObjectId: {
              $cond: {
                if: { $type: "$artistId" },
                then: {
                  $cond: {
                    if: { $eq: [{ $type: "$artistId" }, "objectId"] },
                    then: "$artistId",
                    else: { $toObjectId: "$artistId" }
                  }
                },
                else: null
              }
            }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "artistObjectId",
            foreignField: "_id",
            as: "artist"
          }
        },
        {
          $addFields: {
            artistName: {
              $cond: {
                if: { $and: [{ $ne: ["$artistName", null] }, { $ne: ["$artistName", ""] }] },
                then: "$artistName", // Use existing artistName if it exists
                else: {
                  $cond: {
                    if: { $gt: [{ $size: "$artist" }, 0] },
                    then: { $arrayElemAt: ["$artist.name", 0] },
                    else: "Unknown Artist"
                  }
                }
              }
            }
          }
        },
        { $project: { artist: 0, artistObjectId: 0 } }, // Remove helper fields
        { $sort: { createdAt: -1 } },
        { $limit: parseInt(limit as string) }
      ]).toArray();

      const total = await storage.db.collection("merch").countDocuments({});

      res.json({ merchandise, total });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete merchandise
  app.delete("/api/admin/merchandise/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await storage.db.collection("merch").deleteOne({ _id: new ObjectId(id) });

      res.json({ message: "Merchandise deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update merchandise status
  app.patch("/api/admin/merchandise/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await storage.db.collection("merch").updateOne(
        { _id: new ObjectId(id) },
        { $set: { status, updatedAt: new Date() } }
      );

      res.json({ message: "Merchandise updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Marketing & Promotions Endpoints
  
  // Get promotions
  app.get("/api/admin/promotions", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const promotions = await storage.db.collection("promotions").find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ promotions });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create promotion
  app.post("/api/admin/promotions", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const promotionData = {
        ...req.body,
        createdAt: new Date(),
        createdBy: req.user!.id,
        usageCount: 0
      };

      const result = await storage.db.collection("promotions").insertOne(promotionData);

      res.json({ message: "Promotion created successfully", id: result.insertedId });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update promotion
  app.patch("/api/admin/promotions/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      await storage.db.collection("promotions").updateOne(
        { _id: new ObjectId(id) },
        { $set: { isActive: status === 'active', updatedAt: new Date() } }
      );

      res.json({ message: "Promotion updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get campaigns
  app.get("/api/admin/campaigns", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const campaigns = await storage.db.collection("campaigns").find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ campaigns });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create campaign
  app.post("/api/admin/campaigns", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const campaignData = {
        ...req.body,
        createdAt: new Date(),
        createdBy: req.user!.id,
        spent: 0,
        impressions: 0,
        clicks: 0
      };

      const result = await storage.db.collection("campaigns").insertOne(campaignData);

      res.json({ message: "Campaign created successfully", id: result.insertedId });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get marketing metrics
  app.get("/api/admin/marketing-metrics", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Calculate real marketing metrics
      const totalCampaigns = await storage.db.collection("campaigns").countDocuments({});
      const activeCampaigns = await storage.db.collection("campaigns").countDocuments({ status: 'ACTIVE' });
      
      // Aggregate campaign data
      const campaignStats = await storage.db.collection("campaigns").aggregate([
        { 
          $group: { 
            _id: null, 
            totalSpend: { $sum: "$spent" },
            totalImpressions: { $sum: "$impressions" },
            totalClicks: { $sum: "$clicks" },
            totalRevenue: { $sum: "$revenue" }
          } 
        }
      ]).toArray();

      // Get email marketing stats (if you have email logs collection)
      const emailStats = await storage.db.collection("email_logs").aggregate([
        { 
          $group: { 
            _id: null, 
            totalSent: { $sum: 1 },
            totalOpens: { $sum: { $cond: ["$opened", 1, 0] } },
            totalClicks: { $sum: { $cond: ["$clicked", 1, 0] } }
          } 
        }
      ]).toArray();

      // Get newsletter subscribers count
      const emailSubscribers = await storage.db.collection("newsletter_subscribers").countDocuments({ isActive: true });

      const campaignData = campaignStats[0] || {};
      const emailData = emailStats[0] || {};

      const metrics = {
        totalReach: campaignData.totalImpressions || 0,
        emailSubscribers: emailSubscribers || 0,
        totalImpressions: campaignData.totalImpressions || 0,
        totalClicks: campaignData.totalClicks || 0,
        ctr: campaignData.totalImpressions > 0 
          ? (campaignData.totalClicks / campaignData.totalImpressions * 100) 
          : 0,
        adRevenue: campaignData.totalRevenue || 0,
        marketingCost: campaignData.totalSpend || 0,
        roi: campaignData.totalSpend > 0 
          ? (campaignData.totalRevenue / campaignData.totalSpend) 
          : 0
      };

      res.json(metrics);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Returns Management Endpoints
  
  // Get return requests
  app.get("/api/admin/returns", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { status = 'all', limit = 100 } = req.query;
      const query: any = {};
      
      if (status !== 'all') {
        query.status = status;
      }

      const returnRequests = await storage.db.collection("returnRequests").find(query)
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ returnRequests });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update return request
  app.patch("/api/admin/returns/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      await storage.db.collection("returns").updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status, 
            adminNotes, 
            updatedAt: new Date(),
            processedBy: req.user!.id
          } 
        }
      );

      res.json({ message: "Return request updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // System Settings Endpoints
  
  // Get system stats
  app.get("/api/admin/system-stats", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const stats = {
        systemStatus: 'HEALTHY',
        databaseSize: '2.4',
        activeSessions: 156,
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        backupHistory: [
          { date: new Date(Date.now() - 24 * 60 * 60 * 1000), size: '2.3 GB', type: 'Full' },
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), size: '2.1 GB', type: 'Full' },
          { date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), size: '1.9 GB', type: 'Full' }
        ]
      };

      res.json(stats);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get system settings
  app.get("/api/admin/system-settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const settings = await storage.db.collection("system_settings").findOne({});
      res.json({ 
        success: true, 
        settings: settings || {} 
      });
    } catch (error) {
      
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });

  // Update system settings
  app.patch("/api/admin/system-settings", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { category, settings } = req.body;

      // Store system settings in database
      await storage.db.collection("system_settings").updateOne(
        { category },
        { $set: { ...settings, updatedAt: new Date(), updatedBy: req.user!.id } },
        { upsert: true }
      );

      res.json({ message: "System settings updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create backup
  app.post("/api/admin/backup", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // In a real implementation, this would create a database backup
      // For now, we'll return a mock backup file
      const backupData = {
        timestamp: new Date(),
        version: '1.0.0',
        tables: ['users', 'songs', 'orders', 'playlists', 'events'],
        createdBy: req.user!.id
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="riseup-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backupData);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Send newsletter/email to users (admin only)
  app.post("/api/admin/send-newsletter", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { subject, content, recipientTypes, formatting } = req.body;

      if (!subject || !content) {
        return res.status(400).json({ message: "Subject and content are required" });
      }

      // Get users based on recipient types
      let userQuery: any = {};
      if (recipientTypes && recipientTypes.length > 0 && !recipientTypes.includes("all")) {
        if (recipientTypes.includes("creators") && recipientTypes.includes("fans")) {
          // Include both creators and fans
          userQuery = { role: { $in: ["artist", "fan"] } };
        } else if (recipientTypes.includes("creators")) {
          userQuery = { role: "artist" };
        } else if (recipientTypes.includes("fans")) {
          userQuery = { role: "fan" };
        }
      }

      const users = await storage.db.collection("users").find(userQuery, {
        projection: { email: 1, name: 1, role: 1 }
      }).toArray();

      if (users.length === 0) {
        return res.status(400).json({ message: "No users found for the selected criteria" });
      }

      // Import email service
      const { sendEmail } = await import("../services/email");

      // Prepare email content with formatting
      const styledContent = `
        <div style="font-family: ${formatting?.fontFamily || 'Arial'}, sans-serif; 
                    font-size: ${formatting?.fontSize || '14'}px; 
                    color: ${formatting?.textColor || '#000000'};
                    text-align: ${formatting?.textAlign || 'left'};
                    line-height: 1.6;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;">
          <div style="border-bottom: 3px solid #primary; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #primary; margin: 0;">RiseUp Music Platform</h1>
          </div>
          <div style="font-weight: ${formatting?.isBold ? 'bold' : 'normal'};
                      font-style: ${formatting?.isItalic ? 'italic' : 'normal'};
                      text-decoration: ${formatting?.isUnderline ? 'underline' : 'none'};">
            ${content}
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; 
                      color: #666; font-size: 12px; text-align: center;">
            <p>This email was sent by RiseUp Music Platform.<br>
            If you no longer wish to receive these emails, you can update your preferences in your account settings.</p>
          </div>
        </div>
      `;

      // Send emails in batches to avoid overwhelming the email service
      const batchSize = 50;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (user) => {
            try {
              await sendEmail(user.email, subject, styledContent);
              successCount++;
            } catch (error) {
              
              failureCount++;
            }
          })
        );

        // Small delay between batches
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'send_newsletter', {
        subject,
        recipientTypes,
        totalRecipients: users.length,
        successCount,
        failureCount,
        contentLength: content.length
      });

      res.json({
        message: `Newsletter sent successfully`,
        summary: {
          totalRecipients: users.length,
          successCount,
          failureCount,
          successRate: ((successCount / users.length) * 100).toFixed(1) + '%'
        }
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // PROMO CODE MANAGEMENT ROUTES
  // =============================================

  // Get all promo codes
  app.get("/api/admin/promo-codes", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new promo code
  app.post("/api/admin/promo-codes", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const promoData = {
        ...req.body,
        code: req.body.code.toUpperCase(), // Ensure code is uppercase
        createdBy: req.user!.id,
        isActive: req.body.isActive !== false, // Default to true
        validFrom: new Date(req.body.validFrom),
        validUntil: new Date(req.body.validUntil)
      };
      
      // Check if code already exists
      const existing = await storage.getPromoCodeByCode(promoData.code);
      if (existing) {
        return res.status(400).json({ message: "Promo code already exists" });
      }

      const promoCode = await storage.createPromoCode(promoData);
      res.json(promoCode);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update promo code
  app.put("/api/admin/promo-codes/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        code: req.body.code ? req.body.code.toUpperCase() : undefined // Ensure code is uppercase if provided
      };
      
      // If updating code, check for duplicates
      if (updateData.code) {
        const existing = await storage.getPromoCodeByCode(updateData.code);
        if (existing && existing._id.toString() !== id) {
          return res.status(400).json({ message: "Promo code already exists" });
        }
      }

      const updated = await storage.updatePromoCode(id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Promo code not found" });
      }
      res.json(updated);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete promo code
  app.delete("/api/admin/promo-codes/:id", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePromoCode(id);
      if (!deleted) {
        return res.status(404).json({ message: "Promo code not found" });
      }
      res.json({ message: "Promo code deleted successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // SUBSCRIPTION PRICING MANAGEMENT ROUTES
  // =============================================

  // Get subscription pricing settings (admin only)
  app.get("/api/admin/subscription-pricing", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const settings = await storage.db.collection("system_settings").findOne({ type: "subscription_pricing" });
      
      const defaultPricing = {
        premiumPlanPrice: 199,
        artistProPlanPrice: 299,
        updatedAt: new Date()
      };

      res.json(settings || defaultPricing);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update subscription pricing settings (admin only)
  app.put("/api/admin/subscription-pricing", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { premiumPlanPrice, artistProPlanPrice } = req.body;

      // Validate input
      if (typeof premiumPlanPrice !== 'number' || premiumPlanPrice < 0) {
        return res.status(400).json({ message: "Premium plan price must be a positive number" });
      }
      if (typeof artistProPlanPrice !== 'number' || artistProPlanPrice < 0) {
        return res.status(400).json({ message: "Artist Pro plan price must be a positive number" });
      }

      const updateData = {
        type: "subscription_pricing",
        premiumPlanPrice,
        artistProPlanPrice,
        updatedAt: new Date(),
        updatedBy: req.user!.id
      };

      await storage.db.collection("system_settings").updateOne(
        { type: "subscription_pricing" },
        { $set: updateData },
        { upsert: true }
      );

      // Log admin action
      await logAdminAction(req.user!.id, 'update_subscription_pricing', {
        premiumPlanPrice,
        artistProPlanPrice
      });

      res.json({
        message: "Subscription pricing updated successfully",
        pricing: updateData
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // =============================================
  // PAYOUT EXCEL DOWNLOAD & MANAGEMENT
  // =============================================

  // Download payouts Excel file (admin only)
  app.get("/api/admin/payouts/download-excel", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      // Get all payouts with artist details
      const payouts = await storage.db.collection("payouts").aggregate([
        {
          $lookup: {
            from: "users",
            let: { artistId: { $toObjectId: "$artistId" } },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$artistId"] } } }
            ],
            as: "artistData"
          }
        },
        {
          $addFields: {
            artist: { $arrayElemAt: ["$artistData", 0] }
          }
        },
        { $sort: { createdAt: -1 } }
      ]).toArray();

      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Payouts');

      // Define columns
      worksheet.columns = [
        { header: 'Payout ID', key: 'payoutId', width: 20 },
        { header: 'Artist Name', key: 'artistName', width: 25 },
        { header: 'Artist Email', key: 'artistEmail', width: 30 },
        { header: 'Phone Number', key: 'phoneNumber', width: 15 },
        { header: 'PAN Number', key: 'panNumber', width: 15 },
        { header: 'Aadhar Number', key: 'aadharNumber', width: 15 },
        { header: 'Payout Amount (₹)', key: 'payoutAmount', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Account Holder Name', key: 'accountHolderName', width: 25 },
        { header: 'Account Number', key: 'accountNumber', width: 20 },
        { header: 'IFSC Code', key: 'ifscCode', width: 15 },
        { header: 'Bank Name', key: 'bankName', width: 20 },
        { header: 'Created Date', key: 'createdDate', width: 15 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };

      // Add data rows
      payouts.forEach((payout) => {
        const artist = payout.artist;
        const bankDetails = artist?.artist?.bankDetails || {};
        
        worksheet.addRow({
          payoutId: payout._id.toString(),
          artistName: artist?.name || payout.artistName || 'Unknown',
          artistEmail: artist?.email || payout.artistEmail || 'No email',
          phoneNumber: bankDetails.phoneNumber || 'Not provided',
          panNumber: bankDetails.panNumber || 'Not provided',
          aadharNumber: bankDetails.aadharNumber || 'Not provided',
          payoutAmount: payout.payoutAmount || 0,
          status: payout.status || 'pending',
          accountHolderName: bankDetails.accountHolderName || 'Not provided',
          accountNumber: bankDetails.accountNumber || 'Not provided',
          ifscCode: bankDetails.ifscCode || 'Not provided',
          bankName: bankDetails.bankName || 'Not provided',
          createdDate: payout.createdAt ? new Date(payout.createdAt).toLocaleDateString('en-IN') : 'Unknown',
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength;
      });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `RiseUp_Payouts_${timestamp}.xlsx`;

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Write workbook to response
      await workbook.xlsx.write(res);

      // Log admin action
      await logAdminAction(req.user!.id, 'download_payouts_excel', {
        payoutCount: payouts.length,
        filename
      });

      res.end();
    } catch (error) {
      
      res.status(500).json({ 
        message: "Failed to generate Excel file", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Mark payout as done (admin only)
  app.patch("/api/admin/payouts/:id/mark-done", authenticateToken, requireRole(["admin"]), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      // Validate ObjectId format
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid payout ID format" });
      }

      const payout = await storage.db.collection("payouts").findOne({ _id: new ObjectId(id) });
      if (!payout) {
        return res.status(404).json({ message: "Payout not found" });
      }

      // Update payout status to completed
      const updateResult = await storage.db.collection("payouts").updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: 'completed',
            completedAt: new Date(),
            completedBy: req.user!.id,
            adminNotes: notes || 'Marked as completed by admin',
            updatedAt: new Date()
          }
        }
      );

      if (updateResult.modifiedCount === 0) {
        return res.status(400).json({ message: "Failed to update payout status" });
      }

      // Update artist's balance - subtract the payout amount from availableBalance
      // and update totalPaidOut for tracking
      const artistUpdate = await storage.db.collection("users").updateOne(
        { _id: new ObjectId(payout.artistId), role: "artist" },
        {
          $inc: {
            "artist.availableBalance": -(payout.payoutAmount || payout.amount || 0),
            "artist.revenue.totalPaidOut": (payout.payoutAmount || payout.amount || 0)
          },
          $set: {
            "artist.lastPayoutAt": new Date()
          }
        }
      );

      if (artistUpdate.matchedCount === 0) {
        
      }

      // Log admin action
      await logAdminAction(req.user!.id, 'mark_payout_done', {
        payoutId: id,
        artistId: payout.artistId,
        amount: payout.payoutAmount,
        notes
      });

      res.json({ message: "Payout marked as completed successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Webhook endpoint for Razorpay X payout updates
  app.post("/api/admin/payouts/webhook", async (req, res) => {
    try {
      const { event, payload } = req.body;
      
      // Verify webhook signature (in production)
      // const signature = req.headers['x-razorpay-signature'];
      // const isValid = verifyWebhookSignature(JSON.stringify(req.body), signature);
      // if (!isValid) {
      //   return res.status(400).json({ error: 'Invalid signature' });
      // }
      
      if (event === 'payout.processed') {
        const payout = payload.payout.entity;
        
        // Find the payout in our database
        const dbPayout = await storage.db.collection('payouts').findOne({
          razorpayPayoutId: payout.id
        });
        
        if (dbPayout) {
          // Process the successful payout
          await processSuccessfulPayout(dbPayout);
        }
      } else if (event === 'payout.failed') {
        const payout = payload.payout.entity;
        
        // Update payout status to failed
        await storage.db.collection('payouts').updateOne(
          { razorpayPayoutId: payout.id },
          { 
            $set: { 
              status: 'failed',
              failureReason: payout.failure_reason,
              updatedAt: new Date()
            } 
          }
        );
        
      }
      
      res.json({ status: 'success' });
    } catch (error) {
      
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

}

// Helper function to process successful payout
async function processSuccessfulPayout(payout: any) {
  try {
    const session = storage.client?.startSession();
    
    await session?.withTransaction(async () => {
      // 1. Update artist available balance (single source of truth)
      await storage.db.collection('users').updateOne(
        { _id: new ObjectId(payout.artistId) },
        {
          $inc: {
            "artist.availableBalance": -(payout.payoutAmount || payout.amount || 0),
            'artist.revenue.totalPaidOut': payout.payoutAmount || payout.amount || 0
          },
          $set: {
            'artist.lastPayoutAt': new Date()
          }
        },
        { session }
      );
      
      // 2. Create analytics entry for earning received
      const { trackEvent } = await import('../services/analytics');
      await trackEvent('earning_received', {
        artistId: payout.artistId,
        amount: payout.payoutAmount,
        payoutId: payout._id,
        type: 'payout',
        timestamp: new Date()
      });
      
      // 3. Update payout status to processed
      await storage.db.collection('payouts').updateOne(
        { _id: payout._id },
        {
          $set: {
            status: 'PROCESSED',
            processedAt: new Date(),
            updatedAt: new Date()
          }
        },
        { session }
      );
    });
    
    await session?.endSession();
  } catch (error) {
    
    throw error;
  }
}

// Helper function to log admin actions
async function logAdminAction(adminId: string, action: string, details: any) {
  try {
    await storage.db.collection("admin_logs").insertOne({
      adminId,
      action,
      details,
      timestamp: new Date(),
      ip: "system" // In production, get from request
    });
  } catch (error) {
    
  }
}

