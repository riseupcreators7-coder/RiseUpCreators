export const BANNER_PLACEMENTS = {
  HOME: 'HOME',
  DISCOVER: 'DISCOVER',
  PROFILE: 'PROFILE',
  PLAYER: 'PLAYER',
  SIDEBAR: 'SIDEBAR',
  SEARCH: 'SEARCH',
  PLAYLIST: 'PLAYLIST',
  MERCH: 'MERCH',
  EVENTS: 'EVENTS'
} as const;

export type BannerPlacement = typeof BANNER_PLACEMENTS[keyof typeof BANNER_PLACEMENTS];

// Map common variations to standardized placement keys
const PLACEMENT_ALIASES = {
  'homepage': BANNER_PLACEMENTS.HOME,
  'home-page': BANNER_PLACEMENTS.HOME,
  'home_page': BANNER_PLACEMENTS.HOME,
  'discover-page': BANNER_PLACEMENTS.DISCOVER,
  'discovery': BANNER_PLACEMENTS.DISCOVER,
  'artist-profile': BANNER_PLACEMENTS.PROFILE,
  'user-profile': BANNER_PLACEMENTS.PROFILE,
  'audio-player': BANNER_PLACEMENTS.PLAYER,
  'music-player': BANNER_PLACEMENTS.PLAYER,
  'side': BANNER_PLACEMENTS.SIDEBAR,
  'side-bar': BANNER_PLACEMENTS.SIDEBAR,
  'search-results': BANNER_PLACEMENTS.SEARCH,
  'playlists': BANNER_PLACEMENTS.PLAYLIST,
  'merchandise': BANNER_PLACEMENTS.MERCH,
  'shop': BANNER_PLACEMENTS.MERCH,
  'event': BANNER_PLACEMENTS.EVENTS
};

/**
 * Normalize ad placement strings to ensure consistent format
 * @param placement - The raw placement string to normalize
 * @returns Normalized placement string that matches BANNER_PLACEMENTS
 */
export function normalizeAdPlacement(placement: string): BannerPlacement {
  // First clean up the input
  const cleanPlacement = placement.trim().toLowerCase().replace(/[\s-_]+/g, '-');
  
  // Check if it's an alias first
  if (cleanPlacement in PLACEMENT_ALIASES) {
    return PLACEMENT_ALIASES[cleanPlacement as keyof typeof PLACEMENT_ALIASES];
  }
  
  // Convert to uppercase for direct matching
  const upperPlacement = cleanPlacement.toUpperCase().replace(/-/g, '_');
  
  // Handle specific common cases that might not match exactly
  const placementMappings: { [key: string]: BannerPlacement } = {
    'HOME': BANNER_PLACEMENTS.HOME,
    'HOMEPAGE': BANNER_PLACEMENTS.HOME,
    'HOME_PAGE': BANNER_PLACEMENTS.HOME,
    'BANNER_HOME': BANNER_PLACEMENTS.HOME,
    'DISCOVER': BANNER_PLACEMENTS.DISCOVER,
    'DISCOVERY': BANNER_PLACEMENTS.DISCOVER,
    'BANNER_DISCOVER': BANNER_PLACEMENTS.DISCOVER,
    'PROFILE': BANNER_PLACEMENTS.PROFILE,
    'PLAYER': BANNER_PLACEMENTS.PLAYER,
    'SIDEBAR': BANNER_PLACEMENTS.SIDEBAR,
    'SEARCH': BANNER_PLACEMENTS.SEARCH,
    'PLAYLIST': BANNER_PLACEMENTS.PLAYLIST,
    'MERCH': BANNER_PLACEMENTS.MERCH,
    'EVENTS': BANNER_PLACEMENTS.EVENTS
  };
  
  // Check direct mapping
  if (upperPlacement in placementMappings) {
    return placementMappings[upperPlacement];
  }
  
  // Validate it's a known placement (fallback check)
  if (upperPlacement in BANNER_PLACEMENTS) {
    return BANNER_PLACEMENTS[upperPlacement as keyof typeof BANNER_PLACEMENTS];
  }
  
  return BANNER_PLACEMENTS.HOME;
}
