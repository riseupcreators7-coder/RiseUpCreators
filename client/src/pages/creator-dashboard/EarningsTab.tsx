import React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { useRequireRole } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import CreatorEarnings from "@/components/creator-dashboard/creator-earnings";
import { createSafeArtistProfile, createSafeAnalytics, getCreatorAuthHeaders } from "./utils";

export default function EarningsTab() {
  const auth = useRequireRole("artist");

  // ---------- QUERIES ----------
  const { data: artistProfile } = useQuery({
    queryKey: ["artistProfile"],
    queryFn: () => fetch("/api/artists/profile", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
  });

  const { data: analytics } = useQuery({
    queryKey: ["artistAnalytics"],
    queryFn: () => fetch("/api/artists/analytics", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
  });

  // ---------- SAFE DEFAULTS ----------
  const safeArtistProfile = createSafeArtistProfile(artistProfile, auth.user);
  const safeAnalytics = createSafeAnalytics(analytics);

  return (
    <TabsContent value="earnings">
      <CreatorEarnings 
        artistProfile={safeArtistProfile} 
        analytics={safeAnalytics} 
      />
    </TabsContent>
  );
}