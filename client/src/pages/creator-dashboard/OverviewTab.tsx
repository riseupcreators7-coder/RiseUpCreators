import { useLocation } from "wouter";
import {
  Upload, Music, Calendar, ShoppingBag,
  DollarSign, Users, Heart, Play, BookOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import type { ArtistProfile, Analytics } from "./types";
import { createSafeArtistProfile, createSafeAnalytics, getCreatorAuthHeaders } from "./utils";

// ---------- COMPONENT ----------
export default function OverviewTab() {
  const auth = useRequireRole("artist");
  const [, setLocation] = useLocation();

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
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
    staleTime: 0, // Always fetch fresh data
  });



  // ---------- SAFE DEFAULTS ----------
  const safeArtistProfile = createSafeArtistProfile(artistProfile, auth.user);
  const safeAnalytics = createSafeAnalytics(analytics);



  return (
    <TabsContent value="overview">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {/* Earnings */}
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(safeAnalytics.merchRevenue + safeAnalytics.eventRevenue + safeAnalytics.subscriptionRevenue + safeArtistProfile.revenue.ads).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All earnings from events, merch & artist subscriptions</p>
          </CardContent>
        </Card>

        {/* Streams */}
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.totalPlays?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {safeAnalytics.totalPlays > safeArtistProfile.totalPlays ? '+' : ''}
              {Math.round(((safeAnalytics.totalPlays - safeArtistProfile.totalPlays) / Math.max(safeArtistProfile.totalPlays, 1)) * 100)}% from last period
            </p>
          </CardContent>
        </Card>

        {/* Followers */}
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Followers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeArtistProfile.followers.length?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{safeAnalytics.newFollowers || 0} this period
            </p>
          </CardContent>
        </Card>

        {/* Likes */}
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.totalLikes?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{Math.max(0, (safeAnalytics.totalLikes || 0) - safeArtistProfile.totalLikes)} new likes
            </p>
          </CardContent>
        </Card>


      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card onClick={() => setLocation("/creator/upload")} className="cursor-pointer hover-glow">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <Upload className="w-10 h-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold">Upload Music</h3>
            <p className="text-sm text-muted-foreground">Share your tracks with fans</p>
          </CardContent>
        </Card>

        <Card onClick={() => setLocation("/creator/merch")} className="cursor-pointer hover-glow">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <ShoppingBag className="w-10 h-10 text-orange-500 mb-3" />
            <h3 className="text-lg font-semibold">Add Merchandise</h3>
            <p className="text-sm text-muted-foreground">Sell branded products</p>
          </CardContent>
        </Card>

        <Card onClick={() => setLocation("/creator/events")} className="cursor-pointer hover-glow">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <Calendar className="w-10 h-10 text-secondary mb-3" />
            <h3 className="text-lg font-semibold">Create Event</h3>
            <p className="text-sm text-muted-foreground">Schedule concerts & shows</p>
          </CardContent>
        </Card>

        <Card onClick={() => setLocation("/creator?tab=blogs")} className="cursor-pointer hover-glow">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <BookOpen className="w-10 h-10 text-accent mb-3" />
            <h3 className="text-lg font-semibold">Write Blog</h3>
            <p className="text-sm text-muted-foreground">Share stories with fans</p>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
