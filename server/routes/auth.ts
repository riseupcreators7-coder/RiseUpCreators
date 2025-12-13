import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/email";
import { AuthRequest, authenticateToken } from "../middleware/auth";

export function setupAuthRoutes(app: Express) {
  // Store reset tokens temporarily (in production, use Redis or database)
  const resetTokens = new Map<string, { email: string; expires: Date }>();

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      // Check system settings first
      const systemSettings = await storage.getSystemSettings();
      if (systemSettings?.registrationOpen === false) {
        return res.status(403).json({ 
          message: "Registration is currently disabled by administrators" 
        });
      }

      // Hash the password from request
      const { password, ...userDataWithoutPassword } = req.body;
      
      // Normalize email to lowercase and trim whitespace
      if (userDataWithoutPassword.email) {
        userDataWithoutPassword.email = userDataWithoutPassword.email.toLowerCase().trim();
      }
      
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create user data with hashed password and default plan
      const userData = {
        ...userDataWithoutPassword,
        passwordHash,
        role: userDataWithoutPassword.role || "fan", // Default to fan if no role provided
        plan: userDataWithoutPassword.plan || { type: "FREE" } // Ensure all new users have a plan
      };

      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await storage.createUser(userData);

      // Update user with embedded artist data if role is artist
      if (user.role === "artist") {
        await storage.updateUser(user._id, {
          artist: {
            bio: "",
            socialLinks: {},
            followers: [],
            totalPlays: 0,
            totalLikes: 0,
            revenue: { subscriptions: 0, merch: 0, events: 0, ads: 0 },
            trendingScore: 0,
            featured: false,
            verified: false,
          }
        });
      }

      // Send welcome email (non-blocking)
      sendWelcomeEmail(user.email, user.name, user.role).catch((error) => {
        
      });

      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, name: user.name },
        process.env.SESSION_SECRET || "your-secret-key-here",
        { expiresIn: "24h" },
      );

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          favorites: user.favorites,
          following: user.following,
          avatarUrl: user.avatarUrl,
        },
        token,
      });
    } catch (error: any) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      let { email, password } = req.body;

      // Normalize email to lowercase and trim whitespace
      email = email?.toLowerCase().trim();

      // Enhanced request logging for debugging
      console.log('🔐 Login attempt:', {
        email: email?.substring(0, 5) + '***',
        hasPassword: !!password,
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        ip: req.ip
      });

      if (!email || !password) {
        console.log('❌ Missing credentials');
        return res.status(400).json({ message: "Email and password are required" });
      }

      let user = await storage.getUserByEmail(email);
      
      // Special case: Create admin user if it doesn't exist and credentials match
      if (!user && email.toLowerCase() === 'riseupcreators7@gmail.com' && password === 'hello1234') {
        console.log('🔧 Creating admin user...');
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
          user = await storage.createUser({
            name: 'Rise Up Admin',
            email: email.toLowerCase(),
            passwordHash: hashedPassword,
            role: 'admin',
            plan: { type: 'ADMIN' },
            favorites: [],
            following: [],
          });
          console.log('✅ Admin user created successfully');
        } catch (createError) {
          console.error('❌ Failed to create admin user:', createError);
          return res.status(500).json({ message: "Failed to create admin account" });
        }
      }
      
      if (!user) {
        console.log('❌ User not found for email:', email?.substring(0, 5) + '***');
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is banned
      if (user.banned) {
        const banMessage = user.banReason 
          ? `Your account has been banned: ${user.banReason}. Please contact support at Riseupcreators7@gmail.com for assistance.`
          : "Your account has been banned from the platform. Please contact support at Riseupcreators7@gmail.com for assistance.";
        
        return res.status(403).json({ 
          message: banMessage,
          banned: true,
          banReason: user.banReason,
          supportEmail: "Riseupcreators7@gmail.com"
        });
      }

      // Check if user has a temporary ban that has expired
      if (user.banUntil && new Date() > user.banUntil) {
        // Automatically unban if temporary ban has expired
        await storage.updateUser(user._id, {
          banned: false,
          banReason: null,
          banUntil: null,
          bannedAt: null,
          bannedBy: null,
          unbannedAt: new Date(),
          unbannedBy: "system"
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        console.log('❌ Invalid password for user:', email?.substring(0, 5) + '***');
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login
      await storage.updateUser(user._id, { lastLogin: new Date() });

      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role, name: user.name },
        process.env.SESSION_SECRET || "your-secret-key-here",
        { expiresIn: "24h" },
      );

      console.log('✅ Login successful for user:', {
        email: email?.substring(0, 5) + '***',
        role: user.role,
        name: user.name?.substring(0, 5) + '***'
      });

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          favorites: user.favorites,
          following: user.following,
          avatarUrl: user.avatarUrl,
        },
        token,
      });
    } catch (error) {
      console.error('🔥 Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      let { email } = req.body;
      
      // Normalize email to lowercase and trim whitespace
      email = email?.toLowerCase().trim();
      
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate reset token (6-digit code)
      const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store token with expiration
      resetTokens.set(resetToken, { email: user.email, expires });

      // Clean up expired tokens
      for (const [token, data] of Array.from(resetTokens.entries())) {
        if (data.expires < new Date()) {
          resetTokens.delete(token);
        }
      }

      sendPasswordResetEmail(user.email, resetToken).catch((error) => {
        
      });

      res.json({ message: "Password reset email sent" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Validate password strength
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      // Check if token exists and is valid
      const tokenData = resetTokens.get(token);
      if (!tokenData) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token has expired
      if (tokenData.expires < new Date()) {
        resetTokens.delete(token);
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Get user by email
      const user = await storage.getUserByEmail(tokenData.email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user._id, { passwordHash: hashedPassword });

      // Remove used token
      resetTokens.delete(token);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isValidPassword) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.user.id, {
        passwordHash: hashedNewPassword,
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint to clear server-side session
  app.post("/api/auth/logout", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Clear the session
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            
          }
        });
      }

      // Clear the session cookie
      res.clearCookie('connect.sid');
      
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

