/**
 * NFT Utility Functions
 * Helper functions for NFT marketplace operations
 */

/**
 * Convert wei to ETH
 * @param wei - Amount in wei (string)
 * @returns Formatted ETH string
 */
export function weiToEth(wei: string): string {
  try {
    const eth = parseFloat(wei) / 1e18;
    return eth.toFixed(4);
  } catch {
    return "0.0000";
  }
}

/**
 * Convert ETH to wei
 * @param eth - Amount in ETH (number or string)
 * @returns Wei as string
 */
export function ethToWei(eth: number | string): string {
  try {
    const ethNum = typeof eth === "string" ? parseFloat(eth) : eth;
    return (ethNum * 1e18).toString();
  } catch {
    return "0";
  }
}

/**
 * Format price for display
 * @param wei - Price in wei
 * @returns Formatted price string with ETH symbol
 */
export function formatNFTPrice(wei: string): string {
  return `${weiToEth(wei)} ETH`;
}

/**
 * Shorten wallet address
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Shortened address
 */
export function shortenAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address || address.length < startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Convert seconds to human-readable duration
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Calculate time remaining until end time
 * @param endTime - End time as Date or string
 * @returns Formatted time remaining or "Ended"
 */
export function getTimeRemaining(endTime: Date | string): string {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (diff <= 0) return "Ended";

  const seconds = Math.floor(diff / 1000);
  return formatDuration(seconds);
}

/**
 * Validate Ethereum address
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Convert basis points to percentage
 * @param bps - Basis points (e.g., 500 = 5%)
 * @returns Percentage as number
 */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Convert percentage to basis points
 * @param percent - Percentage (e.g., 5 = 500 bps)
 * @returns Basis points as number
 */
export function percentToBps(percent: number): number {
  return percent * 100;
}

/**
 * Format royalty for display
 * @param bps - Royalty in basis points
 * @returns Formatted royalty string
 */
export function formatRoyalty(bps: number): string {
  return `${bpsToPercent(bps)}%`;
}

/**
 * Common durations in seconds
 */
export const AUCTION_DURATIONS = {
  ONE_HOUR: 3600,
  SIX_HOURS: 21600,
  TWELVE_HOURS: 43200,
  ONE_DAY: 86400,
  THREE_DAYS: 259200,
  ONE_WEEK: 604800,
} as const;

/**
 * NFT Type enum
 */
export enum NFTType {
  STANDARD = 0,
  PREMIUM = 1,
  EXCLUSIVE = 2,
  LIMITED = 3,
}

/**
 * Auction status enum
 */
export enum AuctionStatus {
  ACTIVE = "active",
  ENDED = "ended",
  CLAIMED = "claimed",
}
