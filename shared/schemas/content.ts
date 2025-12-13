import { z } from "zod";
import { ObjectIdType } from "./common";

// -----------------------------
// Song Schema
// -----------------------------
export const songSchema = z.object({
  _id: ObjectIdType,
  artistId: ObjectIdType, // Reference to User (role=artist)
  artistName: z.string(), // Artist name for display
  title: z.string(),
  genre: z.string(),
  fileUrl: z.string(),
  artworkUrl: z.string(),
  durationSec: z.number(),
  plays: z.number().default(0),
  uniqueListeners: z.number().default(0),
  likes: z.number().default(0),
  shares: z.number().default(0),
  reviews: z.array(z.object({
    userId: ObjectIdType,  // Reference to User
    rating: z.number().min(1).max(5),
    comment: z.string(),
    createdAt: z.date()
  })).default([]),
  visibility: z.enum(["PUBLIC", "SUBSCRIBER_ONLY"]).default("PUBLIC"),
  adEnabled: z.boolean().default(true),
  createdAt: z.date().default(() => new Date())
});

export const insertSongSchema = songSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// Merch Schema
// -----------------------------
export const merchSchema = z.object({
  _id: ObjectIdType,
  artistId: ObjectIdType,  // Reference to User (role=artist)
  artistName: z.string().optional(), // Store artist name for easy retrieval
  name: z.string(),
  description: z.string(),
  price: z.number(),
  stock: z.number(),
  images: z.array(z.string()),
  category: z.string().optional(),
  sizes: z.array(z.string()).optional(), // Available sizes (S, M, L, XL, etc.)
  colors: z.array(z.string()).optional(), // Available colors
  orders: z.array(ObjectIdType).default([]),  // Reference to Order
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertMerchSchema = merchSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// Event Schema
// -----------------------------
export const eventSchema = z.object({
  _id: ObjectIdType,
  artistId: ObjectIdType,  // Reference to User (role=artist)
  title: z.string(),
  description: z.string(),
  date: z.date(),
  location: z.string(),
  venue: z.string().optional(),
  onlineUrl: z.string().optional(),
  ticketPrice: z.number(),
  maxTickets: z.number().default(100), // Maximum ticket capacity
  ticketsSold: z.number().default(0),  // Number of tickets sold
  imageUrl: z.string().optional(),
  attendees: z.array(ObjectIdType).default([]),  // Reference to User
  type: z.enum(["LIVE", "ONLINE", "HYBRID"]).default("LIVE"),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date())
});

export const insertEventSchema = eventSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// Ticket Schema
// -----------------------------
export const ticketSchema = z.object({
  _id: ObjectIdType,
  orderId: ObjectIdType,    // Reference to Order
  eventId: ObjectIdType,    // Reference to Event
  userId: ObjectIdType,     // Reference to User (ticket holder)
  ticketNumber: z.string(), // Unique ticket number (e.g., TKT-20241004-001)
  qrCode: z.string(),       // QR code data
  qrSignature: z.string(),  // HMAC signature for verification
  status: z.enum(["VALID", "USED", "CANCELLED", "EXPIRED"]).default("VALID"),
  checkedInAt: z.date().optional(),
  checkedInBy: ObjectIdType.optional(), // Reference to User (organizer who scanned)
  seatInfo: z.object({
    section: z.string().optional(),
    row: z.string().optional(),
    seat: z.string().optional()
  }).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional()
});

export const insertTicketSchema = ticketSchema.omit({ _id: true, createdAt: true });

// -----------------------------
// Blog Schema
// -----------------------------
export const blogSchema = z.object({
  _id: ObjectIdType,
  artistId: ObjectIdType,  // Reference to User (role=artist)
  title: z.string(),
  content: z.string(),
  visibility: z.enum(["PUBLIC", "SUBSCRIBER_ONLY"]).default("PUBLIC"),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const insertBlogSchema = blogSchema.omit({ _id: true, createdAt: true, updatedAt: true });

// -----------------------------
// Type Exports
// -----------------------------
export type Song = z.infer<typeof songSchema>;
export type InsertSong = z.infer<typeof insertSongSchema>;
export type Merch = z.infer<typeof merchSchema>;
export type InsertMerch = z.infer<typeof insertMerchSchema>;
export type Event = z.infer<typeof eventSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Blog = z.infer<typeof blogSchema>;
export type InsertBlog = z.infer<typeof insertBlogSchema>;
