// Utility functions for testing ad functionality in development

export const AdTestingUtils = {
  // Get current daily ad tracking data from localStorage
  getDailyAdTracking(): Record<string, number> {
    try {
      const stored = localStorage.getItem('ruc_daily_ad_tracking');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get daily ad tracking:', error);
      return {};
    }
  },

  // Manually set ad play count for testing
  setAdPlayCount(adId: string, count: number): void {
    try {
      const current = this.getDailyAdTracking();
      current[adId] = count;
      localStorage.setItem('ruc_daily_ad_tracking', JSON.stringify(current));
      // Set ad play count
    } catch (error) {
      // Failed to set ad play count
    }
  },

  // Reset daily ad tracking (simulate new day)
  resetDailyTracking(): void {
    try {
      localStorage.setItem('ruc_daily_ad_tracking', JSON.stringify({}));
      localStorage.setItem('ruc_daily_reset', Date.now().toString());
      // Reset daily ad tracking
    } catch (error) {
      // Failed to get daily ad tracking
    }
  },

  // Simulate ad at daily limit (3 plays)
  simulateAdAtLimit(adId: string): void {
    this.setAdPlayCount(adId, 3);
  },

  // Get reset timestamp
  getLastResetTime(): number {
    try {
      const stored = localStorage.getItem('ruc_daily_reset');
      return stored ? parseInt(stored) : 0;
    } catch (error) {
      return 0;
    }
  },

  // Log current state for debugging
  logCurrentState(): void {
    // Debug tracking info - disabled for production
  }
};

// Make available globally for debugging in browser console
(window as any).AdTestingUtils = AdTestingUtils;

export default AdTestingUtils;