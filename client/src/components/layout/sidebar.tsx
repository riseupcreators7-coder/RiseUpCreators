import { Link, useLocation } from "wouter";
import {
  Home, Compass, Calendar, ShoppingBag, Heart, ListMusic,
  Settings, User, BarChart3, Upload, PlusCircle, Crown, Megaphone, Zap,
  TrendingUp, TrendingDown, Users, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useArtistAnalytics } from "@/hooks/use-artist-analytics";
import { useArtistProfile } from "@/hooks/use-artist-profile";

// 🔑 Event Bus for cross-component communication
export const sidebarEventBus = {
  openEventModal: () => {},
  openMerchModal: () => {}
};

// Utility function to format numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Only fetch artist data if user is actually an artist
  const isArtist = user?.role === "artist";
  
  // Fetch real-time data for artists - ALWAYS call hooks, but conditionally enable
  const { data: artistAnalytics, isLoading: analyticsLoading, error: analyticsError } = useArtistAnalytics();
  const { data: artistProfile, isLoading: profileLoading, error: profileError } = useArtistProfile();
  
  // Early return AFTER all hooks are called
  if (!user || isMobile) return null;

  // Check if link is active
  const isActive = (path: string) => {
    if (path === "/creator" && location === "/creator") return true;
    if (path.includes("?tab=")) {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const pathTab = path.split('tab=')[1];
      return location.startsWith("/creator") && tabParam === pathTab;
    }
    return location === path || location.startsWith(path);
  };

  // Navigate helper
  const handleNav = (href: string) => {
    setLocation(href);
  };

  // Fan navigation
  const fanLinks = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/discover", icon: Compass, label: "Discover" },
    { href: "/events", icon: Calendar, label: "Events" },
    { href: "/merch", icon: ShoppingBag, label: "Merch" },
    { href: "/cart", icon: ShoppingBag, label: "Cart" },
  ];

  const fanSecondaryLinks = [
    { href: "/dashboard", icon: User, label: "Dashboard" },
    { href: "/playlists", icon: ListMusic, label: "Playlists" },
    { href: "/favorites", icon: Heart, label: "Favorites" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  // Artist navigation
  const artistLinks = [
    { href: "/creator", icon: BarChart3, label: "Creator Dashboard" },
    { href: "/favorites", icon: Heart, label: "Favorites" },
    { href: "/dashboard?tab=orders", icon: ShoppingBag, label: "Orders" },
    { href: "/playlists", icon: ListMusic, label: "Playlists" },
  ];

  // Admin navigation
  const adminLinks = [
    { href: "/admin", icon: BarChart3, label: "Admin Panel" },
    { href: "/admin?tab=artists", icon: User, label: "Artists" },
    { href: "/admin?tab=content", icon: ListMusic, label: "Content" },
    { href: "/admin?tab=analytics", icon: BarChart3, label: "Analytics" },
    { href: "/admin?tab=ads", icon: Megaphone, label: "Ad Management" },
  ];

  // Role-based nav
  const getLinks = () => {
    switch (user.role) {
      case "artist":
        return { primary: artistLinks, secondary: [] };
      case "admin":
        // Admin gets fan-like navigation plus admin panel
        const adminFanLinks = [
          { href: "/admin", icon: BarChart3, label: "Admin Panel" },
          ...fanLinks
        ];
        return { primary: adminFanLinks, secondary: fanSecondaryLinks };
      default:
        return { primary: fanLinks, secondary: fanSecondaryLinks };
    }
  };

  const { primary, secondary } = getLinks();
  
  return (
    <div className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-card border-r border-border z-30 overflow-y-auto">
      <div className="p-4 space-y-6">

        {/* Primary Navigation */}
        <nav className="space-y-2">
          {primary.map((link) => {
            const Icon = link.icon;
            return (
              <Button
                key={link.href}
                variant={isActive(link.href) ? "secondary" : "ghost"}
                className={`w-full justify-start ${
                  isActive(link.href) ? "bg-primary/10 text-primary" : ""
                }`}
                onClick={() => handleNav(link.href)}
              >
                <Icon className="w-4 h-4 mr-3" />
                {link.label}
              </Button>
            );
          })}
        </nav>

        {/* 🔑 Quick Actions (directly open modals in CreatorDashboard) */}
        {user.role === "artist" && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button 
                size="sm" 
                className="w-full justify-start" 
                onClick={() => handleNav("/creator?tab=upload")}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Song
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => sidebarEventBus.openEventModal()}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Create Event
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => sidebarEventBus.openMerchModal()}
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Merch
              </Button>
            </div>
          </Card>
        )}

        {/* Secondary Navigation for Fans */}
        {secondary.length > 0 && (
          <>
            <hr className="border-border" />
            <nav className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground px-2 mb-2">Library</h3>
              {secondary.map((link) => {
                const Icon = link.icon;
                return (
                  <Button
                    key={link.href}
                    variant={isActive(link.href) ? "secondary" : "ghost"}
                    className={`w-full justify-start ${
                      isActive(link.href) ? "bg-primary/10 text-primary" : ""
                    }`}
                    onClick={() => handleNav(link.href)}
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {link.label}
                  </Button>
                );
              })}
            </nav>
          </>
        )}

        {/* Premium Banner - Only show for FREE users */}
        {(!user.plan?.type || user.plan.type === "FREE") && user.role === "fan" && (
          <Card className="p-4 gradient-primary text-white">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="w-5 h-5" />
              <h3 className="font-semibold text-sm">Go Premium</h3>
            </div>
            <p className="text-xs opacity-90 mb-3">
              Enjoy ad-free music and exclusive features
            </p>
            <Link href="/plans">
              <Button size="sm" variant="secondary" className="w-full">
                Upgrade Now
              </Button>
            </Link>
          </Card>
        )}

        {/* Artist Stats - Real-time Data */}
        {isArtist && (
          <Card className="p-4 bg-gradient-to-br from-card to-card/50 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Live Stats</h3>
              <div className="flex items-center space-x-1">
                {(analyticsLoading || profileLoading) ? (
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : analyticsError || profileError ? (
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-muted-foreground">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Error Message */}
            {(analyticsError || profileError) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3">
                <p className="text-xs text-yellow-700 mb-1">⚠️ Stats temporarily unavailable</p>
                <p className="text-xs text-yellow-600">
                  {String(analyticsError?.message || profileError?.message || "Please check your artist profile setup")}
                </p>
              </div>
            )}
            <div className="space-y-3">
              {/* Total Streams */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Streams
                </span>
                <div className="text-right">
                  <span className="text-sm font-medium">
                    {analyticsLoading ? "..." : 
                     analyticsError ? "0" :
                     formatNumber(artistAnalytics?.totalPlays || 0)}
                  </span>
                  {!analyticsLoading && !analyticsError && artistAnalytics?.totalPlays && artistAnalytics.totalPlays > 0 && (
                    <TrendingUp className="w-3 h-3 text-green-500 inline ml-1" />
                  )}
                </div>
              </div>

              {/* Followers */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  Followers
                </span>
                <div className="text-right">
                  <span className="text-sm font-medium">
                    {profileLoading ? "..." : 
                     profileError ? "0" :
                     formatNumber(artistProfile?.followers?.length || 0)}
                  </span>
                  {!analyticsLoading && !analyticsError && artistAnalytics?.newFollowers && artistAnalytics.newFollowers > 0 && (
                    <span className="text-xs text-green-500 ml-1">+{artistAnalytics.newFollowers}</span>
                  )}
                </div>
              </div>

              {/* Revenue */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center">
                  <DollarSign className="w-3 h-3 mr-1" />
                  Revenue
                </span>
                <div className="text-right">
                  <span className="text-sm font-medium">
                    {analyticsLoading ? "..." : 
                     analyticsError ? "₹0" :
                     `₹${formatNumber(artistAnalytics?.monthlyRevenue || 0)}`}
                  </span>
                  {!analyticsLoading && !analyticsError && artistAnalytics?.monthlyRevenue && artistAnalytics.monthlyRevenue > 0 && (
                    <TrendingUp className="w-3 h-3 text-green-500 inline ml-1" />
                  )}
                </div>
              </div>

              {/* Unique Listeners */}
              {!analyticsLoading && artistAnalytics?.uniqueListeners && artistAnalytics.uniqueListeners > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-border/30">
                  <span className="text-xs text-muted-foreground flex items-center">
                    <User className="w-3 h-3 mr-1" />
                    Unique Listeners
                  </span>
                  <span className="text-xs font-medium">
                    {formatNumber(artistAnalytics.uniqueListeners)}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
