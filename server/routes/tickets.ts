import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { parseQRCode } from "../services/qr";
import { ObjectId } from "mongodb";

export function setupTicketRoutes(app: Express) {
  
  // ========================================
  // TICKET VERIFICATION
  // ========================================

  /**
   * Verify QR Code - Public endpoint for organizers
   * POST /api/tickets/verify
   */
  app.post("/api/tickets/verify", async (req, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ 
          valid: false,
          status: 'INVALID',
          message: 'QR code data is required'
        });
      }

      // Parse QR code
      const parseResult = parseQRCode(qrData);
      if (!parseResult.valid || !parseResult.data) {
        return res.status(400).json({
          valid: false,
          status: 'INVALID',
          message: parseResult.error || 'Invalid QR code format'
        });
      }

      const ticketQRData = parseResult.data;

      // Get ticket from database
      const ticket = await storage.getTicket(ticketQRData.ticketId);
      if (!ticket) {
        return res.status(404).json({
          valid: false,
          status: 'INVALID',
          message: 'Ticket not found'
        });
      }

      // Get event details
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({
          valid: false,
          status: 'INVALID',
          message: 'Event not found'
        });
      }

      // Get user details
      const user = await storage.getUser(ticket.userId);
      if (!user) {
        return res.status(404).json({
          valid: false,
          status: 'INVALID',
          message: 'Ticket holder not found'
        });
      }

      // Check if event has ended
      const eventDate = new Date(event.date);
      const now = new Date();
      const eventEndTime = new Date(eventDate.getTime() + (4 * 60 * 60 * 1000)); // Assume 4 hour duration

      if (now > eventEndTime) {
        return res.status(400).json({
          valid: false,
          status: 'EVENT_ENDED',
          message: 'Event has ended',
          ticketDetails: {
            ticketNumber: ticket.ticketNumber,
            eventTitle: event.title,
            eventDate: event.date.toISOString(),
            venue: event.location,
            holderName: user.name,
            checkedInAt: ticket.checkedInAt?.toISOString()
          }
        });
      }

      // Check ticket status
      if (ticket.status === 'USED') {
        return res.status(400).json({
          valid: false,
          status: 'USED',
          message: 'Ticket has already been used',
          ticketDetails: {
            ticketNumber: ticket.ticketNumber,
            eventTitle: event.title,
            eventDate: event.date.toISOString(),
            venue: event.location,
            holderName: user.name,
            checkedInAt: ticket.checkedInAt?.toISOString()
          }
        });
      }

      if (ticket.status === 'CANCELLED') {
        return res.status(400).json({
          valid: false,
          status: 'INVALID',
          message: 'Ticket has been cancelled'
        });
      }

      if (ticket.status === 'EXPIRED') {
        return res.status(400).json({
          valid: false,
          status: 'EXPIRED',
          message: 'Ticket has expired'
        });
      }

      // Ticket is valid
      return res.json({
        valid: true,
        status: 'VALID',
        message: 'Valid ticket',
        ticketData: ticketQRData,
        ticketDetails: {
          ticketNumber: ticket.ticketNumber,
          eventTitle: event.title,
          eventDate: event.date.toISOString(),
          venue: event.location,
          holderName: user.name
        }
      });

    } catch (error) {
      
      res.status(500).json({
        valid: false,
        status: 'INVALID',
        message: 'Verification service error'
      });
    }
  });

  /**
   * Check-in ticket - Requires authentication
   * POST /api/tickets/checkin
   */
  app.post("/api/tickets/checkin", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      const { qrData } = req.body;
      const organizerId = req.user!.id;

      if (!qrData) {
        return res.status(400).json({ 
          success: false,
          message: 'QR code data is required'
        });
      }

      // First verify the ticket
      const verifyResponse = await fetch(`${req.protocol}://${req.get('host')}/api/tickets/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData })
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.valid) {
        return res.status(400).json({
          success: false,
          message: verifyResult.message,
          status: verifyResult.status
        });
      }

      // Parse QR data to get ticket ID
      const parseResult = parseQRCode(qrData);
      if (!parseResult.valid || !parseResult.data) {
        return res.status(400).json({
          success: false,
          message: 'Invalid QR code'
        });
      }

      const ticketId = parseResult.data.ticketId;

      // Check in the ticket
      const updatedTicket = await storage.checkInTicket(ticketId, organizerId);
      if (!updatedTicket) {
        return res.status(500).json({
          success: false,
          message: 'Failed to check in ticket'
        });
      }

      res.json({
        success: true,
        message: 'Ticket checked in successfully',
        ticket: {
          ticketNumber: updatedTicket.ticketNumber,
          checkedInAt: updatedTicket.checkedInAt,
          status: updatedTicket.status
        },
        ticketDetails: verifyResult.ticketDetails
      });

    } catch (error) {
      
      res.status(500).json({
        success: false,
        message: 'Check-in service error'
      });
    }
  });

  // ========================================
  // TICKET MANAGEMENT
  // ========================================

  /**
   * Get tickets for an event (organizer only)
   * GET /api/tickets/event/:eventId
   */
  app.get("/api/tickets/event/:eventId", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      
      // Verify event ownership for artists
      if (req.user!.role === "artist") {
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }

        const artist = await storage.getArtistByUserId(req.user!.id);
        if (!artist || event.artistId !== artist._id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const tickets = await storage.getTicketsByEvent(eventId);
      
      // Get user details for each ticket
      const ticketsWithUsers = await Promise.all(
        tickets.map(async (ticket) => {
          const user = await storage.getUser(ticket.userId);
          return {
            ...ticket,
            holderName: user?.name || 'Unknown',
            holderEmail: user?.email || 'Unknown'
          };
        })
      );

      res.json(ticketsWithUsers);
    } catch (error) {
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Get ticket statistics for an event
   * GET /api/tickets/event/:eventId/stats
   */
  app.get("/api/tickets/event/:eventId/stats", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      
      // Verify event ownership for artists
      if (req.user!.role === "artist") {
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }

        const artist = await storage.getArtistByUserId(req.user!.id);
        if (!artist || event.artistId !== artist._id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const stats = await storage.getEventTicketStats(eventId);
      res.json(stats);
    } catch (error) {
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Get user's tickets
   * GET /api/tickets/my
   */
  app.get("/api/tickets/my", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const tickets = await storage.getTicketsByUser(userId);
      
      // Get event details for each ticket
      const ticketsWithEvents = await Promise.all(
        tickets.map(async (ticket) => {
          const event = await storage.getEvent(ticket.eventId);
          return {
            ...ticket,
            event: event ? {
              title: event.title,
              date: event.date,
              location: event.location,
              imageUrl: event.imageUrl
            } : null
          };
        })
      );

      res.json(ticketsWithEvents);
    } catch (error) {
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * Download attendee list (CSV)
   * GET /api/tickets/event/:eventId/attendees/download
   */
  app.get("/api/tickets/event/:eventId/attendees/download", authenticateToken, requireRole(["artist", "admin"]), async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      
      // Verify event ownership for artists
      if (req.user!.role === "artist") {
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: 'Event not found' });
        }

        const artist = await storage.getArtistByUserId(req.user!.id);
        if (!artist || event.artistId !== artist._id) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }

      const tickets = await storage.getTicketsByEvent(eventId);
      const event = await storage.getEvent(eventId);
      
      // Create CSV content
      const csvHeader = 'Ticket Number,Holder Name,Holder Email,Status,Check-in Time,Purchase Date\n';
      const csvRows = await Promise.all(
        tickets.map(async (ticket) => {
          const user = await storage.getUser(ticket.userId);
          return [
            ticket.ticketNumber,
            user?.name || 'Unknown',
            user?.email || 'Unknown',
            ticket.status,
            ticket.checkedInAt ? ticket.checkedInAt.toISOString() : '',
            ticket.createdAt.toISOString()
          ].join(',');
        })
      );

      const csvContent = csvHeader + csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendees-${event?.title?.replace(/[^a-zA-Z0-9]/g, '-')}-${eventId}.csv"`);
      res.send(csvContent);

    } catch (error) {
      
      res.status(500).json({ message: 'Internal server error' });
    }
  });

}

