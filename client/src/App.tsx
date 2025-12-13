import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthModalProvider, useAuthModal } from "@/hooks/use-auth-modal";
import { MusicPlayerProvider } from "@/hooks/use-music-player";
import { ThemeProvider } from "@/hooks/use-theme";

// Development utilities
import "@/utils/ad-testing"; // Make ad testing utils available globally

// Pages
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import ArtistProfile from "@/pages/artist-profile";
import Dashboard from "@/pages/dashboard";
import CreatorDashboard from "@/pages/creator-dashboard/creator-dashboard";
import AdminPanel from "@/pages/admin-panel";

import Discover from "@/pages/discover";
import Merch from "@/pages/merch";
import MerchDetails from "@/pages/merch-details";
import Events from "@/pages/events";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Plans from "@/pages/plans";

import ResetPassword from "@/pages/auth/reset-password";
import Settings from "@/pages/settings";
import Playlists from "@/pages/playlists";
import Favorites from "@/pages/favorites";
import OrderTracking from "@/pages/order-tracking";
import EventDetails from "@/pages/event-details";
import SongDetails from "@/pages/song-details";
import BlogDetails from "@/pages/blog-details";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";

// Layout
import Header from "@/components/layout/header";
import SimpleMusicPlayer from "@/components/layout/simple-music-player";
import VideoBackground from "@/components/common/video-background";
import GlobalAuthModal from "@/components/auth/global-auth-modal";
import { useAuth } from "@/hooks/use-auth";

function AppRouter() {
  const { isLoading, user } = useAuth();
  
  // Show loading screen during auth state initialization to prevent white screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Use user state as key to force re-render when auth changes
  const renderKey = user ? `auth-${user._id}` : 'unauth';

  return (
    <div key={renderKey} className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <VideoBackground />

      <Switch>
        {/* Public Routes */}
        <Route path="/" component={Landing} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/plans" component={Plans} />
        <Route path="/discover" component={Discover} />
        <Route path="/merch" component={Merch} />
        <Route path="/merch/:id" component={MerchDetails} />
        <Route path="/events" component={Events} />
        <Route path="/artist/:id" component={ArtistProfile} />

        {/* Protected Routes */}
        <Route path="/home" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/:tab" component={Dashboard} />
        <Route path="/creator" component={CreatorDashboard} />
        <Route path="/creator/:tab" component={CreatorDashboard} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/:tab" component={AdminPanel} />

        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/contact" component={Contact} />
        <Route path="/settings" component={Settings} />
        <Route path="/playlists" component={Playlists} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/order-tracking/:orderId" component={OrderTracking} />
        <Route path="/event/:id" component={EventDetails} />
        <Route path="/song/:id" component={SongDetails} />
        <Route path="/blogs/:id" component={BlogDetails} />

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>

      {/* Global Components */}
      <Header />
      <SimpleMusicPlayer />
    </div>
  );
}

function AppWithProviders() {
  return (
    <AuthModalProvider>
      <AppRouter />
      <GlobalAuthModal />
    </AuthModalProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <MusicPlayerProvider>
              <Router>
                <AppWithProviders />
                <Toaster />
              </Router>
            </MusicPlayerProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
