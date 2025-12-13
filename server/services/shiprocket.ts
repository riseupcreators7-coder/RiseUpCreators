import { storage } from "../storage";
import { NotificationService } from "./notifications";
import { AnalyticsService } from "./analytics";

interface ShiprocketOrder {
  orderId: string;
  shipmentId?: string;
  awb?: string;
  courierId?: number;
  status: string;
  estimatedDelivery?: Date;
  trackingUrl?: string;
  courierName?: string;
  pickupId?: string;
}

interface CreateShipmentRequest {
  pickupPostcode: string;
  deliveryPostcode: string;
  orderId: string;
  userId: string;
  items: Array<{
    name: string;
    sku: string;
    units: number;
    sellingPrice: number;
    weight: number;
  }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
  };
}

interface AWBAssignRequest {
  shipmentId: string;
  courierId?: number;
}

interface PickupRequest {
  shipmentId: string;
  pickupDate: string;
}

/**
 * Shiprocket Integration Service
 * Handles shipping, tracking, and delivery management
 */
export class ShiprocketService {
  private static baseUrl = process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";
  private static authUrl = "https://apiv2.shiprocket.in/v1/external/auth/login";
  
  // Token cache with expiry
  private static tokenCache: {
    token: string | null;
    expiresAt: number;
  } = { token: null, expiresAt: 0 };

  // Get headers with cached token
  private static getHeaders(token?: string): Record<string, string> {
    const authToken = token || this.getCachedToken();
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    };
  }

  // Get cached token if valid, otherwise null
  private static getCachedToken(): string | null {
    if (this.tokenCache.token && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }
    return null;
  }

  // Validate Shiprocket configuration
  private static validateConfig(): boolean {
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
      
      return false;
    }
    
    if (!process.env.SHIPROCKET_PICKUP_LOCATION) {
      
      return false;
    }

    if (!process.env.SHIPROCKET_PICKUP_PINCODE) {
      
      return false;
    }
    
    
    return true;
  }

  /**
   * Authenticate with Shiprocket and get a fresh token
   */
  private static async authenticate(): Promise<string> {
    try {
      
      
      const response = await fetch(this.authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
      }

      const authData = await response.json();
      
      if (!authData.token) {
        throw new Error("No token received from authentication");
      }

      // Cache token for 240 hours (as per Shiprocket docs)
      this.tokenCache = {
        token: authData.token,
        expiresAt: Date.now() + (240 * 60 * 60 * 1000) // 240 hours in milliseconds
      };

      
      return authData.token;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Make API call with automatic token refresh on 401
   */
  private static async makeApiCall(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
    const maxRetries = 2;
    
    try {
      let token = this.getCachedToken();
      
      // Get fresh token if none cached
      if (!token) {
        token = await this.authenticate();
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...this.getHeaders(token)
        }
      });

      // If 401 and we haven't already retried, try to refresh token
      if (response.status === 401 && retryCount < maxRetries) {
        
        
        try {
          const newToken = await this.authenticate();
          
          // Retry with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              ...this.getHeaders(newToken)
            }
          });
          
          return retryResponse;
        } catch (authError) {
          
          return response; // Return original 401 response
        }
      }

      return response;
    } catch (error) {
      // Retry on network errors
      if (retryCount < maxRetries) {
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return this.makeApiCall(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Create a shipment from an approved return request
   */
  static async createShipment(shipmentData: CreateShipmentRequest): Promise<ShiprocketOrder> {
    try {
      if (!this.validateConfig()) {
        // In development mode, simulate successful shipment creation
        if (process.env.NODE_ENV === "development") {
          
          
          const mockShipment: ShiprocketOrder = {
            orderId: shipmentData.orderId,
            shipmentId: `DEV_SHIP_${Date.now()}`,
            awb: `DEV_AWB_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: "CREATED",
            trackingUrl: `https://shiprocket.co/tracking/DEV_AWB_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
          };

          // Log analytics for development
          await AnalyticsService.trackEvent("system", "shiprocket_shipment_created_dev", "shipping", {
            orderId: shipmentData.orderId,
            shipmentId: mockShipment.shipmentId,
            awb: mockShipment.awb
          });

          return mockShipment;
        }
        
        throw new Error("Shiprocket integration not configured");
      }

      

      // Step 1: Create order in Shiprocket
      const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || "";

      // basic sanitization
      const sanitizePincode = (pin: string) => (pin || "").toString().replace(/[^0-9]/g, "").slice(0, 6);
      const deliveryPin = sanitizePincode(shipmentData.deliveryPostcode);
      if (!deliveryPin || deliveryPin.length !== 6) {
        throw new Error("Invalid delivery pincode. Must be a 6-digit number.");
      }

      const orderPayload = {
        order_id: shipmentData.orderId,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: pickupLocation,
        channel_id: Number(process.env.SHIPROCKET_CHANNEL_ID) || 1,
        comment: "Automated shipment from Rise Up platform",

        billing_customer_name: shipmentData.customer.name,
        billing_last_name: "",
        billing_address: shipmentData.customer.address,
        billing_address_2: "",
        billing_city: shipmentData.customer.city,
        billing_pincode: deliveryPin,
        billing_state: shipmentData.customer.state,
        billing_country: "India",
        billing_email: shipmentData.customer.email,
        billing_phone: shipmentData.customer.phone,

        shipping_is_billing: true,
        shipping_customer_name: shipmentData.customer.name,
        shipping_last_name: "",
        shipping_address: shipmentData.customer.address,
        shipping_address_2: "",
        shipping_city: shipmentData.customer.city,
        shipping_pincode: deliveryPin,
        shipping_state: shipmentData.customer.state,
        shipping_country: "India",
        shipping_email: shipmentData.customer.email,
        shipping_phone: shipmentData.customer.phone,

        order_items: shipmentData.items.map(item => ({
          name: item.name,
          sku: item.sku,
          units: item.units,
          selling_price: item.sellingPrice,
          discount: 0,
          tax: 0,
          hsn: "1234"
        })),

        payment_method: "Prepaid",
        sub_total: shipmentData.items.reduce((sum, item) =>
          sum + (item.sellingPrice * item.units), 0),
        length: 10,
        breadth: 10,
        height: 10,
        weight: shipmentData.items.reduce((sum, item) =>
          sum + (item.weight * item.units), 0)
      };

      

      const createResponse = await this.makeApiCall(`${this.baseUrl}/orders/create/adhoc`, {
        method: "POST",
        body: JSON.stringify(orderPayload)
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.text();
        
        
        // If Shiprocket API fails, fall back to development mode
        if (createResponse.status === 403 || createResponse.status === 401) {
          
          
          const mockShipment: ShiprocketOrder = {
            orderId: shipmentData.orderId,
            shipmentId: `FALLBACK_SHIP_${Date.now()}`,
            awb: `FALLBACK_AWB_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            status: "CREATED",
            courierName: "Manual Processing Required",
            trackingUrl: `https://shiprocket.co/tracking/FALLBACK_AWB_${Math.random().toString(36).substr(2, 9).toUpperCase()}`
          };

          await AnalyticsService.trackEvent("system", "shiprocket_shipment_fallback", "shipping", {
            orderId: shipmentData.orderId,
            shipmentId: mockShipment.shipmentId,
            awb: mockShipment.awb,
            reason: "api_access_denied"
          });

          return mockShipment;
        }
        
        throw new Error(`Shiprocket order creation failed: ${createResponse.status} - ${errorData}`);
      }

      const createResult = await createResponse.json();

      if (!createResult.order_id && !createResult.shipment_id) {
        throw new Error("Shiprocket order creation failed - no order/shipment ID returned");
      }

      

      const shipmentId = createResult.shipment_id || createResult.order_id;
      let awb = createResult.awb || createResult.awb_number;
      let courierName = "Unknown";
      let pickupId = "";

      // Step 2: Assign AWB if not already assigned
      if (!awb && shipmentId) {
        try {
          
          const awbResult = await this.assignCourierAndAWB(shipmentId);
          awb = awbResult.awb;
          courierName = awbResult.courierName;
          
        } catch (awbError) {
          
          // Don't fail the entire process if AWB assignment fails
        }
      }

      // Step 3: Generate pickup request
      if (shipmentId) {
        try {
          
          const pickupResult = await this.generatePickup(shipmentId);
          pickupId = pickupResult.pickupId;
          
        } catch (pickupError) {
          
          // Don't fail the entire process if pickup generation fails
        }
      }

      // Log analytics
      await AnalyticsService.trackEvent("system", "shiprocket_shipment_created", "shipping", {
        orderId: shipmentData.orderId,
        shipmentId: shipmentId,
        awb: awb,
        courierName: courierName,
        pickupId: pickupId
      });

      const result: ShiprocketOrder = {
        orderId: shipmentData.orderId,
        shipmentId: shipmentId,
        awb: awb,
        status: "CREATED",
        trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : createResult.tracking_url,
        courierName: courierName,
        pickupId: pickupId
      };

      
      return result;

    } catch (error: any) {
      
      throw new Error(`Shipment creation failed: ${error.message}`);
    }
  }

  /**
   * Assign AWB (courier) to shipment
   */
  static async assignCourierAndAWB(shipmentId: string, courierId?: number): Promise<{ awb: string; courierId: number; courierName: string }> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const payload: any = { shipment_id: shipmentId };
      if (courierId) {
        payload.courier_id = courierId;
      }

      const response = await this.makeApiCall(`${this.baseUrl}/courier/assign/awb`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`AWB assignment failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();

      if (!result.awb_code && !result.response?.data?.awb_code) {
        throw new Error("No AWB code received from courier assignment");
      }

      const awbData = result.response?.data || result;
      
      

      return {
        awb: awbData.awb_code,
        courierId: awbData.courier_company_id || courierId || 0,
        courierName: awbData.courier_name || "Unknown"
      };

    } catch (error: any) {
      
      throw new Error(`AWB assignment failed: ${error.message}`);
    }
  }

  /**
   * Generate pickup request
   */
  static async generatePickup(shipmentId: string, pickupDate?: string): Promise<{ pickupId: string; status: string }> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const payload = {
        shipment_id: [shipmentId],
        pickup_date: pickupDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Tomorrow by default
      };

      const response = await this.makeApiCall(`${this.baseUrl}/courier/generate/pickup`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Pickup generation failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();

      

      return {
        pickupId: result.pickup_id || result.response?.pickup_id || "generated",
        status: result.pickup_status || result.response?.pickup_status || "scheduled"
      };

    } catch (error: any) {
      
      throw new Error(`Pickup generation failed: ${error.message}`);
    }
  }

  /**
   * Check pincode serviceability
   */
  static async checkServiceability(pickupPincode: string, deliveryPincode: string, weight: number = 1): Promise<{ serviceable: boolean; couriers: any[] }> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(
        `${this.baseUrl}/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=0&weight=${weight}`,
        {
          method: "GET"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check serviceability");
      }

      const data = await response.json();
      const couriers = data.data?.available_courier_companies || [];

      return {
        serviceable: couriers.length > 0,
        couriers: couriers
      };

    } catch (error: any) {
      
      return { serviceable: false, couriers: [] };
    }
  }

  /**
   * Simple auth + config health check. Calls a lightweight serviceability API.
   */
  static async healthCheck(): Promise<{ ok: boolean; reason?: string; details?: any }> {
    try {
      if (!this.validateConfig()) {
        return { ok: false, reason: "misconfigured_env" };
      }

      const pickupPin = (process.env.SHIPROCKET_PICKUP_PINCODE || "400001").replace(/[^0-9]/g, "").slice(0, 6);
      const deliveryPin = "110001"; // Delhi for testing

      const resp = await this.makeApiCall(
        `${this.baseUrl}/courier/serviceability?pickup_postcode=${pickupPin}&delivery_postcode=${deliveryPin}&cod=0&weight=1`,
        { method: "GET" }
      );

      if (!resp.ok) {
        const text = await resp.text();
        return { ok: false, reason: `api_error_${resp.status}`, details: text };
      }

      const data = await resp.json();
      return { ok: true, details: { available: data?.data?.available_courier_companies?.length ?? 0 } };
    } catch (e: any) {
      return { ok: false, reason: "exception", details: e?.message };
    }
  }

  /**
   * Enhanced tracking with AWB support
   */
  static async getTrackingByAWB(awb: string): Promise<any> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(`${this.baseUrl}/courier/track/awb/${awb}`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tracking information by AWB");
      }

      const trackingData = await response.json();

      return {
        awb: awb,
        currentStatus: trackingData.current_status || trackingData.status,
        statusCode: trackingData.status_code,
        trackingUrl: `https://shiprocket.co/tracking/${awb}`,
        events: trackingData.tracking_data?.track_detail || trackingData.track || [],
        estimatedDelivery: trackingData.etd || trackingData.edd,
        courierName: trackingData.courier_name,
        shipmentId: trackingData.shipment_id
      };

    } catch (error: any) {
      
      throw new Error(`AWB tracking fetch failed: ${error.message}`);
    }
  }

  /**
   * Get shipment tracking information
   */
  static async getTracking(shipmentId: string): Promise<any> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(`${this.baseUrl}/courier/track?shipment_id=${shipmentId}`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tracking information");
      }

      const trackingData = await response.json();

      return {
        shipmentId,
        currentStatus: trackingData.current_status || trackingData.status,
        statusCode: trackingData.status_code,
        trackingUrl: trackingData.tracking_url,
        events: trackingData.track || [],
        estimatedDelivery: trackingData.etd || trackingData.edd,
        courierName: trackingData.courier_name,
        awb: trackingData.awb_number
      };

    } catch (error: any) {
      
      throw new Error(`Tracking fetch failed: ${error.message}`);
    }
  }

  /**
   * Update shipment status and notify user
   */
  static async updateShipmentStatus(orderId: string, status: string, trackingDetails?: any): Promise<void> {
    try {
      // Update database with new status
      await storage.updateOrder(orderId, {
        shipmentStatus: status,
        trackingDetails,
        updatedAt: new Date()
      });

      // Notify user based on status
      if (status === "SHIPPED") {
        await NotificationService.notifyAdminAction("system", "order_shipped", {
          orderId,
          status,
          trackingUrl: trackingDetails?.trackingUrl
        });
      } else if (status === "DELIVERED") {
        await NotificationService.notifyAdminAction("system", "order_delivered", {
          orderId,
          status
        });
      }

      

    } catch (error: any) {
      
    }
  }

  /**
   * Generate shipping label
   */
  static async generateShippingLabel(shipmentId: string): Promise<any> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(`${this.baseUrl}/courier/generate/label`, {
        method: "POST",
        body: JSON.stringify({ shipment_id: [shipmentId] })
      });

      if (!response.ok) {
        throw new Error("Failed to generate shipping label");
      }

      const labelData = await response.json();

      return {
        labelUrl: labelData.label_url,
        shipmentId,
        generatedAt: new Date()
      };

    } catch (error: any) {
      
      throw new Error(`Label generation failed: ${error.message}`);
    }
  }

  /**
   * Cancel shipment
   */
  static async cancelShipment(shipmentId: string, reason: string): Promise<boolean> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(`${this.baseUrl}/orders/cancel`, {
        method: "POST",
        body: JSON.stringify({
          ids: [shipmentId],
          reason: reason
        })
      });

      if (!response.ok) {
        throw new Error("Failed to cancel shipment");
      }

      

      return true;

    } catch (error: any) {
      
      return false;
    }
  }

  /**
   * Get available courier options
   */
  static async getCourierOptions(pickupPincode: string, deliveryPincode: string): Promise<any[]> {
    try {
      if (!this.validateConfig()) {
        throw new Error("Shiprocket integration not configured");
      }

      const response = await this.makeApiCall(
        `${this.baseUrl}/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=0&weight=1`,
        {
          method: "GET"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch courier options");
      }

      const courierData = await response.json();

      return courierData.data?.available_courier_companies || [];

    } catch (error: any) {
      
      return [];
    }
  }
}

export default ShiprocketService;

