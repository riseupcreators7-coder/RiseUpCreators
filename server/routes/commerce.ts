import type { Express } from "express";
import express from "express";
import { storage } from "../storage";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { createOrder, verifyPayment, verifyWebhookSignature, processWebhookEvent } from "../services/razorpay";
import { generateTicketQR, generateTicketNumber } from "../services/qr";
import { sendOrderConfirmation, sendTicketEmail } from "../services/email";
import { insertOrderSchema } from "../../shared/schemas";
import { ShiprocketService } from "../services/shiprocket";
import { AnalyticsService } from "../services/analytics";
import { ObjectId } from "mongodb";

export function setupCommerceRoutes(app: Express) {
  // Cart routes
  app.get("/api/cart", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // For now, we'll use session-based cart (could be moved to user schema)
      const cart = req.session.cart || {
        items: [],
        summary: { subtotal: 0, discount: 0, tax: 0, total: 0 },
      };
      
      // Validate cart items and update prices if needed
      if (cart.items && cart.items.length > 0) {
        const validatedItems = await Promise.all(
          cart.items.map(async (item: any) => {
            try {
              let currentPrice = item.price;
              let itemData;

              if (item.type === "merch") {
                itemData = await storage.getMerch(item.id);
                currentPrice = itemData?.price || item.price;
              } else if (item.type === "event") {
                itemData = await storage.getEvent(item.id);
                currentPrice = itemData?.ticketPrice || item.price;
              }

              // Update price if it has changed
              if (currentPrice !== item.price) {
                item.price = currentPrice;
              }

              return item;
            } catch (error) {
              
              return item; // Return original item if validation fails
            }
          })
        );

        cart.items = validatedItems;

        // Recalculate totals with updated prices
        const subtotal = cart.items.reduce(
          (sum: number, item: any) => sum + item.price * item.quantity,
          0,
        );
        const tax = (subtotal - (cart.summary?.discount || 0)) * 0.18;
        const total = subtotal - (cart.summary?.discount || 0) + tax;

        cart.summary = { 
          subtotal, 
          discount: cart.summary?.discount || 0, 
          tax, 
          total 
        };

        // Update session with validated cart
        req.session.cart = cart;
      }

      res.json(cart);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cart/add", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { type, id, quantity = 1, options = {} } = req.body;

      if (!req.session.cart) {
        req.session.cart = {
          items: [],
          summary: { subtotal: 0, discount: 0, tax: 0, total: 0 },
        };
      }

      let itemData;
      let price: number = 0;

      if (type === "merch") {
        itemData = await storage.getMerch(id);
        price = itemData?.price || 0;
      } else if (type === "event") {
        itemData = await storage.getEvent(id);
        price = itemData?.ticketPrice || 0;
      }

      if (!itemData) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Check if item already exists in cart with same options (size/color)
      const existingItemIndex = req.session.cart.items.findIndex(
        (item: any) => item.id === id && item.type === type && 
        item.size === options.size && item.color === options.color,
      );

      if (existingItemIndex > -1) {
        // Update quantity
        req.session.cart.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        req.session.cart.items.push({
          _id: `cart_${Date.now()}`,
          type,
          id,
          name:
            type === "merch"
              ? (itemData as any).name
              : (itemData as any).title,
          price,
          quantity,
          size: options.size,
          color: options.color,
          image: type === "merch"
            ? (itemData as any).images?.[0]
            : type === "event"
            ? (itemData as any).imageUrl
            : undefined,
          artistName: type === "merch"
            ? (itemData as any).artistName
            : type === "event"
            ? (itemData as any).artistName
            : undefined,
          eventDate: type === "event" ? (itemData as any).date : undefined,
          venue: type === "event" ? (itemData as any).venue : undefined,
        } as any);
      }

      // Recalculate totals
      const subtotal = req.session.cart.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );
      const tax = subtotal * 0.18; // 18% GST
      const total = subtotal + tax;

      req.session.cart.summary = { subtotal, discount: 0, tax, total };

      res.json({ message: "Item added to cart", cart: req.session.cart });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/cart/update", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { itemId, quantity } = req.body;

      if (!req.session.cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      const itemIndex = req.session.cart.items.findIndex(
        (item: any) => item._id === itemId,
      );

      if (itemIndex > -1) {
        const item = req.session.cart.items[itemIndex];
        
        // Validate quantity limits
        if (quantity > 0) {
          if (item.type === 'event' && quantity > 6) {
            return res.status(400).json({ 
              message: "Maximum 6 tickets allowed per event"
            });
          }
          
          // For events, also check availability
          if (item.type === 'event') {
            try {
              const event = await storage.getEvent(item.id);
              if (event) {
                const availableTickets = (event.maxTickets || 100) - (event.ticketsSold || 0);
                if (quantity > availableTickets) {
                  return res.status(400).json({
                    message: `Only ${availableTickets} tickets available for this event`
                  });
                }
              }
            } catch (error) {
              
            }
          }
          
          // For merch, check stock
          if (item.type === 'merch') {
            try {
              const merch = await storage.getMerch(item.id);
              if (merch && merch.stock !== undefined && quantity > merch.stock) {
                return res.status(400).json({
                  message: `Only ${merch.stock} items in stock`
                });
              }
            } catch (error) {
              
            }
          }
        }

        if (quantity <= 0) {
          req.session.cart.items.splice(itemIndex, 1);
        } else {
          req.session.cart.items[itemIndex].quantity = quantity;
        }

        // Recalculate totals
        const subtotal = req.session.cart.items.reduce(
          (sum: number, item: any) => sum + item.price * item.quantity,
          0,
        );
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        req.session.cart.summary = { subtotal, discount: 0, tax, total };
      }

      res.json({ message: "Cart updated", cart: req.session.cart });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/cart/remove", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { itemId } = req.body;

      if (!req.session.cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      req.session.cart.items = req.session.cart.items.filter(
        (item: any) => item._id !== itemId,
      );

      // Recalculate totals
      const subtotal = req.session.cart.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );
      const tax = subtotal * 0.18;
      const total = subtotal + tax;

      req.session.cart.summary = { subtotal, discount: 0, tax, total };

      res.json({ message: "Item removed from cart", cart: req.session.cart });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cart/promo", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;

      if (!req.session.cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      // Calculate current subtotal
      const subtotal = req.session.cart.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );

      // Validate promo code using the new system
      const validation = await storage.validatePromoCode(code, req.user!.id, subtotal);

      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      // Apply discount
      const discountAmount = validation.discount;
      const tax = (subtotal - discountAmount) * 0.18;
      const total = subtotal - discountAmount + tax;

      req.session.cart.summary = {
        subtotal,
        discount: discountAmount,
        tax,
        total,
      };

      // Store applied promo code in session
      req.session.cart.appliedPromoCode = code;

      res.json({
        message: validation.message,
        cart: req.session.cart,
        discount: discountAmount
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove promo code from cart
  app.delete("/api/cart/promo", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.session.cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      // Recalculate totals without discount
      const subtotal = req.session.cart.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );
      const tax = subtotal * 0.18;
      const total = subtotal + tax;

      req.session.cart.summary = { subtotal, discount: 0, tax, total };
      delete req.session.cart.appliedPromoCode;

      res.json({ message: "Promo code removed", cart: req.session.cart });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart/clear", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.session.cart) {
        req.session.cart = {
          items: [],
          summary: { subtotal: 0, discount: 0, tax: 0, total: 0 },
        };
      }

      res.json({ message: "Cart cleared", cart: req.session.cart });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Order routes
  app.post("/api/orders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Validate that cart exists and has items
      if (!req.session.cart || !req.session.cart.items || req.session.cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Validate shipping address for physical items
      const hasPhysicalItems = req.session.cart.items.some((item: any) => item.type === "merch");
      if (hasPhysicalItems && !req.body.shippingAddress) {
        return res.status(400).json({ message: "Shipping address is required for merchandise orders" });
      }

      // Determine order type based on cart items
      let orderType = "MERCH";
      if (req.session.cart && req.session.cart.items.length > 0) {
        const hasTickets = req.session.cart.items.some(
          (item: any) => item.type === "event",
        );
        const hasMerch = req.session.cart.items.some(
          (item: any) => item.type === "merch",
        );

        if (hasTickets && hasMerch) {
          orderType = "MIXED";
        } else if (hasTickets) {
          orderType = "TICKET";
        } else {
          orderType = "MERCH";
        }
      }

      // Validate item availability and prices
      const validatedItems = await Promise.all(
        req.session.cart.items.map(async (item: any) => {
          let itemData;
          let currentPrice;

          if (item.type === "merch") {
            itemData = await storage.getMerch(item.id);
            if (!itemData) {
              throw new Error(`Merchandise item ${item.id} not found`);
            }
            if (itemData.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${itemData.name}. Available: ${itemData.stock}, Requested: ${item.quantity}`);
            }
            currentPrice = itemData.price;
          } else if (item.type === "event") {
            itemData = await storage.getEvent(item.id);
            if (!itemData) {
              throw new Error(`Event ${item.id} not found`);
            }
            if (new Date(itemData.date) < new Date()) {
              throw new Error(`Event ${itemData.title} has already passed`);
            }
            
            // Check ticket availability
            const ticketStats = await storage.getEventTicketStats(item.id);
            if (ticketStats.soldTickets + item.quantity > ticketStats.totalTickets) {
              throw new Error(`Not enough tickets available for ${itemData.title}. Available: ${ticketStats.availableTickets}, Requested: ${item.quantity}`);
            }
            
            currentPrice = itemData.ticketPrice;
          }

          // Verify price hasn't changed
          if (currentPrice === undefined || Math.abs(currentPrice - item.price) > 0.01) {
            throw new Error(`Price for ${item.name} has changed. Please refresh your cart.`);
          }

          return {
            merchId: item.type === "merch" ? item.id : undefined,
            eventId: item.type === "event" ? item.id : undefined,
            qty: item.quantity,
            unitPrice: currentPrice,
            size: item.size || undefined,
            color: item.color || undefined,
            name: item.name || undefined,
            image: item.image || undefined
          };
        })
      );

      const orderData = insertOrderSchema.parse({
        ...req.body,
        userId: req.user!.id,
        type: req.body.type || orderType,
        status: "PENDING",
        currency: "INR",
        items: validatedItems,
        totalAmount: req.session.cart?.summary?.total || 0,
  // Don't send explicit null for optional fields - leave undefined when not present
  appliedPromoCode: req.session.cart?.appliedPromoCode,
        discount: req.session.cart?.summary?.discount || 0,
      });

      // Validate total amount matches cart
      if (Math.abs(orderData.totalAmount - req.session.cart.summary.total) > 0.01) {
        return res.status(400).json({ message: "Order total doesn't match cart total" });
      }

      const order = await storage.createOrder(orderData);

      // Log ecommerce analytics (order placed)
      try {
        await AnalyticsService.trackOrder({
          userId: req.user!.id,
          orderId: order._id,
          type: order.type === "TICKET" ? "event_ticket" : "merch",
          items: order.items.map((i: any) => ({
            itemId: i.merchId || i.eventId,
            itemType: i.merchId ? "merch" : "event",
            quantity: i.qty,
            price: i.unitPrice,
            discount: 0
          })),
          totalAmount: order.totalAmount,
          currency: order.currency || "INR",
          status: "placed",
          paymentStatus: "pending",
          shippingAddress: order.shippingAddress,
          metadata: { source: "web", appliedPromo: req.session.cart?.appliedPromoCode }
        });
      } catch (e) {
        
      }

      // Create Razorpay order
      const razorpayOrder = await createOrder(
        order.totalAmount,
        order.currency,
        order._id,
      );

      await storage.updateOrder(order._id, {
        razorpayOrderId: razorpayOrder.id,
      });

      res.json({
        order,
        razorpayOrder,
      });
    } catch (error) {
      
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/payments/verify", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, paymentId, signature, orderDbId } = req.body;

      const isValid = verifyPayment(orderId, paymentId, signature);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      // Update order status
      const order = await storage.updateOrder(orderDbId, {
        status: "PAID",
        razorpayPaymentId: paymentId,
      });

      if (order) {
        // Create payment confirmed tracking entry
        try {
          await storage.createOrderTracking({
            orderId: order._id,
            status: "PAYMENT_CONFIRMED",
            description: "Payment confirmed successfully. Order will be processed shortly.",
            updatedBy: "system"
          });
        } catch (trackingError) {
          console.error('Failed to create payment tracking:', trackingError);
        }

        // Increment promo code usage if one was applied
        if (order.appliedPromoCode) {
          try {
            const promoCode = await storage.getPromoCodeByCode(order.appliedPromoCode.toUpperCase());
            if (promoCode) {
              await storage.updatePromoCode(promoCode._id.toString(), {
                usageCount: (promoCode.usageCount || 0) + 1
              });
            }
          } catch (e) {
            
          }
        }

        // Log purchase success and update ecommerce analytics
        try {
          await AnalyticsService.trackPurchase(req.user!.id, order._id, order.totalAmount, order.type || "MERCH", "checkout");
          await AnalyticsService.trackOrder({
            userId: order.userId,
            orderId: order._id,
            type: order.type === "TICKET" || order.type === "MIXED" ? "event_ticket" : "merch",
            items: order.items.map((i: any) => ({
              itemId: i.merchId || i.eventId,
              itemType: i.merchId ? "merch" : "event",
              quantity: i.qty,
              price: i.unitPrice,
              discount: 0
            })),
            totalAmount: order.totalAmount,
            currency: order.currency || "INR",
            status: "confirmed",
            paymentStatus: "completed",
            shippingAddress: order.shippingAddress,
            metadata: { razorpayPaymentId: paymentId }
          });
        } catch (e) {
          
        }
        
        // Update inventory for merch items and track artist revenue (using pre-tax amounts)
        for (const item of order.items) {
          if (item.merchId) {
            try {
              const merch = await storage.getMerch(item.merchId);
              if (merch && merch.stock >= item.qty) {
                await storage.updateMerch(item.merchId, {
                  stock: merch.stock - item.qty,
                  orders: [...(merch.orders || []), order._id]
                });

                // Update artist revenue for merchandise sales (using pre-tax amounts)
                const itemValue = item.unitPrice * item.qty; // Use pre-tax amount for artist revenue calculations
                
                // Get merch cost settings using new unified structure (same as webhook)
                const costSettings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
                const defaultUnifiedCosts = {
                  baseCost: 100,
                  manufacturingCost: 50,
                  shippingCost: 30,
                  packagingCost: 20
                };
                const unifiedCosts = costSettings?.costs || defaultUnifiedCosts;

                // Calculate merchandise revenue using pre-tax amounts
                const merchPlatformCosts = (unifiedCosts.baseCost || 0) + (unifiedCosts.manufacturingCost || 0) + 
                                          (unifiedCosts.shippingCost || 0) + (unifiedCosts.packagingCost || 0);
                const platformFee = itemValue * 0.10; // 10% platform fee on pre-tax amount
                const artistNet = itemValue - merchPlatformCosts - platformFee; // Artist gets remainder from pre-tax amount

                // Update artist revenue
                if (artistNet > 0) {
                  await storage.db.collection("users").updateOne(
                    { _id: new ObjectId(merch.artistId), role: "artist" },
                    { 
                      $inc: { 
                        "artist.revenue.merch": artistNet,
                        "artist.availableBalance": artistNet
                      }
                    }
                  );
                  
                  // Track revenue analytics
                  try {
                    await AnalyticsService.trackEvent(
                      merch.artistId,
                      'revenue_earned',
                      'commerce',
                      {
                        source: 'merch_sale',
                        orderId: order._id,
                        itemId: item.merchId,
                        grossSales: itemValue, // Pre-tax amount
                        costs: merchPlatformCosts,
                        platformFee: platformFee,
                        netRevenue: artistNet,
                        itemName: merch.name
                      },
                      merch.artistId,
                      undefined,
                      artistNet
                    );
                  } catch (analyticsError) {
                    
                  }
                }
              }
            } catch (stockError) {
              
            }
          }

          // Update artist revenue for event tickets (using pre-tax amounts)
          if (item.eventId) {
            try {
              const event = await storage.getEvent(item.eventId);
              if (event) {
                const itemValue = item.unitPrice * item.qty; // Use pre-tax amount for artist revenue
                const artistNet = itemValue * 0.90; // Artist gets 90% of pre-tax amount, platform keeps 10%

                await storage.db.collection("users").updateOne(
                  { _id: new ObjectId(event.artistId), role: "artist" },
                  { 
                    $inc: { 
                      "artist.revenue.events": artistNet,
                      "artist.availableBalance": artistNet
                    }
                  }
                );
                
                // Track event revenue analytics
                try {
                  await AnalyticsService.trackEvent(
                    event.artistId,
                    'revenue_earned',
                    'commerce',
                    {
                      source: 'event_ticket',
                      orderId: order._id,
                      itemId: item.eventId,
                      grossSales: itemValue, // Pre-tax amount
                      platformFee: itemValue * 0.10,
                      netRevenue: artistNet,
                      eventTitle: event.title
                    },
                    event.artistId,
                    undefined,
                    artistNet
                  );
                } catch (analyticsError) {
                  
                }
              }
            } catch (eventError) {
              
            }
          }
        }

        // Clear cart after successful payment
        if (req.session.cart) {
          req.session.cart = {
            items: [],
            summary: { subtotal: 0, discount: 0, tax: 0, total: 0 },
          };
        }

        // Send confirmation email (non-blocking)
        sendOrderConfirmation(req.user!.email, order).catch((error) => {
          
        });

        // Generate proper tickets with QR codes for events
        if (order.type === "TICKET" || order.type === "MIXED") {
          try {
            // Get event items from the order
            const eventItems = order.items.filter((item: any) => item.eventId);
            
            const tickets = [];
            let ticketIndex = 1;
            let firstEvent = null; // Cache first event for email

            for (const item of eventItems) {
              const event = await storage.getEvent(item.eventId);
              if (!event) {
                
                continue;
              }

              // Cache first event for email usage
              if (!firstEvent) {
                firstEvent = event;
              }

              // Check ticket availability
              const ticketStats = await storage.getEventTicketStats(item.eventId);
              if (ticketStats.soldTickets + item.qty > ticketStats.totalTickets) {
                throw new Error(`Not enough tickets available for ${event.title}. Available: ${ticketStats.availableTickets}, Requested: ${item.qty}`);
              }

              // Create individual tickets for the quantity ordered
              for (let i = 0; i < item.qty; i++) {
                const ticketNumber = generateTicketNumber(item.eventId, ticketStats.soldTickets + ticketIndex);
                
                // Create ticket in database first
                const ticket = await storage.createTicket({
                  orderId: order._id,
                  eventId: item.eventId,
                  userId: order.userId,
                  ticketNumber,
                  qrCode: '', // Will be generated and updated
                  qrSignature: '',
                  status: 'VALID'
                });

                // Generate QR code with actual ticket ID
                const qrCode = await generateTicketQR({
                  ticketId: ticket._id,
                  eventId: item.eventId,
                  userId: order.userId,
                  ticketNumber,
                  eventTitle: event.title,
                  eventDate: event.date.toISOString(),
                  venue: event.location
                });

                // Update ticket with QR code
                await storage.updateTicket(ticket._id, { qrCode });
                ticket.qrCode = qrCode; // Update local object for email
                
                tickets.push(ticket);
                ticketIndex++;
              }

              // Update event ticket count
              await storage.updateEvent(item.eventId, {
                ticketsSold: ticketStats.soldTickets + item.qty
              });
            }

            // Store ticket information in order for easy access
            await storage.updateOrder(order._id, { 
              qrTicketUrl: tickets.length > 0 ? tickets[0].qrCode : undefined,
              ticketIds: tickets.map(t => t._id)
            });

            // Send ticket email with all tickets (non-blocking)
            if (tickets.length > 0 && firstEvent) {
              sendTicketEmail(
                req.user!.email,
                {
                  eventTitle: firstEvent.title || "Event",
                  date: firstEvent.date || new Date(),
                  location: firstEvent.location || "Venue",
                  ticketId: order._id,
                  tickets: tickets.map(t => ({
                    ticketNumber: t.ticketNumber,
                    qrCode: t.qrCode
                  }))
                },
                tickets[0].qrCode,
              ).catch((error) => {
                
              });
            }

          } catch (ticketError) {
            
            // Don't fail the payment, but log the error
          }
        }

        // Create shipment for merch orders (non-blocking)
        if ((order.type === "MERCH" || order.type === "MIXED") && order.shippingAddress) {
          try {
            const shipmentItems = await Promise.all(
              order.items
                .filter((item: any) => item.merchId) // Only process merch items
                .map(async (item: any) => {
                  try {
                    // Fetch merch details for better weight estimation
                    const merch = await storage.getMerch(item.merchId);
                    const itemName = merch?.name || `Merch Item ${item.merchId}`;
                    
                    // Estimate weight based on item category or name
                    let estimatedWeight = 0.5; // Default 500g
                    if (merch?.category) {
                      const category = merch.category.toLowerCase();
                      if (category.includes('t-shirt') || category.includes('tshirt') || category.includes('shirt')) {
                        estimatedWeight = 0.3; // 300g
                      } else if (category.includes('hoodie') || category.includes('sweatshirt')) {
                        estimatedWeight = 0.8; // 800g
                      } else if (category.includes('cap') || category.includes('hat')) {
                        estimatedWeight = 0.2; // 200g
                      } else if (category.includes('poster') || category.includes('print')) {
                        estimatedWeight = 0.1; // 100g
                      } else if (category.includes('bag') || category.includes('backpack')) {
                        estimatedWeight = 0.6; // 600g
                      } else if (category.includes('sticker')) {
                        estimatedWeight = 0.05; // 50g
                      }
                    }

                    return {
                      name: itemName,
                      sku: item.merchId,
                      units: item.qty,
                      sellingPrice: item.unitPrice,
                      weight: estimatedWeight
                    };
                  } catch (merchError) {
                    
                    return {
                      name: `Merch Item ${item.merchId}`,
                      sku: item.merchId,
                      units: item.qty,
                      sellingPrice: item.unitPrice,
                      weight: 0.5 // Fallback weight
                    };
                  }
                })
            );

            if (shipmentItems.length > 0) {
              const shipmentData = {
                orderId: order._id,
                userId: order.userId,
                pickupPostcode: process.env.SHIPROCKET_PICKUP_PINCODE || "400001",
                deliveryPostcode: order.shippingAddress.pincode,
                items: shipmentItems,
                customer: {
                  name: order.shippingAddress.name,
                  email: req.user!.email,
                  phone: order.shippingAddress.phone,
                  address: order.shippingAddress.address,
                  city: order.shippingAddress.city,
                  state: order.shippingAddress.state
                }
              };

              const shipment = await ShiprocketService.createShipment(shipmentData);
              
              // Update order with shipment details - keep existing status
              await storage.updateOrder(order._id, {
                shipmentId: shipment.shipmentId,
                trackingNumber: shipment.awb,
                courierName: shipment.courierName,
                pickupId: shipment.pickupId,
                shipmentStatus: "CREATED",
                trackingDetails: {
                  shipmentId: shipment.shipmentId,
                  awb: shipment.awb,
                  courierName: shipment.courierName,
                  trackingUrl: shipment.trackingUrl,
                  lastUpdated: new Date()
                }
              });

              // Create initial tracking update
              await storage.createOrderTracking({
                orderId: order._id,
                status: "SHIPMENT_CREATED", 
                description: "Shipment created and ready for pickup",
                updatedBy: "system"
              });

            }
          } catch (shipmentError) {
            
            
            // Create manual tracking entry for admin attention - keep as PAID until manually processed
            try {
              await storage.createOrderTracking({
                orderId: order._id,
                status: "PAID",
                description: `Order paid successfully. Automatic shipment creation failed: ${shipmentError instanceof Error ? shipmentError.message : 'Unknown error'}. Awaiting manual processing by admin.`,
                updatedBy: "system"
              });
            } catch (trackingError) {
              
            }
            // Don't fail the payment verification, just log the error
          }
        }
      }

      res.json({ message: "Payment verified successfully", order });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.user!.id);
      res.json(orders);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order
      if (order.userId.toString() !== req.user!.id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(order);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Subscription routes
  app.get("/api/subscriptions/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const subscriptions = await storage.getSubscriptionsByUser(
        req.user!.id,
      );

      // Enhance subscriptions with artist information
      const enhancedSubscriptions = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            const artist = await storage.getUser(subscription.artistId);
            return {
              ...subscription,
              artistName: artist?.name || "Unknown Artist",
              artistEmail: artist?.email,
              artistProfile: artist?.artist || null
            };
          } catch (error) {
            
            return {
              ...subscription,
              artistName: "Unknown Artist",
              artistEmail: null,
              artistProfile: null
            };
          }
        })
      );

      res.json(enhancedSubscriptions);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create subscription order (for payment processing)
  app.post("/api/subscriptions/create-order", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { artistId, tier, amount } = req.body;

      if (!artistId || !tier || !amount) {
        return res.status(400).json({ message: "Missing required fields: artistId, tier, amount" });
      }

      // Validate artist exists
      const artist = await storage.db.collection("users").findOne({
        _id: new ObjectId(artistId),
        role: "artist"
      });

      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      // Check if user already has active subscription to this artist
      const existingSubscription = await storage.db.collection("subscriptions").findOne({
        fanId: new ObjectId(req.user!.id),
        artistId: new ObjectId(artistId),
        active: true,
        endDate: { $gt: new Date() }
      });

      if (existingSubscription) {
        return res.status(400).json({ message: "You already have an active subscription to this artist" });
      }

      // Create Razorpay order for subscription
      const receipt = `sub_${Date.now().toString().slice(-8)}`;
      const razorpayOrder = await createOrder(amount, "INR", receipt);

      // Create pending subscription record instead of separate subscription_orders collection
      const subscriptionData = {
        _id: new ObjectId(),
        fanId: new ObjectId(req.user!.id),
        artistId: new ObjectId(artistId),
        tier,
        amount,
        currency: "INR",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        active: false, // Will be activated after payment
        status: "PENDING_PAYMENT",
        razorpayOrderId: razorpayOrder.id,
        createdAt: new Date()
      };

      await storage.db.collection("subscriptions").insertOne(subscriptionData);

      res.json({
        subscription: subscriptionData,
        razorpayOrder,
        key: process.env.RAZORPAY_KEY_ID
      });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to create subscription order" });
    }
  });

  // Verify subscription payment
  app.post("/api/subscriptions/verify-payment", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, paymentId, signature, subscriptionId } = req.body;

      if (!orderId || !paymentId || !signature || !subscriptionId) {
        return res.status(400).json({ message: "Missing payment verification parameters" });
      }

      // Verify payment signature
      const isValid = verifyPayment(orderId, paymentId, signature);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      // Get the pending subscription
      const subscription = await storage.db.collection("subscriptions").findOne({
        _id: new ObjectId(subscriptionId),
        fanId: new ObjectId(req.user!.id),
        status: "PENDING_PAYMENT"
      });

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found or already processed" });
      }

      // Activate the subscription and update artist revenue atomically
      const session = (storage as any).client?.startSession();
      try {
        await session?.withTransaction(async () => {
          // Update subscription status
          await storage.db.collection("subscriptions").updateOne(
            { _id: subscription._id },
            {
              $set: {
                active: true,
                status: "ACTIVE",
                razorpayPaymentId: paymentId,
                activatedAt: new Date(),
                updatedAt: new Date()
              }
            },
            { session }
          );

          // Update artist revenue and subscriber count
          await storage.db.collection("users").updateOne(
            { _id: subscription.artistId, role: "artist" },
            {
              $inc: {
                "artist.revenue.subscriptions": subscription.amount,
                "artist.availableBalance": subscription.amount // Artist gets 100% of fan subscription
              },
              $addToSet: {
                "artist.subscribers": subscription.fanId
              }
            },
            { session }
          );

        });
      } finally {
        await session?.endSession();
      }

      // Create a comprehensive order record for the subscription
      try {
        const artist = await storage.getUser(subscription.artistId);
        const orderData = {
          userId: req.user!.id,
          type: "SUBSCRIPTION",  // Using consistent type naming
          status: "PAID",
          items: [{
            type: "subscription",
            name: `${artist?.name || 'Artist'} - ${subscription.tier} Subscription`,
            amount: subscription.amount,
            quantity: 1,
            artistId: subscription.artistId.toString(),
            subscriptionId: subscription._id.toString(),
            tier: subscription.tier
          }],
          totalAmount: subscription.amount,
          currency: subscription.currency || "INR",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          subscriptionId: subscription._id.toString(),
          createdAt: new Date()
        };

        await storage.createOrder(orderData);
      } catch (orderError) {
        
        // Don't fail the subscription if order creation fails, but log the error
        
      }

      // Track subscription analytics
      try {
        await AnalyticsService.trackSubscription({
          userId: req.user!.id,
          subscriptionId: subscription._id,
          artistId: subscription.artistId.toString(),
          tier: subscription.tier,
          action: "subscription_created",
          amount: subscription.amount,
          currency: subscription.currency,
          period: { start: subscription.startDate, end: subscription.endDate },
          paymentMethod: "razorpay",
          metadata: { source: "web", paymentId, orderId }
        });
      } catch (e) {
        
      }

      // Get updated subscription for response
      const updatedSubscription = await storage.db.collection("subscriptions").findOne({
        _id: subscription._id
      });

      res.json({
        success: true,
        subscription: updatedSubscription,
        message: "Subscription activated successfully"
      });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to verify subscription payment" });
    }
  });
  // Legacy subscription route - keeping for backward compatibility but routing to unified flow
  app.post("/api/commerce/subscribe", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { artistId, plan, amount } = req.body;

      // Validate artist exists
      const artist = await storage.db.collection("users").findOne({
        _id: new ObjectId(artistId),
        role: "artist"
      });

      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }

      // Check if user already has active subscription to this artist
      const existingSubscription = await storage.db.collection("subscriptions").findOne({
        fanId: new ObjectId(req.user!.id),
        artistId: new ObjectId(artistId),
        active: true,
        endDate: { $gt: new Date() }
      });

      if (existingSubscription) {
        return res.status(400).json({ message: "You already have an active subscription to this artist" });
      }

      // Create active subscription directly (for backward compatibility)
      const subscription = await storage.createSubscription({
        fanId: req.user!.id,
        artistId,
        tier: plan || "SUPPORTER",
        amount,
        currency: "INR",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        active: true,
        status: "ACTIVE"
      });

      // Update artist revenue atomically
      try {
        await storage.db.collection("users").updateOne(
          { _id: new ObjectId(artistId), role: "artist" },
          { 
            $inc: { 
              "artist.revenue.subscriptions": amount,
              "artist.availableBalance": amount // Artist gets 100% of fan subscription
            },
            $addToSet: {
              "artist.subscribers": new ObjectId(req.user!.id)
            }
          }
        );
      } catch (revenueError) {
        
      }

      // Track subscription analytics
      try {
        await AnalyticsService.trackSubscription({
          userId: req.user!.id,
          subscriptionId: subscription._id,
          artistId,
          tier: plan || "supporter",
          action: "subscription_created",
          amount,
          currency: "INR",
          period: { start: subscription.startDate, end: subscription.endDate },
          paymentMethod: "direct",
          metadata: { source: "legacy_api" }
        });
      } catch (e) {
        
      }
      res.json(subscription);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Subscription Management routes
  app.post("/api/subscriptions/:subscriptionId/cancel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { subscriptionId } = req.params;

      // Verify subscription exists and belongs to user
      const subscription = await storage.db.collection("subscriptions").findOne({
        _id: new ObjectId(subscriptionId),
        fanId: new ObjectId(req.user!.id)
      });

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      // Update subscription to inactive
      await storage.db.collection("subscriptions").updateOne(
        { _id: new ObjectId(subscriptionId) },
        {
          $set: {
            active: false,
            status: "CANCELLED",
            cancelledAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      res.json({ message: "Subscription cancelled successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  app.post("/api/subscriptions/:subscriptionId/pause", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { subscriptionId } = req.params;

      // Verify subscription exists and belongs to user
      const subscription = await storage.db.collection("subscriptions").findOne({
        _id: new ObjectId(subscriptionId),
        fanId: new ObjectId(req.user!.id)
      });

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      // Update subscription to paused
      await storage.db.collection("subscriptions").updateOne(
        { _id: new ObjectId(subscriptionId) },
        {
          $set: {
            status: "PAUSED",
            pausedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      res.json({ message: "Subscription paused successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Failed to pause subscription" });
    }
  });

  app.get("/api/subscriptions/:subscriptionId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { subscriptionId } = req.params;

      // Verify subscription exists and belongs to user
      const subscription = await storage.db.collection("subscriptions").findOne({
        _id: new ObjectId(subscriptionId),
        fanId: new ObjectId(req.user!.id)
      });

      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      // Get artist information
      const artist = await storage.getUser(subscription.artistId);

      const enhancedSubscription = {
        ...subscription,
        artistName: artist?.name || "Unknown Artist",
        artistEmail: artist?.email,
        artistProfile: artist?.artist || null
      };

      res.json(enhancedSubscription);
    } catch (error) {
      
      res.status(500).json({ message: "Failed to get subscription" });
    }
  });

  // Order Tracking routes
  app.get("/api/orders/:orderId/tracking", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;

      // Verify order ownership
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId.toString() !== req.user!.id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tracking = await storage.getOrderTracking(orderId);
      res.json(tracking);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin route to create order tracking update
  app.post("/api/orders/:orderId/tracking", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;
      const { status, description, location, trackingNumber, carrier, estimatedDelivery } = req.body;

      // Verify order exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // TODO: Add admin role check here
      // For now, allowing any authenticated user (should be admin only)

      const tracking = await storage.createOrderTracking({
        orderId,
        status,
        description,
        location,
        trackingNumber,
        carrier,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
        updatedBy: req.user!.id
      });

      // Update order status if tracking status indicates completion
      if (status === "DELIVERED") {
        await storage.updateOrder(orderId, { status: "DELIVERED" });
      } else if (status === "SHIPPED") {
        await storage.updateOrder(orderId, { status: "SHIPPED" });
      }

      res.json(tracking);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Return Request routes
  app.get("/api/returns/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const returns = await storage.getReturnRequestsByUser(req.user!.id);
      res.json(returns);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/returns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId, items, reason, refundMethod } = req.body;

      // Verify order ownership
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (String(order.userId) !== String(req.user!.id)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Transform items to match schema structure
      const transformedItems = items.map((item: any) => ({
        merchId: item.merchId || undefined,
        eventId: item.eventId || undefined,
        quantity: item.quantity,
        reason: item.reason || "Return requested",
        condition: item.condition || "NEW",
        size: item.size || undefined,
        color: item.color || undefined
      }));

      // Calculate refund amount - use the total amount paid (including GST)
      // For partial returns, we need to calculate proportionally
      let refundAmount = order.totalAmount; // Default to full refund

      // If only some items are being returned, calculate partial refund
      if (items.length < order.items.length) {
        // Calculate the proportion of items being returned
        const totalOrderItems = order.items.reduce((sum: number, item: any) => sum + item.qty, 0);
        const returnItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const refundProportion = returnItems / totalOrderItems;

        refundAmount = Math.round(order.totalAmount * refundProportion);
      }

      const returnRequest = await storage.createReturnRequest({
        orderId,
        userId: req.user!.id,
        items: transformedItems,
        status: "REQUESTED",
        refundAmount,
        refundMethod: refundMethod || "ORIGINAL_PAYMENT",
        reason,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.json(returnRequest);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Promo Code management routes (admin) - moved to admin.ts

  app.delete("/api/admin/promo-codes/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // TODO: Add admin role check
      const { id } = req.params;
      const deleted = await storage.deletePromoCode(id);
      if (!deleted) {
        return res.status(404).json({ message: "Promo code not found" });
      }
      res.json({ message: "Promo code deleted" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Analytics route
  app.post("/api/analytics", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const analyticsData = {
        ...req.body,
        userId: req.user!.id,
      };

      await storage.logAnalytics(analyticsData);
      res.json({ message: "Analytics logged" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Analytics track route (used by player)
  app.post("/api/analytics/track", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const analyticsData = {
        ...req.body,
        userId: req.user!.id,
        timestamp: new Date().toISOString(),
      };

      await storage.logAnalytics(analyticsData);
      res.json({ message: "Analytics tracked" });
    } catch (error) {
      
      // Don't return error for analytics - it shouldn't break the app
      res.json({ message: "Analytics tracking failed but ignored" });
    }
  });

  // Get artist earnings breakdown (creator dashboard)
  app.get("/api/artists/earnings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user || req.user.role !== "artist") {
        return res.status(403).json({ message: "Artist access required" });
      }

      const artistId = req.user.id;

      // Get subscription earnings (90% of subscriptions)
      const subscriptions = await storage.db.collection("subscriptions").find({
        artistId: new ObjectId(artistId),
        active: true
      }).toArray();

      const subscriptionEarnings = subscriptions.reduce((sum, sub) => {
        return sum + (sub.amount * 0.90); // Artist gets 90%
      }, 0);

      // Get merchandise earnings
      const merchOrders = await storage.db.collection("orders").find({
        status: { $in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        items: { $elemMatch: { merchId: { $exists: true } } }
      }).toArray();

      let merchEarnings = 0;
      let totalMerchRevenue = 0;
      let totalMerchCosts = 0;

      // Get merch cost settings
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

      for (const order of merchOrders) {
        for (const item of order.items) {
          if (item.merchId) {
            try {
              const merch = await storage.getMerch(item.merchId);
              if (merch && merch.artistId.toString() === artistId) {
                const grossSales = item.unitPrice * item.qty;
                totalMerchRevenue += grossSales;

                // Determine cost structure based on category
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
                const platformFee = grossSales * 0.10; // 10% platform commission
                const artistNet = grossSales - totalCost - platformFee;

                totalMerchCosts += totalCost;
                merchEarnings += Math.max(0, artistNet);
              }
            } catch (error) {
              
            }
          }
        }
      }

      // Get event earnings (90% of ticket sales)
      const eventOrders = await storage.db.collection("orders").find({
        status: { $in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        items: { $elemMatch: { eventId: { $exists: true } } }
      }).toArray();

      let eventEarnings = 0;
      for (const order of eventOrders) {
        for (const item of order.items) {
          if (item.eventId) {
            try {
              const event = await storage.getEvent(item.eventId);
              if (event && event.artistId.toString() === artistId) {
                const grossSales = item.unitPrice * item.qty;
                const artistNet = grossSales * 0.90; // Artist gets 90%
                eventEarnings += artistNet;
              }
            } catch (error) {
              
            }
          }
        }
      }

      // Get pending payouts
      const pendingPayouts = await storage.db.collection("payouts").find({
        artistId: new ObjectId(artistId),
        status: "PENDING"
      }).toArray();

      const pendingAmount = pendingPayouts.reduce((sum, payout) => sum + (payout.payoutAmount || 0), 0);

      const totalEarnings = subscriptionEarnings + merchEarnings + eventEarnings;

      res.json({
        totalEarnings,
        pendingPayouts: pendingAmount,
        lastPayoutDate: null, // Could be enhanced to get actual last payout date
        nextPayoutDate: null, // Could be enhanced based on payout schedule
        breakdown: {
          subscriptions: subscriptionEarnings,
          merchandise: merchEarnings,
          events: eventEarnings,
          adRevenue: 0, // Could be enhanced if ad revenue exists
          streamingEarnings: 0 // Could be enhanced if streaming royalties exist
        },
        merchDetails: {
          totalRevenue: totalMerchRevenue,
          totalCosts: totalMerchCosts,
          platformCommission: totalMerchRevenue * 0.10,
          netEarnings: merchEarnings
        },
        platformFee: 10
      });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Analytics sessions routes
  app.post("/api/analytics/sessions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Create analytics session - for now just return a mock session ID
      const sessionId = `session_${req.user!.id}_${Date.now()}`;
      
      const sessionData = {
        userId: req.user!.id,
        sessionId,
        action: 'session_start',
        context: 'auth_system',
        metadata: {
          ...req.body,
          timestamp: new Date().toISOString()
        }
      };

      await storage.logAnalytics(sessionData);
      res.json({ sessionId });
    } catch (error) {
      
      // Return a mock session ID even if analytics fails
      res.json({ sessionId: `mock_session_${Date.now()}` });
    }
  });

  app.put("/api/analytics/sessions/:sessionId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      
      const sessionData = {
        userId: req.user!.id,
        sessionId,
        action: 'session_update',
        context: 'analytics_system',
        metadata: {
          ...req.body,
          timestamp: new Date().toISOString()
        }
      };

      await storage.logAnalytics(sessionData);
      res.json({ message: "Session updated" });
    } catch (error) {
      
      res.json({ message: "Session update failed but ignored" });
    }
  });

  app.delete("/api/analytics/sessions/:sessionId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params;
      
      const sessionData = {
        userId: req.user!.id,
        sessionId,
        action: 'session_end',
        context: 'auth_system',
        metadata: {
          timestamp: new Date().toISOString()
        }
      };

      await storage.logAnalytics(sessionData);
      res.json({ message: "Session ended" });
    } catch (error) {
      
      res.json({ message: "Session end failed but ignored" });
    }
  });

  // Shiprocket Integration Routes
  app.get("/api/orders/:orderId/shipment", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;

      // Verify order ownership
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!order.shipmentId) {
        return res.status(404).json({ message: "No shipment found for this order" });
      }

      // Get tracking information from Shiprocket
      const tracking = await ShiprocketService.getTracking(order.shipmentId);
      res.json(tracking);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders/:orderId/shipping-label", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;

      // Verify order ownership and admin role
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // TODO: Add admin role check
      if (order.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!order.shipmentId) {
        return res.status(404).json({ message: "No shipment found for this order" });
      }

      const label = await ShiprocketService.generateShippingLabel(order.shipmentId);
      
      // Update order with label URL
      await storage.updateOrder(orderId, {
        labelUrl: label.labelUrl
      });

      res.json(label);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get tracking by AWB (enhanced tracking)
  app.get("/api/track/:awb", async (req, res) => {
    try {
      const { awb } = req.params;

      if (!awb) {
        return res.status(400).json({ message: "AWB number is required" });
      }

      const tracking = await ShiprocketService.getTrackingByAWB(awb);
      res.json(tracking);
    } catch (error) {
      
      res.status(500).json({ message: "Unable to fetch tracking information" });
    }
  });

  // Re-trigger shipment creation (admin only)
  app.post("/api/orders/:orderId/retry-shipment", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;

      // TODO: Add admin role check
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Access denied - Admin only" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.shipmentId) {
        return res.status(400).json({ message: "Shipment already exists for this order" });
      }

      if (order.status !== "PAID" && order.status !== "PROCESSING") {
        return res.status(400).json({ message: "Order must be paid to create shipment" });
      }

      if (!order.shippingAddress) {
        return res.status(400).json({ message: "No shipping address found for this order" });
      }

      // Create shipment for merch orders
      if ((order.type === "MERCH" || order.type === "MIXED")) {
        const shipmentItems = await Promise.all(
          order.items
            .filter((item: any) => item.merchId) // Only process merch items
            .map(async (item: any) => {
              try {
                const merch = await storage.getMerch(item.merchId);
                const itemName = merch?.name || `Merch Item ${item.merchId}`;
                
                let estimatedWeight = 0.5; // Default 500g
                if (merch?.category) {
                  const category = merch.category.toLowerCase();
                  if (category.includes('t-shirt') || category.includes('tshirt') || category.includes('shirt')) {
                    estimatedWeight = 0.3; // 300g
                  } else if (category.includes('hoodie') || category.includes('sweatshirt')) {
                    estimatedWeight = 0.8; // 800g
                  } else if (category.includes('cap') || category.includes('hat')) {
                    estimatedWeight = 0.2; // 200g
                  } else if (category.includes('poster') || category.includes('print')) {
                    estimatedWeight = 0.1; // 100g
                  } else if (category.includes('bag') || category.includes('backpack')) {
                    estimatedWeight = 0.6; // 600g
                  }
                }

                return {
                  name: itemName,
                  sku: item.merchId,
                  units: item.qty,
                  sellingPrice: item.unitPrice,
                  weight: estimatedWeight
                };
              } catch (merchError) {
                
                return {
                  name: `Merch Item ${item.merchId}`,
                  sku: item.merchId,
                  units: item.qty,
                  sellingPrice: item.unitPrice,
                  weight: 0.5 // Fallback weight
                };
              }
            })
        );

        if (shipmentItems.length > 0) {
          const shipmentData = {
            orderId: order._id,
            userId: order.userId,
            pickupPostcode: process.env.SHIPROCKET_PICKUP_PINCODE || "400001",
            deliveryPostcode: order.shippingAddress.pincode,
            items: shipmentItems,
            customer: {
              name: order.shippingAddress.name,
              email: (await storage.getUser(order.userId))?.email || "customer@riseup.com",
              phone: order.shippingAddress.phone,
              address: order.shippingAddress.address,
              city: order.shippingAddress.city,
              state: order.shippingAddress.state
            }
          };

          const shipment = await ShiprocketService.createShipment(shipmentData);
          
          // Update order with shipment details
          await storage.updateOrder(order._id, {
            shipmentId: shipment.shipmentId,
            trackingNumber: shipment.awb,
            courierName: shipment.courierName,
            pickupId: shipment.pickupId,
            status: "PROCESSING",
            shipmentStatus: "CREATED",
            trackingDetails: {
              shipmentId: shipment.shipmentId,
              awb: shipment.awb,
              courierName: shipment.courierName,
              trackingUrl: shipment.trackingUrl,
              lastUpdated: new Date()
            }
          });

          // Create tracking update
          await storage.createOrderTracking({
            orderId: order._id,
            status: "PROCESSING",
            description: "Shipment created manually by admin",
            updatedBy: req.user!.id
          });

          return res.json({
            message: "Shipment created successfully",
            shipment: {
              shipmentId: shipment.shipmentId,
              awb: shipment.awb,
              courierName: shipment.courierName,
              trackingUrl: shipment.trackingUrl
            }
          });
        }
      }

      res.status(400).json({ message: "No merch items found in order" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/orders/:orderId/cancel-shipment", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      // Verify order ownership and admin role
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // TODO: Add admin role check
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!order.shipmentId) {
        return res.status(404).json({ message: "No shipment found for this order" });
      }

      const cancelled = await ShiprocketService.cancelShipment(order.shipmentId, reason || "Order cancelled");
      
      if (cancelled) {
        // Update order status
        await storage.updateOrder(orderId, {
          status: "CANCELLED"
        });

        // Create tracking update
        await storage.createOrderTracking({
          orderId,
          status: "CANCELLED",
          description: `Shipment cancelled: ${reason || "Order cancelled"}`,
          updatedBy: req.user!.id
        });
      }

      res.json({ success: cancelled, message: cancelled ? "Shipment cancelled successfully" : "Failed to cancel shipment" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/courier-options", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { pickupPincode, deliveryPincode } = req.query;

      if (!pickupPincode || !deliveryPincode) {
        return res.status(400).json({ message: "Both pickup and delivery pincode are required" });
      }

      const options = await ShiprocketService.getCourierOptions(
        pickupPincode as string,
        deliveryPincode as string
      );

      res.json(options);
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check pincode serviceability
  app.post("/api/check-serviceability", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { pincode, weight } = req.body;

      if (!pincode) {
        return res.status(400).json({ message: "Pincode is required" });
      }

      const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || "400001";
      const deliveryPincode = pincode as string;
      const orderWeight = weight ? parseFloat(weight as string) : 1;

      const serviceability = await ShiprocketService.checkServiceability(
        pickupPincode,
        deliveryPincode,
        orderWeight
      );

      // If Shiprocket serviceability fails, allow all Indian pincodes as fallback
      if (!serviceability.serviceable && deliveryPincode.length === 6 && /^\d+$/.test(deliveryPincode)) {
        return res.json({
          serviceable: true,
          couriers: [{ courier_name: "Standard Delivery", courier_id: 1 }],
          pincode: deliveryPincode,
          estimatedDeliveryDays: 7,
          estimatedDelivery: "5-7 business days",
          fallback: true,
          message: "Delivery available (estimated)"
        });
      }

      res.json({
        serviceable: serviceability.serviceable,
        couriers: serviceability.couriers,
        pincode: deliveryPincode,
        estimatedDeliveryDays: serviceability.serviceable ? 7 : null,
        estimatedDelivery: serviceability.serviceable ? "5-7 business days" : null
      });
    } catch (error) {
      
      
      // Fallback: allow all valid Indian pincodes
      const { pincode } = req.body;
      if (pincode && pincode.length === 6 && /^\d+$/.test(pincode)) {
        return res.json({ 
          serviceable: true, 
          couriers: [{ courier_name: "Standard Delivery", courier_id: 1 }], 
          pincode: pincode,
          estimatedDeliveryDays: 7,
          estimatedDelivery: "5-7 business days",
          fallback: true,
          message: "Delivery available (estimated)"
        });
      }
      
      res.status(500).json({ 
        serviceable: false, 
        couriers: [], 
        message: "Unable to check serviceability at this time" 
      });
    }
  });

  // Razorpay webhook endpoint for payment updates
  app.post("/api/payments/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const body = req.body.toString();

      // Verify webhook signature
      if (!verifyWebhookSignature(body, signature)) {
        
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = JSON.parse(body);

      // Process the webhook event
      const result = await processWebhookEvent(event);
      
      if (result.success) {
        res.json({ status: 'success', ...result });
      } else {
        
        res.status(400).json({ status: 'error', ...result });
      }
    } catch (error) {
      
      res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

