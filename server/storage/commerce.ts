import { ObjectId } from "mongodb";
import { BaseStorage } from "./base";

export class CommerceStorage extends BaseStorage {
  
  // Order methods
  async getOrder(id: string): Promise<any> {
    try {
      const order = await this.db.collection("orders").findOne({ _id: new ObjectId(id) });
      return order;
    } catch (error) {
      
      return undefined;
    }
  }

  async getOrdersByUser(userId: string): Promise<any[]> {
    try {
      const orders = await this.db.collection("orders")
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();
      return orders;
    } catch (error) {
      
      return [];
    }
  }

  async createOrder(order: any): Promise<any> {
    try {
      const newOrder = {
        ...order,
        _id: new ObjectId(),
        userId: new ObjectId(order.userId),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection("orders").insertOne(newOrder);
      return newOrder;
    } catch (error) {
      
      throw error;
    }
  }

  async updateOrder(id: string, updates: any): Promise<any> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await this.db.collection("orders").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      return result;
    } catch (error) {
      
      return undefined;
    }
  }

  async findOrderByTrackingNumber(trackingNumber: string): Promise<any> {
    try {
      const order = await this.db.collection("orders").findOne({ 
        trackingNumber: trackingNumber 
      });
      return order;
    } catch (error) {
      
      return undefined;
    }
  }

  // Subscription methods
  async getSubscription(id: string): Promise<any> {
    try {
      const subscription = await this.db.collection("subscriptions").findOne({ _id: new ObjectId(id) });
      return subscription;
    } catch (error) {
      
      return undefined;
    }
  }

  async getSubscriptionsByUser(userId: string): Promise<any[]> {
    try {
      const subscriptions = await this.db.collection("subscriptions")
        .find({ fanId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();
      return subscriptions;
    } catch (error) {
      
      return [];
    }
  }

  async getSubscriptionsByArtist(artistId: string): Promise<any[]> {
    try {
      const subscriptions = await this.db.collection("subscriptions")
        .find({ artistId: new ObjectId(artistId) })
        .sort({ createdAt: -1 })
        .toArray();
      return subscriptions;
    } catch (error) {
      
      return [];
    }
  }

  async createSubscription(subscription: any): Promise<any> {
    try {
      const newSubscription = {
        ...subscription,
        _id: subscription._id || new ObjectId(),
        fanId: typeof subscription.fanId === 'string' ? new ObjectId(subscription.fanId) : subscription.fanId,
        artistId: typeof subscription.artistId === 'string' ? new ObjectId(subscription.artistId) : subscription.artistId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection("subscriptions").insertOne(newSubscription);
      return newSubscription;
    } catch (error) {
      
      throw error;
    }
  }

  async updateSubscription(id: string, updates: any): Promise<any> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await this.db.collection("subscriptions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      return result;
    } catch (error) {
      
      return undefined;
    }
  }

  // PromoCode methods
  async getPromoCode(id: string): Promise<any> {
    try {
      const promoCode = await this.db.collection("promotions").findOne({ _id: new ObjectId(id) });
      return promoCode;
    } catch (error) {
      
      return undefined;
    }
  }

  async getPromoCodeByCode(code: string): Promise<any> {
    try {
      const promoCode = await this.db.collection("promotions").findOne({ code: code });
      return promoCode;
    } catch (error) {
      
      return undefined;
    }
  }

  async getAllPromoCodes(): Promise<any[]> {
    try {
      const promoCodes = await this.db.collection("promotions")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      return promoCodes;
    } catch (error) {
      
      return [];
    }
  }

  async createPromoCode(promoCode: any): Promise<any> {
    try {
      const newPromoCode = {
        ...promoCode,
        _id: new ObjectId(),
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection("promotions").insertOne(newPromoCode);
      return newPromoCode;
    } catch (error) {
      
      throw error;
    }
  }

  async updatePromoCode(id: string, updates: any): Promise<any> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await this.db.collection("promotions").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      return result;
    } catch (error) {
      
      return undefined;
    }
  }

  async deletePromoCode(id: string): Promise<boolean> {
    try {
      const result = await this.db.collection("promotions").deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      
      return false;
    }
  }

  async validatePromoCode(code: string, userId: string, orderAmount: number): Promise<{ valid: boolean; discount: number; message: string }> {
    try {
      // Convert input code to lowercase to match database storage
      const lowerCode = code.toLowerCase();
      const promoCode = await this.getPromoCodeByCode(lowerCode);
      
      if (!promoCode) {
        return { valid: false, discount: 0, message: "Invalid promo code" };
      }

      // Check if active
      if (!promoCode.isActive) {
        return { valid: false, discount: 0, message: "Promo code is inactive" };
      }

      // Check expiry date (using expiresAt field)
      if (promoCode.expiresAt && new Date() > new Date(promoCode.expiresAt)) {
        return { valid: false, discount: 0, message: "Promo code has expired" };
      }

      // Check usage limit (if exists)
      if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
        return { valid: false, discount: 0, message: "Promo code usage limit reached" };
      }

      // Check minimum order amount (if exists)
      if (promoCode.minimumOrderAmount && orderAmount < promoCode.minimumOrderAmount) {
        return { valid: false, discount: 0, message: `Minimum order amount ₹${promoCode.minimumOrderAmount} required` };
      }

      // Calculate discount
      let discount = 0;
      if (promoCode.discountType === "percentage") { // lowercase in DB
        discount = (orderAmount * promoCode.discountValue) / 100;
        if (promoCode.maximumDiscount) {
          discount = Math.min(discount, promoCode.maximumDiscount);
        }
      } else {
        discount = promoCode.discountValue;
      }

      return { valid: true, discount, message: "Promo code applied successfully" };
    } catch (error) {
      
      return { valid: false, discount: 0, message: "Error validating promo code" };
    }
  }

  // Order Tracking methods
  async getOrderTracking(orderId: string): Promise<any[]> {
    try {
      const tracking = await this.db.collection("order_tracking")
        .find({ orderId: new ObjectId(orderId) })
        .sort({ createdAt: 1 })
        .toArray();
      return tracking;
    } catch (error) {
      
      return [];
    }
  }

  async createOrderTracking(tracking: any): Promise<any> {
    try {
      const newTracking = {
        ...tracking,
        _id: new ObjectId(),
        orderId: new ObjectId(tracking.orderId),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection("order_tracking").insertOne(newTracking);
      return newTracking;
    } catch (error) {
      
      throw error;
    }
  }

  async updateOrderTracking(id: string, updates: any): Promise<any> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await this.db.collection("order_tracking").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      return result;
    } catch (error) {
      
      return undefined;
    }
  }

  // Return Request methods
  async getReturnRequest(id: string): Promise<any> {
    try {
      const returnRequest = await this.db.collection("returnRequests").findOne({ _id: new ObjectId(id) });
      return returnRequest;
    } catch (error) {
      
      return undefined;
    }
  }

  async getReturnRequestsByUser(userId: string): Promise<any[]> {
    try {
      const returnRequests = await this.db.collection("returnRequests")
        .find({ userId: new ObjectId(userId) })
        .sort({ createdAt: -1 })
        .toArray();
      return returnRequests;
    } catch (error) {
      
      return [];
    }
  }

  async getReturnRequestsByOrder(orderId: string): Promise<any[]> {
    try {
      const returnRequests = await this.db.collection("returnRequests")
        .find({ orderId: new ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .toArray();
      return returnRequests;
    } catch (error) {
      
      return [];
    }
  }

  async createReturnRequest(request: any): Promise<any> {
    try {
      const newRequest = {
        ...request,
        _id: new ObjectId(),
        userId: new ObjectId(request.userId),
        orderId: new ObjectId(request.orderId),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.db.collection("returnRequests").insertOne(newRequest);
      return newRequest;
    } catch (error) {
      
      throw error;
    }
  }

  async updateReturnRequest(id: string, updates: any): Promise<any> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await this.db.collection("returnRequests").findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );
      
      return result;
    } catch (error) {
      
      return undefined;
    }
  }
}

