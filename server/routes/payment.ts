import type { Express } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { createOrder, verifyPayment } from "../services/razorpay";

export function setupPaymentRoutes(app: Express): void {
  // Create Razorpay order for wallet funding
  app.post("/api/payment/create-order", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { amount, currency = "INR", receipt } = req.body;

      // Validate input
      if (!amount || amount <= 0) {
        return res.status(400).json({ 
          message: "Invalid amount. Amount must be greater than 0." 
        });
      }

      if (amount < 10) {
        return res.status(400).json({ 
          message: "Minimum amount is ₹10." 
        });
      }

      console.log(`💳 Creating Razorpay order for user ${req.user?.email}:`, {
        amount,
        currency,
        receipt
      });

      // Create order using Razorpay service
      const order = await createOrder(amount, currency, receipt);

      console.log(`✅ Razorpay order created successfully:`, {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      });

      res.json({
        success: true,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      });

    } catch (error: any) {
      console.error("❌ Failed to create Razorpay order:", error);
      
      // Return user-friendly error message
      let errorMessage = "Failed to create payment order. Please try again.";
      
      if (error.message?.includes("Payment service is not configured")) {
        errorMessage = "Payment service is currently unavailable. Please contact support.";
      } else if (error.message?.includes("Invalid amount")) {
        errorMessage = "Invalid payment amount. Please enter a valid amount.";
      } else if (error.message?.includes("timed out")) {
        errorMessage = "Payment service is currently slow. Please try again in a few moments.";
      }

      res.status(500).json({ 
        success: false,
        message: errorMessage 
      });
    }
  });

  // Verify payment signature (optional endpoint for additional verification)
  app.post("/api/payment/verify", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
          message: "Missing required payment verification parameters." 
        });
      }

      console.log(`🔍 Verifying payment for user ${req.user?.email}:`, {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id
      });

      const isValid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (isValid) {
        console.log(`✅ Payment verification successful`);
        res.json({ 
          success: true, 
          message: "Payment verified successfully" 
        });
      } else {
        console.log(`❌ Payment verification failed`);
        res.status(400).json({ 
          success: false, 
          message: "Payment verification failed" 
        });
      }

    } catch (error: any) {
      console.error("❌ Payment verification error:", error);
      res.status(500).json({ 
        success: false,
        message: "Payment verification failed. Please contact support." 
      });
    }
  });
}