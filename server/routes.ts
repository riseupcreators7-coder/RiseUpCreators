import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MongoStore from "connect-mongo";
import { storage } from "./storage";
import { setupAuthRoutes } from "./routes/auth";
import { setupUserRoutes } from "./routes/users";
import { setupArtistRoutes } from "./routes/artists";
import { setupContentRoutes } from "./routes/content";
import { setupCommerceRoutes } from "./routes/commerce";
import { setupTicketRoutes } from "./routes/tickets";
import { setupAdminRoutes } from "./routes/admin";
import { setupAdsRoutes } from "./routes/ads";
import { setupSearchRoutes } from "./routes/search";
import { setupIntegrationRoutes } from "./routes/integrations";
import webhookRoutes from "./routes/webhooks";

// Extend session type for cart
declare module "express-session" {
  interface SessionData {
    cart?: {
      items: Array<{
        _id: string;
        type: "merch" | "event";
        id: string;
        name: string;
        price: number;
        quantity: number;
        size?: string;
        color?: string;
        image?: string;
        artistName?: string;
        eventDate?: string;
        venue?: string;
      }>;
      summary: {
        subtotal: number;
        discount: number;
        tax: number;
        total: number;
      };
      appliedPromoCode?: string;
    };
  }
}

// Middleware: Session configuration for storing user sessions
export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize storage connection
  await storage.connect();
  console.log(`Database connected to: ${storage.db.databaseName}`);

  // Session configuration with MongoDB store
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key-here",
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: "riseupcreator",
        collectionName: "sessions",
        ttl: 24 * 60 * 60, // 24 hours in seconds
        autoRemove: "native", // Let MongoDB handle TTL
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Public contact information endpoint
  app.get("/api/contact-info", async (req, res) => {
    try {
      const contactSettings = await storage.db.collection("system_settings").findOne({ type: "contact_info" });
      
      const contactInfo = {
        supportEmail: contactSettings?.supportEmail || "support@riseup.com",
        supportPhone: contactSettings?.supportPhone || "+91 9876543210",
        customerServiceHours: contactSettings?.customerServiceHours || "9 AM - 6 PM (Mon-Fri)",
        whatsappNumber: contactSettings?.whatsappNumber || "",
        telegramUsername: contactSettings?.telegramUsername || ""
      };

      res.json(contactInfo);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact/submit", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Get admin email from contact settings or use default
      const contactSettings = await storage.db.collection("system_settings").findOne({ type: "contact_info" });
      const adminEmail = contactSettings?.supportEmail || "Riseupcreators7@gmail.com";

      // Import sendEmail function
      const { sendEmail } = await import("./services/email");

      // Send email to admin
      const adminEmailHTML = `
        <div style="background: #f8f9fa; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #FF3C2A; margin-bottom: 20px; border-bottom: 2px solid #FF3C2A; padding-bottom: 10px;">
              New Contact Form Submission
            </h1>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0;">Contact Details:</h3>
              <p style="margin: 8px 0;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0;"><strong>Subject:</strong> ${subject}</p>
            </div>
            
            <div style="background: #fff; border: 1px solid #e9ecef; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0;">Message:</h3>
              <p style="line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #0066cc;">
              <p style="margin: 0; color: #004085; font-size: 14px;">
                <strong>Action Required:</strong> Please respond to this inquiry at your earliest convenience.
                You can reply directly to this email to reach the customer.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">
              This message was sent from the Rise Up Creators contact form.<br>
              Sent on: ${new Date().toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      `;

      // Send auto-reply to user
      const userEmailHTML = `
        <div style="background: #000; color: #fff; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto;">
            <h1 style="color: #FF3C2A; margin-bottom: 20px;">Thank You for Contacting Us!</h1>
            
            <p>Hi ${name},</p>
            
            <p>Thank you for reaching out to Rise Up Creators. We've received your message and will get back to you within 24 hours.</p>
            
            <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF3C2A;">
              <h3 style="color: #FF3C2A; margin: 0 0 10px 0;">Your Message Summary:</h3>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
              <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            
            <p>In the meantime, you can explore our platform or check out our FAQ section for immediate answers to common questions.</p>
            
            <p>Best regards,<br>
            <strong>The Rise Up Creators Support Team</strong></p>
            
            <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
            <p style="color: #888; font-size: 12px; margin: 0;">
              This is an automated response. Please do not reply to this email directly.
              If you need immediate assistance, call us at +91 9876543210.
            </p>
          </div>
        </div>
      `;

      // Send both emails
      await Promise.all([
        sendEmail(adminEmail, `New Contact Form: ${subject}`, adminEmailHTML, email), // Set user email as reply-to
        sendEmail(email, "Thank you for contacting Rise Up Creators", userEmailHTML)
      ]);

      // Store the contact submission in database for tracking
      await storage.db.collection("contact_submissions").insertOne({
        name,
        email,
        subject,
        message,
        submittedAt: new Date(),
        status: "new",
        adminNotified: true
      });

      res.json({ 
        message: "Message sent successfully! We'll get back to you within 24 hours.",
        success: true 
      });

    } catch (error) {
      console.error("Contact form submission error:", error);
      res.status(500).json({ 
        message: "Failed to send message. Please try again or contact us directly.",
        success: false 
      });
    }
  });

  // Setup all route modules
  setupAuthRoutes(app);
  setupUserRoutes(app);
  setupArtistRoutes(app);
  setupContentRoutes(app);
  setupCommerceRoutes(app);
  setupTicketRoutes(app);
  setupAdminRoutes(app);
  setupAdsRoutes(app);
  setupIntegrationRoutes(app);
  setupSearchRoutes(app);
  
  // Setup webhook routes (no auth middleware)
  app.use("/api/webhooks", webhookRoutes);

  const httpServer = createServer(app);
  return httpServer;
}

