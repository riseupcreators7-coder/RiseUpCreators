import { storage } from "../storage";

export class PlanLimitsController {
  private readonly planLimits = {
    bronze: {
      songsPerMonth: 5,
      blogPostsPerMonth: 3,
      eventsPerMonth: 2,
      merchItemsPerMonth: 10,
    },
    silver: {
      songsPerMonth: 15,
      blogPostsPerMonth: 10,
      eventsPerMonth: 5,
      merchItemsPerMonth: 25,
    },
    gold: {
      songsPerMonth: 50,
      blogPostsPerMonth: 30,
      eventsPerMonth: 15,
      merchItemsPerMonth: 100,
    },
    unlimited: {
      songsPerMonth: Infinity,
      blogPostsPerMonth: Infinity,
      eventsPerMonth: Infinity,
      merchItemsPerMonth: Infinity,
    },
  };

  async checkSongUploadLimit(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return false;

      const artist = await storage.getArtistByUserId(userId);
      if (!artist) return false;

      // Get user's plan (default to bronze if not specified)
      const plan = (user as any).plan || 'bronze';
      const limit = this.planLimits[plan as keyof typeof this.planLimits]?.songsPerMonth || this.planLimits.bronze.songsPerMonth;

      if (limit === Infinity) return true;

      // Count songs uploaded this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // This would need to be implemented in storage to count songs by date range
      // For now, return true to allow uploads
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkBlogPostLimit(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return false;

      const artist = await storage.getArtistByUserId(userId);
      if (!artist) return false;

      // Get user's plan (default to bronze if not specified)
      const plan = (user as any).plan || 'bronze';
      const limit = this.planLimits[plan as keyof typeof this.planLimits]?.blogPostsPerMonth || this.planLimits.bronze.blogPostsPerMonth;

      if (limit === Infinity) return true;

      // For now, return true to allow blog posts
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkEventCreationLimit(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return false;

      const artist = await storage.getArtistByUserId(userId);
      if (!artist) return false;

      // Get user's plan (default to bronze if not specified)
      const plan = (user as any).plan || 'bronze';
      const limit = this.planLimits[plan as keyof typeof this.planLimits]?.eventsPerMonth || this.planLimits.bronze.eventsPerMonth;

      if (limit === Infinity) return true;

      // For now, return true to allow event creation
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkMerchCreationLimit(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return false;

      const artist = await storage.getArtistByUserId(userId);
      if (!artist) return false;

      // Get user's plan (default to bronze if not specified)
      const plan = (user as any).plan || 'bronze';
      const limit = this.planLimits[plan as keyof typeof this.planLimits]?.merchItemsPerMonth || this.planLimits.bronze.merchItemsPerMonth;

      if (limit === Infinity) return true;

      // For now, return true to allow merch creation
      return true;
    } catch (error) {
      return false;
    }
  }

  getPlanLimits(plan: string) {
    return this.planLimits[plan as keyof typeof this.planLimits] || this.planLimits.bronze;
  }
}
