import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || "your-secret-key-here") as jwt.JwtPayload;

    // Extract user info from token
    const userId = decoded.userId || decoded.id;
    const userEmail = decoded.email;
    const userRole = decoded.role;

    if (!userId || !userEmail || !userRole) {
      return res.status(403).json({ message: "Invalid token payload" });
    }

    // Verify user still exists in database (optional but recommended for security)
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ message: "User account not found" });
      }

      // Check if user account is still active
      if (user.email !== userEmail) {
        return res.status(403).json({ message: "Token email mismatch" });
      }

    } catch (dbError) {
      // Continue with token-only validation if DB check fails
    }

    // Set user info on request
    req.user = {
      id: userId,
      email: userEmail,
      role: userRole,
      name: decoded.name
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ message: "Token expired" });
    } else if (err instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ message: "Invalid token" });
    } else {
      return res.status(403).json({ message: "Token verification failed" });
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = req.user.role;
    const hasRequiredRole = roles.includes(userRole);

    if (!hasRequiredRole) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

