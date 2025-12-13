import QRCode from 'qrcode';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

const QR_SECRET = process.env.QR_SECRET || 'riseup-qr-secret-key-2024';

export interface TicketQRData {
  ticketId: string;
  eventId: string;
  userId: string;
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  signature: string;
}

export interface QRVerificationResult {
  valid: boolean;
  status: 'VALID' | 'INVALID' | 'USED' | 'EXPIRED' | 'EVENT_ENDED';
  message: string;
  ticketData?: TicketQRData;
  ticketDetails?: {
    ticketNumber: string;
    eventTitle: string;
    eventDate: string;
    venue: string;
    holderName: string;
    checkedInAt?: string;
  };
}

/**
 * Generate HMAC signature for ticket data
 */
export const generateTicketSignature = (ticketId: string, eventId: string, userId: string): string => {
  const data = `${ticketId}|${eventId}|${userId}`;
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex');
};

/**
 * Verify ticket signature
 */
export const verifyTicketSignature = (ticketId: string, eventId: string, userId: string, signature: string): boolean => {
  const expectedSignature = generateTicketSignature(ticketId, eventId, userId);
  return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signature, 'hex'));
};

/**
 * Generate QR code for a ticket
 */
export const generateTicketQR = async (ticketData: Omit<TicketQRData, 'signature'>): Promise<string> => {
  try {
    // Generate signature
    const signature = generateTicketSignature(ticketData.ticketId, ticketData.eventId, ticketData.userId);
    
    const qrData: TicketQRData = {
      ...ticketData,
      signature
    };

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });

    return qrCodeDataURL;
  } catch (error) {
    
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Parse and verify QR code data
 */
export const parseQRCode = (qrCodeData: string): { valid: boolean; data?: TicketQRData; error?: string } => {
  try {
    const parsedData = JSON.parse(qrCodeData) as TicketQRData;
    
    // Validate required fields
    const requiredFields = ['ticketId', 'eventId', 'userId', 'ticketNumber', 'signature'];
    for (const field of requiredFields) {
      if (!parsedData[field as keyof TicketQRData]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    // Verify signature
    const isValidSignature = verifyTicketSignature(
      parsedData.ticketId,
      parsedData.eventId, 
      parsedData.userId,
      parsedData.signature
    );

    if (!isValidSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, data: parsedData };
  } catch (error) {
    return { valid: false, error: 'Invalid QR code format' };
  }
};

/**
 * Generate unique ticket number
 */
export const generateTicketNumber = (eventId: string, ticketIndex: number): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const eventPrefix = eventId.slice(-4).toUpperCase();
  const paddedIndex = ticketIndex.toString().padStart(3, '0');
  return `TKT-${date}-${eventPrefix}-${paddedIndex}`;
};

/**
 * Generate QR code for event URL sharing
 */
export const generateEventQR = async (eventId: string, eventTitle: string): Promise<string> => {
  try {
    const eventUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/events/${eventId}`;
    
    const qrCodeDataURL = await QRCode.toDataURL(eventUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#FF3C2A', // Brand color
        light: '#FFFFFF'
      },
      width: 200
    });

    return qrCodeDataURL;
  } catch (error) {
    
    throw new Error('Failed to generate event QR code');
  }
};

export default {
  generateTicketQR,
  generateTicketSignature,
  verifyTicketSignature,
  parseQRCode,
  generateTicketNumber,
  generateEventQR
};

