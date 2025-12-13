import { Router } from "express";
import { storage } from "../storage/index.js";
import { AnalyticsService } from "../services/analytics.js";

const router = Router();
const analyticsService = new AnalyticsService();

// Shiprocket webhook endpoint
router.post("/shiprocket", async (req, res) => {
  try {
    const { event, data } = req.body;
    
    

    if (!event || !data) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // Verify webhook authenticity (if Shiprocket provides signature verification)
    // This is a placeholder - implement actual verification if available
    
    // Find the order by AWB number
    const awbNumber = data.awb_number || data.tracking_id;
    if (!awbNumber) {
      
      return res.status(200).json({ message: "No AWB number provided" });
    }

    const order = await storage.findOrderByTrackingNumber(awbNumber);
    if (!order) {
      
      return res.status(200).json({ message: "Order not found" });
    }

    

    // Update order status based on event
    const updates: any = {
      updatedAt: new Date(),
    };

    // Map Shiprocket events to our order status
    switch (event) {
      case "order_confirmed":
      case "pickup_scheduled":
      case "pickup_generated":
        updates.status = "CONFIRMED";
        updates.shippingStatus = "PICKUP_SCHEDULED";
        break;
        
      case "shipped":
      case "in_transit":
      case "order_shipped":
        updates.status = "SHIPPED";
        updates.shippingStatus = "IN_TRANSIT";
        break;
        
      case "out_for_delivery":
        updates.shippingStatus = "OUT_FOR_DELIVERY";
        break;
        
      case "delivered":
      case "order_delivered":
        updates.status = "DELIVERED";
        updates.shippingStatus = "DELIVERED";
        updates.deliveredAt = new Date();
        break;
        
      case "cancelled":
      case "order_cancelled":
        updates.status = "CANCELLED";
        updates.shippingStatus = "CANCELLED";
        break;
        
      case "returned":
      case "rto":
        updates.status = "RETURNED";
        updates.shippingStatus = "RETURNED";
        break;
        
      case "exception":
      case "undelivered":
        updates.shippingStatus = "EXCEPTION";
        break;
        
      default:
        
        break;
    }

    // Add tracking history entry
    const trackingEntry = {
      timestamp: new Date(),
      status: event,
      location: data.location || data.current_location || "",
      description: data.description || data.status_description || `Shipment ${event}`,
      courierRemarks: data.courier_remarks || "",
    };

    updates.$push = {
      trackingHistory: trackingEntry,
    };

    // Update additional shipping info if available
    if (data.expected_delivery_date) {
      updates.expectedDeliveryDate = new Date(data.expected_delivery_date);
    }

    if (data.current_location) {
      updates.currentLocation = data.current_location;
    }

    // Update the order
    await storage.updateOrder(order._id, updates);

    // Track analytics for status updates
    try {
      await AnalyticsService.trackEvent(
        order.userId.toString(),
        "shipment_status_updated",
        "shiprocket_webhook",
        {
          orderId: order._id,
          trackingNumber: awbNumber,
          status: event,
          courierName: order.courierName,
          orderValue: order.totalAmount,
        }
      );
    } catch (analyticsError) {
      
    }

    
    res.status(200).json({ message: "Webhook processed successfully" });

  } catch (error) {
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// Health check endpoint for webhook
router.get("/shiprocket/health", (req, res) => {
  res.status(200).json({ 
    message: "Shiprocket webhook endpoint is healthy",
    timestamp: new Date().toISOString()
  });
});

export default router;

