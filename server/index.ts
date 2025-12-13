import "dotenv/config";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { configureCloudinary } from "./services/cloudinary";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for development
    crossOriginEmbedderPolicy: false,
  })
);

// Enable trust proxy for rate limiting in Replit environment
app.set("trust proxy", 1);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            process.env.CLIENT_URL || "https://riseupcreators.com",
            "https://riseupcreators.com",
            "https://www.riseupcreators.com",
            "http://riseupcreators.com",
            "http://www.riseupcreators.com"
          ].filter(Boolean)
        : ["http://localhost:5173", "http://localhost:5000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware - log all API requests cleanly
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Rate limiting for API endpoints - More permissive for normal app usage
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200, // limit each IP to 200 requests per minute (allows rapid UI loading)
  message: { 
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use("/api", limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // increased from 10 to 50 for better user experience
  message: { 
    error: "Too many authentication attempts, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth", authLimiter);

// Special rate limiter for admin endpoints - Even more permissive
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 300, // Higher limit for admin operations
  message: { 
    error: "Too many admin requests, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/admin", adminLimiter);

// Analytics endpoints need high throughput
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 500, // High limit for analytics tracking
  message: { 
    error: "Analytics rate limit exceeded, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/analytics", analyticsLimiter);
app.use("/api/ads/analytics", analyticsLimiter);

// Ads-specific rate limiter for tracking endpoints
const adsTrackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // Allow 100 ad tracking calls per minute per IP
  message: { 
    error: "Too many ad tracking requests, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/ads/impressions", adsTrackingLimiter);
app.use("/api/ads/clicks", adsTrackingLimiter);

// General ads endpoint limiter
const adsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 150, // Higher limit for ads fetching
  message: { 
    error: "Too many ad requests, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/ads", adsLimiter);

(async () => {
  // Initialize Cloudinary after env vars are loaded
  configureCloudinary();

  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Error ${status}: ${message}`);

    res.status(status).json({
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  });

  // Setup Vite in development or serve static files in production
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start the server
  const port = parseInt(process.env.PORT || "5000", 10);

  server.listen(port, "0.0.0.0", () => {
    console.log(`App is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Server ready at http://localhost:${port}`);
  });
})();

