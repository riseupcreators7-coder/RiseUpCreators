import type { Express } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { ShiprocketService } from "../services/shiprocket";

/**
 * Integrations Routes
 * Handles Shiprocket integration endpoints
 */
export function setupIntegrationRoutes(app: Express) {

  // ====================
  // INTEGRATION STATUS
  // ====================

  /**
   * Get integration status
   * GET /api/integrations/status
   */
  app.get("/api/integrations/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const shiprocketConfigured = !!process.env.SHIPROCKET_API_TOKEN;

      res.json({
        message: "Integration status retrieved",
        integrations: {
          shiprocket: {
            configured: shiprocketConfigured,
            status: shiprocketConfigured ? "active" : "not_configured",
            requiredEnvVars: [
              "SHIPROCKET_API_TOKEN",
              "SHIPROCKET_CHANNEL_ID"
            ]
          }
        }
      });

    } catch (error: any) {
      
      res.status(500).json({
        message: error.message || "Failed to get integration status"
      });
    }
  });

  // Development-only health check for Shiprocket
  app.get("/api/integrations/shiprocket/health", authenticateToken, async (_req: AuthRequest, res) => {
    try {
      if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({ message: "Health check available only in development" });
      }

      const result = await ShiprocketService.healthCheck();
      res.json({ message: "Shiprocket health", ...result });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Health check failed" });
    }
  });
}

export default setupIntegrationRoutes;


