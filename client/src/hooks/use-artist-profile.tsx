import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

interface ArtistProfile {
  _id: string;
  name: string;
  bio: string;
  location: string;
  genre: string[];
  socialLinks: Record<string, string>;
  followers: string[];
  verified: boolean;
  artist?: {
    revenue: {
      subscriptions: number;
      merch: number;
      events: number;
      ads: number;
    };
    subscribers: string[];
    plans: any[];
  };
}

export function useArtistProfile() {
  const { user } = useAuth();
  
  return useQuery<ArtistProfile>({
    queryKey: ["artistProfile"],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/artists/profile", {
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
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !!user && user.role === "artist",
    refetchInterval: 300000, // Refetch every 5 minutes
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