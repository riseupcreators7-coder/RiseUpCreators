import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface ArtistAnalytics {
  monthlyRevenue: number;
  subscriptionRevenue: number;
  merchRevenue: number;
  eventRevenue: number;
  totalPlays: number;
  uniqueListeners: number;
  totalLikes: number;
  newFollowers: number;
  newSubscribers: number;
  topSongs: any[];
}

export function useArtistAnalytics() {
  const { user } = useAuth();
  
  return useQuery<ArtistAnalytics>({
    queryKey: ["artistAnalytics"],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/artists/analytics", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Artist role required.");
        }
        if (response.status === 401) {
          throw new Error("Authentication required");
        }
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !!user && user.role === "artist",
    refetchInterval: 300000, // Reduced frequency to 5 minutes
    staleTime: 120000, // Data considered stale after 2 minutes
    retry: (failureCount, error) => {
      // Don't retry authentication errors
      if (error.message.includes("authentication") || error.message.includes("401")) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 10000, // Wait 10 seconds before retry
  });
}