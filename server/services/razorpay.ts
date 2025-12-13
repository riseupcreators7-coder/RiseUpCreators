import Razorpay from "razorpay";
import crypto from "crypto";
import { ObjectId } from "mongodb";

// Lazy initialization of Razorpay instance
let razorpay: Razorpay | null = null;

// Payment status tracking
const paymentStatus = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastAttempt: Date;
  orderId: string;
  planId: string;
}>();

// Webhook processing tracking for idempotency
const processedWebhooks = new Set<string>();

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
};

// Timeout configuration
const TIMEOUT_CONFIG = {
  orderCreation: 30000, // 30 seconds
  paymentVerification: 45000, // 45 seconds
  paymentFetch: 15000 // 15 seconds
};

const getRazorpayInstance = () => {
  if (!razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      
      throw new Error("Payment service is not configured. Please contact support.");
    }

    try {
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID.trim(),
        key_secret: process.env.RAZORPAY_KEY_SECRET.trim()
      });
    } catch (error) {
      
      throw new Error("Payment service initialization failed. Please try again later.");
    }
  }
  return razorpay;
};

// Utility function for retry logic with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      

      // Don't retry on certain errors
      if (error.message?.includes('Authentication failed') ||
          error.message?.includes('Invalid key') ||
          error.message?.includes('Bad request')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
          RETRY_CONFIG.maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

// Utility function for timeout handling
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

export const createOrder = async (amount: number, currency = "INR", receipt?: string) => {
  try {
    const razorpayInstance = getRazorpayInstance();

    // Validate input parameters
    if (amount <= 0) {
      throw new Error("Invalid amount: must be greater than 0");
    }

    if (!['INR', 'USD', 'EUR'].includes(currency.toUpperCase())) {
      throw new Error("Invalid currency: must be INR, USD, or EUR");
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency.toUpperCase(),
      receipt: receipt || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      payment_capture: 1
    };

    

    const order = await retryWithBackoff(
      () => withTimeout(
        razorpayInstance.orders.create(options),
        TIMEOUT_CONFIG.orderCreation,
        'Order creation'
      ),
      'Order creation'
    );

    
    return order;
  } catch (error: any) {
    

    // Provide user-friendly error messages
    if (error.message?.includes('timed out')) {
      throw new Error("Payment service is currently slow. Please try again in a few moments.");
    } else if (error.message?.includes('Authentication failed')) {
      throw new Error("Payment service configuration error. Please contact support.");
    } else if (error.message?.includes('Invalid amount')) {
      throw new Error("Invalid payment amount. Please try again.");
    } else {
      throw new Error("Unable to create payment order. Please try again or contact support if the problem persists.");
    }
  }
};

export const verifyPayment = (orderId: string, paymentId: string, signature: string) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay key secret not found in environment variables");
    }

    if (!orderId || !paymentId || !signature) {
      throw new Error("Missing required payment verification parameters");
    }

    const secret = process.env.RAZORPAY_KEY_SECRET.trim();
    const body = orderId + "|" + paymentId;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === signature;

    

    return isValid;
  } catch (error: any) {
    
    return false;
  }
};

// Enhanced payment verification with status tracking
export const verifyPaymentWithTracking = async (
  orderId: string,
  paymentId: string,
  signature: string,
  planId: string
) => {
  const trackingKey = `${orderId}_${paymentId}`;

  try {
    // Initialize tracking if not exists
    if (!paymentStatus.has(trackingKey)) {
      paymentStatus.set(trackingKey, {
        status: 'processing',
        attempts: 0,
        lastAttempt: new Date(),
        orderId,
        planId
      });
    }

    const tracking = paymentStatus.get(trackingKey)!;
    tracking.attempts++;
    tracking.lastAttempt = new Date();

    

    // First, verify the signature
    const isSignatureValid = verifyPayment(orderId, paymentId, signature);
    if (!isSignatureValid) {
      tracking.status = 'failed';
      throw new Error("Payment signature verification failed");
    }

    // Then, fetch payment details from Razorpay to confirm status
    const paymentDetails = await retryWithBackoff(
      () => withTimeout(
        fetchPayment(paymentId),
        TIMEOUT_CONFIG.paymentFetch,
        'Payment fetch'
      ),
      'Payment fetch'
    );

    // Check payment status
    if (paymentDetails.status === 'captured' || paymentDetails.status === 'authorized') {
      tracking.status = 'completed';
      
      return {
        success: true,
        paymentDetails,
        tracking
      };
    } else if (paymentDetails.status === 'failed') {
      tracking.status = 'failed';
      throw new Error(`Payment failed: ${paymentDetails.error_description || 'Unknown error'}`);
    } else {
      // Payment is still processing
      tracking.status = 'processing';
      
      return {
        success: false,
        paymentDetails,
        tracking,
        message: "Payment is still being processed. Please wait..."
      };
    }

  } catch (error: any) {
    const tracking = paymentStatus.get(trackingKey);
    if (tracking) {
      tracking.status = 'failed';
    }

    

    throw error;
  }
};

export const createSubscription = async (planId: string, customerId: string, totalCount?: number) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: planId,
      total_count: totalCount || 12,
      notify: 1
    } as any);

    return subscription;
  } catch (error) {
    
    throw error;
  }
};

export const createCustomer = async (name: string, email: string, contact?: string) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const customer = await razorpayInstance.customers.create({
      name,
      email,
      contact
    });

    return customer;
  } catch (error) {
    
    throw error;
  }
};

export const refundPayment = async (paymentId: string, amount?: number) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount: amount ? Math.round(amount * 100) : undefined
    });

    return refund;
  } catch (error) {
    
    throw error;
  }
};

// Razorpay X Payout functions
export const createContact = async (name: string, email: string, type: string = "employee") => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const contact = await (razorpayInstance as any).contacts.create({
      name,
      email,
      type,
      reference_id: `contact_${Date.now()}`
    });

    return contact;
  } catch (error) {
    
    throw error;
  }
};

export const createFundAccount = async (contactId: string, accountDetails: {
  account_type: string;
  bank_account: {
    name: string;
    account_number: string;
    ifsc: string;
  };
}) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const fundAccount = await (razorpayInstance as any).fundAccounts.create({
      contact_id: contactId,
      account_type: accountDetails.account_type,
      bank_account: accountDetails.bank_account
    });

    return fundAccount;
  } catch (error) {
    
    throw error;
  }
};

export const createPayout = async (
  fundAccountId: string, 
  amount: number, 
  currency: string = "INR", 
  mode: string = "IMPS",
  options: {
    idempotencyKey?: string;
    reference_id?: string;
    narration?: string;
    notes?: Record<string, string>;
  } = {}
) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    
    // Use test account number in development/test mode
    const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER || "2323230000000000"; // Test account number for development
    
    // Generate idempotency key if not provided - CRITICAL for preventing duplicate payouts
    const idempotencyKey = options.idempotencyKey || `payout_${fundAccountId}_${amount}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate reference ID if not provided
    const referenceId = options.reference_id || `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const payoutData = {
      account_number: accountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      mode,
      purpose: "payout",
      reference_id: referenceId,
      narration: options.narration || `Payout to ${fundAccountId}`,
      notes: options.notes || {}
    };

    // Create payout with idempotency key in headers
    const payout = await (razorpayInstance as any).payouts.create(payoutData, {
      'X-Payout-Idempotency': idempotencyKey
    });

    return {
      ...payout,
      idempotencyKey, // Return the key for tracking
      referenceId
    };
  } catch (error: any) {
    console.error('Payout creation failed:', {
      fundAccountId,
      amount,
      error: error.message,
      code: error.code
    });
    
    // Handle specific Razorpay X errors
    if (error.code === 'BAD_REQUEST_ERROR' && error.description?.includes('duplicate')) {
      throw new Error('Duplicate payout request. Please try again with different parameters.');
    } else if (error.code === 'BAD_REQUEST_ERROR' && error.description?.includes('insufficient')) {
      throw new Error('Insufficient balance in account for this payout.');
    } else if (error.code === 'BAD_REQUEST_ERROR' && error.description?.includes('fund_account')) {
      throw new Error('Invalid fund account. Please verify bank details.');
    }
    
    throw error;
  }
};

// Helper function to generate secure idempotency keys for payouts
export const generatePayoutIdempotencyKey = (
  artistId: string,
  amount: number,
  type: 'subscription' | 'merch' | 'events' | 'manual' = 'manual'
): string => {
  // Create a deterministic but unique key based on artist, amount, and timestamp
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${type}_${artistId}_${amount}_${timestamp}_${random}`;
};

// Enhanced payout creation with better tracking and idempotency
export const createArtistPayout = async (
  artistId: string,
  amount: number,
  payoutType: 'subscription' | 'merch' | 'events' | 'manual' = 'manual',
  options: {
    narration?: string;
    notes?: Record<string, string>;
  } = {}
) => {
  try {
    // Get artist details first
    const { storage } = await import('../storage');
    const artist = await storage.getUser(artistId);
    
    if (!artist || artist.role !== 'artist') {
      throw new Error('Artist not found or invalid role');
    }

    if (!artist.artist?.bankDetails?.razorpayFundAccountId) {
      throw new Error('Artist bank details not configured. Please complete bank account setup.');
    }

    // Check if artist has sufficient balance
    const availableBalance = artist.artist.availableBalance || 0;
    if (availableBalance < amount) {
      throw new Error(`Insufficient balance. Available: ₹${availableBalance}, Requested: ₹${amount}`);
    }

    // Generate idempotency key
    const idempotencyKey = generatePayoutIdempotencyKey(artistId, amount, payoutType);
    
    // Create payout with enhanced options
    const payout = await createPayout(
      artist.artist.bankDetails.razorpayFundAccountId,
      amount,
      'INR',
      'IMPS', // Fast transfer for better UX
      {
        idempotencyKey,
        narration: options.narration || `${payoutType} payout to ${artist.name}`,
        notes: {
          artistId,
          artistName: artist.name,
          payoutType,
          ...options.notes
        }
      }
    );

    // Update artist balance and create payout record
    const session = (storage as any).client?.startSession();
    try {
      await session?.withTransaction(async () => {
        // Deduct from available balance
        await storage.updateUser(artistId, {
          'artist.availableBalance': availableBalance - amount,
          'artist.revenue.totalPaidOut': (artist.artist?.revenue?.totalPaidOut || 0) + amount
        });

        // Create payout record for tracking
        await storage.db.collection('payouts').insertOne({
          artistId: new ObjectId(artistId),
          amount,
          currency: 'INR',
          status: payout.status,
          razorpayPayoutId: payout.id,
          idempotencyKey,
          referenceId: payout.referenceId,
          payoutType,
          createdAt: new Date(),
          updatedAt: new Date(),
          narration: options.narration,
          notes: options.notes
        }, { session });
      });
    } finally {
      await session?.endSession();
    }



    return {
      success: true,
      payout,
      newBalance: availableBalance - amount
    };

  } catch (error: any) {
    console.error('❌ Artist payout failed:', {
      artistId,
      amount,
      error: error.message
    });
    throw error;
  }
};

export const getPayoutStatus = async (payoutId: string) => {
  try {
    const razorpayInstance = getRazorpayInstance();
    const payout = await (razorpayInstance as any).payouts.fetch(payoutId);
    

    
    return payout;
  } catch (error: any) {
    console.error('❌ Failed to fetch payout status:', {
      payoutId,
      error: error.message
    });
    throw error;
  }
};

// Update payout status in database when webhook is received
export const updatePayoutStatus = async (payoutId: string, status: string, failureReason?: string) => {
  try {
    const { storage } = await import('../storage');
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    };
    
    if (failureReason) {
      updateData.failureReason = failureReason;
    }
    
    if (status === 'processed') {
      updateData.processedAt = new Date();
    } else if (status === 'failed' || status === 'cancelled') {
      updateData.failedAt = new Date();
      
      // If payout failed, refund the amount to artist's available balance
      const payout = await storage.db.collection('payouts').findOne({ razorpayPayoutId: payoutId });
      if (payout) {
        await storage.updateUser(payout.artistId.toString(), {
          $inc: {
            'artist.availableBalance': payout.amount,
            'artist.revenue.totalPaidOut': -payout.amount
          }
        });
        

      }
    }
    
    await storage.db.collection('payouts').updateOne(
      { razorpayPayoutId: payoutId },
      { $set: updateData }
    );
    

    
    return true;
  } catch (error: any) {
    console.error('❌ Failed to update payout status:', {
      payoutId,
      status,
      error: error.message
    });
    throw error;
  }
};

export const fetchPayment = async (paymentId: string) => {
  try {
    if (!paymentId) {
      throw new Error("Payment ID is required");
    }

    const razorpayInstance = getRazorpayInstance();

    

    const payment = await retryWithBackoff(
      () => withTimeout(
        razorpayInstance.payments.fetch(paymentId),
        TIMEOUT_CONFIG.paymentFetch,
        'Payment fetch'
      ),
      'Payment fetch'
    );

    
    return payment;
  } catch (error: any) {
    

    // Provide user-friendly error messages
    if (error.message?.includes('timed out')) {
      throw new Error("Payment service is currently slow. Please try again in a few moments.");
    } else if (error.message?.includes('not found')) {
      throw new Error("Payment not found. Please contact support if you were charged.");
    } else {
      throw new Error("Unable to fetch payment details. Please try again or contact support.");
    }
  }
};

// Payment status management functions
export const getPaymentStatus = (orderId: string, paymentId: string) => {
  const trackingKey = `${orderId}_${paymentId}`;
  return paymentStatus.get(trackingKey);
};

export const clearPaymentStatus = (orderId: string, paymentId: string) => {
  const trackingKey = `${orderId}_${paymentId}`;
  paymentStatus.delete(trackingKey);
};

export const getAllPaymentStatuses = () => {
  const statuses: Array<{
    key: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    lastAttempt: Date;
    orderId: string;
    planId: string;
  }> = [];

  paymentStatus.forEach((value, key) => {
    statuses.push({
      key,
      ...value
    });
  });

  return statuses;
};

// Cleanup old payment statuses (older than 1 hour)
export const cleanupOldPaymentStatuses = () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const keysToDelete: string[] = [];

  paymentStatus.forEach((tracking, key) => {
    if (tracking.lastAttempt < oneHourAgo) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => paymentStatus.delete(key));

  
};

// Run cleanup every 30 minutes
setInterval(cleanupOldPaymentStatuses, 30 * 60 * 1000);

// Validate payout request before processing
export const validatePayoutRequest = async (artistId: string, amount: number): Promise<{
  valid: boolean;
  error?: string;
  artist?: any;
}> => {
  try {
    if (amount <= 0) {
      return { valid: false, error: 'Amount must be greater than 0' };
    }

    if (amount < 1) {
      return { valid: false, error: 'Minimum payout amount is ₹1' };
    }

    // Get artist details
    const { storage } = await import('../storage');
    const artist = await storage.getUser(artistId);

    if (!artist || artist.role !== 'artist') {
      return { valid: false, error: 'Artist not found' };
    }

    if (!artist.artist?.bankDetails?.razorpayFundAccountId) {
      return { valid: false, error: 'Bank details not configured' };
    }

    const availableBalance = artist.artist.availableBalance || 0;
    if (availableBalance < amount) {
      return { 
        valid: false, 
        error: `Insufficient balance. Available: ₹${availableBalance}, Requested: ₹${amount}` 
      };
    }

    return { valid: true, artist };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Validation failed' };
  }
};

// Get all payouts for an artist
export const getArtistPayouts = async (artistId: string, limit: number = 20) => {
  try {
    const { storage } = await import('../storage');
    
    const payouts = await storage.db.collection('payouts')
      .find({ artistId: new ObjectId(artistId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return payouts.map(payout => ({
      ...payout,
      _id: payout._id.toString(),
      artistId: payout.artistId.toString()
    }));
  } catch (error: any) {
    console.error('❌ Failed to get artist payouts:', error);
    throw error;
  }
};

export const generateQRCode = async (amount: number, description: string) => {
  // Generate a base64 QR code for tickets
  // This is a simplified implementation - in production, use a proper QR library
  const qrData = JSON.stringify({
    amount,
    description,
    timestamp: Date.now()
  });
  
  // Return a data URL for the QR code (in production, use actual QR generation)
  return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
};

// Webhook signature verification
export const verifyWebhookSignature = (body: string, signature: string): boolean => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    
    return expectedSignature === signature;
  } catch (error) {
    
    return false;
  }
};

// Process webhook events with idempotency
export const processWebhookEvent = async (event: any) => {
  const eventId = event.id || `${event.entity?.id}_${event.event}_${Date.now()}`;
  
  // Check for duplicate processing
  if (processedWebhooks.has(eventId)) {
    
    return { success: true, reason: 'already_processed' };
  }

  try {
    processedWebhooks.add(eventId);
    
    switch (event.event) {
      case 'payment.captured':
        return await handlePaymentCaptured(event.payload.payment.entity);
      
      case 'payment.failed':
        return await handlePaymentFailed(event.payload.payment.entity);
      
      case 'subscription.activated':
        return await handleSubscriptionActivated(event.payload.subscription.entity);
      
      case 'subscription.cancelled':
        return await handleSubscriptionCancelled(event.payload.subscription.entity);
      
      case 'payout.processed':
        return await handlePayoutProcessed(event.payload.payout.entity);
      
      case 'payout.failed':
        return await handlePayoutFailed(event.payload.payout.entity);
      
      case 'payout.cancelled':
        return await handlePayoutCancelled(event.payload.payout.entity);
      
      default:
        
        return { success: true, reason: 'event_not_handled' };
    }
  } catch (error) {
    
    processedWebhooks.delete(eventId); // Allow retry on error
    throw error;
  }
};

async function handlePaymentCaptured(payment: any) {
  try {
    const { storage } = await import('../storage');
    
    // Find subscription by razorpay order ID
    const subscription = await storage.db.collection('subscriptions').findOne({
      razorpayOrderId: payment.order_id,
      status: 'PENDING_PAYMENT'
    });

    if (subscription) {
      // Activate subscription and update artist revenue
      const session = (storage as any).client?.startSession();
      try {
        await session?.withTransaction(async () => {
          // Update subscription
          await storage.db.collection('subscriptions').updateOne(
            { _id: subscription._id },
            {
              $set: {
                active: true,
                status: 'ACTIVE',
                razorpayPaymentId: payment.id,
                activatedAt: new Date(),
                updatedAt: new Date()
              }
            },
            { session }
          );

          // Update artist revenue and available balance
          await storage.db.collection('users').updateOne(
            { _id: subscription.artistId, role: 'artist' },
            {
              $inc: {
                'artist.revenue.subscriptions': subscription.amount,
                'artist.availableBalance': subscription.amount // Artist gets 100% of fan subscription
              },
              $addToSet: {
                'artist.subscribers': subscription.fanId
              }
            },
            { session }
          );
        });
      } finally {
        await session?.endSession();
      }

      
      return { success: true, subscriptionId: subscription._id };
    }

    // Check for regular orders
    const order = await storage.db.collection('orders').findOne({
      razorpayOrderId: payment.order_id,
      status: 'PENDING'
    });

    if (order) {
      const session = (storage as any).client?.startSession();
      
      try {
        await session?.withTransaction(async () => {
          // Update order status
          await storage.db.collection('orders').updateOne(
            { _id: order._id },
            {
              $set: {
                status: 'PAID',
                razorpayPaymentId: payment.id,
                paidAt: new Date(),
                updatedAt: new Date()
              }
            },
            { session }
          );

          // Process artist revenue and create transactions for each item
          if (order.items && Array.isArray(order.items)) {
            const transactions = [];
            
            // Get cost settings for merch calculations
            const costSettings = await storage.db.collection("system_settings").findOne({ type: "merch_costs" });
            const costs = costSettings?.costs || {};
            
            // Calculate total item value (pre-tax) to determine proportion of tax-inclusive amount
            // For artist revenue, use pre-tax amounts only (tax is only for admin Total Revenue display)
            const totalItemValue = order.items.reduce((sum: number, item: any) => sum + ((item.price || item.unitPrice || 0) * (item.quantity || item.qty || 1)), 0);
            
            for (const item of order.items) {
              const itemType = item.type || 'other';
              const itemValue = (item.price || item.unitPrice || 0) * (item.quantity || item.qty || 1); // Use pre-tax amount for artist revenue
              
              if (itemValue > 0) {
                // Create transaction record
                const transactionData = {
                  userId: order.userId,
                  orderId: order._id,
                  amount: itemValue, // Pre-tax amount
                  totalAmount: payment.amount / 100, // Store full payment amount for admin Total Revenue display
                  currency: "INR",
                  status: "completed",
                  type: itemType === 'ticket' ? 'event' : itemType,
                  description: `${item.name || 'Order Item'} - Order #${order._id.toString().slice(-8)}`,
                  razorpayPaymentId: payment.id,
                  razorpayOrderId: payment.order_id,
                  itemId: item.merchId || item.eventId || item.id,
                  artistId: item.artistId,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                transactions.push(transactionData);
                
                // Update artist revenue based on item type (using pre-tax amounts)
                if (item.artistId) {
                  let artistRevenue = 0;
                  
                  if (itemType === 'ticket' || itemType === 'event') {
                    // Event tickets: Artist gets 90% of pre-tax amount
                    artistRevenue = itemValue * 0.9;
                    
                    await storage.db.collection("users").updateOne(
                      { _id: new ObjectId(item.artistId), role: "artist" },
                      { 
                        $inc: { 
                          "artist.revenue.events": artistRevenue,
                          "artist.availableBalance": artistRevenue
                        }
                      },
                      { session }
                    );
                  } else if (itemType === 'merch' || itemType === 'merchandise') {
                    // Merchandise: Artist gets remainder after costs and platform fee (calculated on pre-tax amount)
                    const merchPlatformCosts = (costs.baseCost || 0) + (costs.manufacturingCost || 0) + 
                                              (costs.shippingCost || 0) + (costs.packagingCost || 0);
                    const platformFee = itemValue * 0.1; // 10% fee on pre-tax amount
                    artistRevenue = Math.max(0, itemValue - merchPlatformCosts - platformFee);                    if (artistRevenue > 0) {
                      await storage.db.collection("users").updateOne(
                        { _id: new ObjectId(item.artistId), role: "artist" },
                        { 
                          $inc: { 
                            "artist.revenue.merch": artistRevenue,
                            "artist.availableBalance": artistRevenue
                          }
                        },
                        { session }
                      );
                    }
                  }
                }
              }
            }
            
            if (transactions.length > 0) {
              await storage.db.collection("transactions").insertMany(transactions, { session });
            }
          }
        });
      } finally {
        await session?.endSession();
      }

      
      return { success: true, orderId: order._id };
    }

    
    return { success: true, reason: 'no_matching_entity' };
  } catch (error) {
    
    throw error;
  }
}

async function handlePaymentFailed(payment: any) {
  try {
    const { storage } = await import('../storage');
    
    // Find and update subscription
    const subscription = await storage.db.collection('subscriptions').findOne({
      razorpayOrderId: payment.order_id,
      status: 'PENDING_PAYMENT'
    });

    if (subscription) {
      await storage.db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        {
          $set: {
            status: 'PAYMENT_FAILED',
            failureReason: payment.error_description,
            updatedAt: new Date()
          }
        }
      );

      
      return { success: true, subscriptionId: subscription._id };
    }

    // Check for regular orders
    const order = await storage.db.collection('orders').findOne({
      razorpayOrderId: payment.order_id
    });

    if (order) {
      await storage.db.collection('orders').updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'FAILED',
            failureReason: payment.error_description,
            updatedAt: new Date()
          }
        }
      );

      
      return { success: true, orderId: order._id };
    }

    return { success: true, reason: 'no_matching_entity' };
  } catch (error) {
    
    throw error;
  }
}

async function handleSubscriptionActivated(subscription: any) {
  
  return { success: true, razorpaySubscriptionId: subscription.id };
}

async function handleSubscriptionCancelled(subscription: any) {
  try {
    const { storage } = await import('../storage');
    
    // Find subscription by Razorpay subscription ID
    const dbSubscription = await storage.db.collection('subscriptions').findOne({
      razorpaySubId: subscription.id
    });

    if (dbSubscription) {
      await storage.db.collection('subscriptions').updateOne(
        { _id: dbSubscription._id },
        {
          $set: {
            active: false,
            status: 'CANCELLED',
            cancelledAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      
      return { success: true, subscriptionId: dbSubscription._id };
    }

    return { success: true, reason: 'subscription_not_found' };
  } catch (error) {
    
    throw error;
  }
}

// Payout webhook handlers
async function handlePayoutProcessed(payout: any) {
  try {

    
    await updatePayoutStatus(payout.id, 'processed');
    return { success: true, payoutId: payout.id };
  } catch (error) {
    console.error('❌ Failed to handle payout processed:', error);
    throw error;
  }
}

async function handlePayoutFailed(payout: any) {
  try {

    
    await updatePayoutStatus(payout.id, 'failed', payout.failure_reason);
    return { success: true, payoutId: payout.id };
  } catch (error) {
    console.error('❌ Failed to handle payout failed:', error);
    throw error;
  }
}

async function handlePayoutCancelled(payout: any) {
  try {
    console.log('🚫 Payout cancelled webhook:', {
      payoutId: payout.id,
      amount: payout.amount / 100
    });
    
    await updatePayoutStatus(payout.id, 'cancelled');
    return { success: true, payoutId: payout.id };
  } catch (error) {
    console.error('❌ Failed to handle payout cancelled:', error);
    throw error;
  }
}

// Clean up old processed webhook IDs (run periodically)
setInterval(() => {
  if (processedWebhooks.size > 10000) {
    processedWebhooks.clear();
    
  }
}, 60 * 60 * 1000); // Every hour

export default razorpay;

