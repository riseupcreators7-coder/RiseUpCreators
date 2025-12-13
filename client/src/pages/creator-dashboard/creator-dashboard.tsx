import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Upload, Music, Calendar, ShoppingBag,
  DollarSign, Users, Heart, Play, Plus, Edit, Trash2, BookOpen,
  TrendingUp, BarChart3, PieChart, Activity, Palette, Crown, Vote
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import Sidebar from "@/components/layout/sidebar";
import { MUSIC_GENRES } from "@/lib/constants";
import { sidebarEventBus } from "@/components/layout/sidebar";

// Import tab components
import OverviewTab from "./OverviewTab.tsx";
import UploadTab from "./UploadTab.tsx";
import SongsTab from "./SongsTab.tsx";

import EventsTab from "./EventsTab.tsx";
import ScannerTab from "./ScannerTab.tsx";
import MerchTab from "./MerchTab.tsx";
import BlogsTab from "./BlogsTab.tsx";
import AnalyticsTab from "./AnalyticsTab.tsx";
import SettingsTab from "./SettingsTab.tsx";

// Import types
import type { ArtistProfile, Song, Event, Merch, Analytics, Blog } from "./types";

// ---------- COMPONENT ----------
export default function CreatorDashboard() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Extract tab from URL search params or route params
  const getTabFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) return tabParam;

    const pathParts = location.split('/');
    return pathParts[2] || "overview";
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());

  useEffect(() => {
    const currentTab = getTabFromUrl();
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);

      // Refetch data when switching to specific tabs
      if (currentTab === "songs") {
        queryClient.invalidateQueries({ queryKey: ["artistSongs"] });
      } else if (currentTab === "events") {
        queryClient.invalidateQueries({ queryKey: ["artistEvents"] });
      } else if (currentTab === "merch") {
        queryClient.invalidateQueries({ queryKey: ["artistMerch"] });
      } else if (currentTab === "analytics") {
        // Invalidate all analytics-related queries when viewing analytics
        queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
        queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      }
    }
  }, [location, activeTab, queryClient]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "overview") {
      setLocation("/creator");
    } else {
      setLocation(`/creator?tab=${value}`);
    }
  };

  // Check if user is artist, if not redirect to plans
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role !== "artist") {
        setShowSubscriptionModal(true);
        // Redirect to plans after showing modal
        setTimeout(() => {
          setLocation("/plans");
        }, 3000);
      }
    }
  }, [user, isLoading, setLocation]);

  // ---------- LOADING STATES ----------
  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Loading size="lg" text="Loading creator dashboard..." />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Loading size="lg" text="Please sign in to access creator dashboard..." />
        </div>
      </div>
    );
  }

  // If user is not an artist, show subscription modal and redirect
  if (user.role !== "artist") {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container mx-auto px-4 flex items-center justify-center min-h-[50vh]">
          <Dialog open={showSubscriptionModal} onOpenChange={() => {}}>
            <DialogContent className="glass-effect border-border max-w-md w-full mx-4">
              <DialogHeader>
                <DialogTitle className="text-center">
                  <Crown className="w-12 h-12 mx-auto mb-4 text-primary" />
                  Become a Creator
                </DialogTitle>
                <DialogDescription className="text-center">
                  To access the creator dashboard and upload music, you need to subscribe to our Artist Pro plan.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center">
                <Button
                  onClick={() => setLocation("/plans")}
                  className="gradient-primary"
                >
                  View Plans
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-24 lg:flex">
      <Sidebar />

      <main className="flex-1 w-full lg:ml-64">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold">Creator Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your music, track performance, and grow your audience
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:grid-cols-9 mb-6 md:mb-8 h-auto gap-1">
              <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="upload" className="text-xs md:text-sm">Upload</TabsTrigger>
              <TabsTrigger value="songs" className="text-xs md:text-sm">Songs</TabsTrigger>
              <TabsTrigger value="events" className="text-xs md:text-sm">Events</TabsTrigger>
              <TabsTrigger value="scanner" className="text-xs md:text-sm">Scanner</TabsTrigger>
              <TabsTrigger value="merch" className="text-xs md:text-sm">Merch</TabsTrigger>
              <TabsTrigger value="blogs" className="text-xs md:text-sm">Blogs</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs md:text-sm">Analytics</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs md:text-sm">Settings</TabsTrigger>
            </TabsList>

            <OverviewTab />
            <UploadTab />
            <SongsTab />

            <EventsTab />
            <ScannerTab />
            <MerchTab />
            <BlogsTab />
            <AnalyticsTab />
            <SettingsTab />
          </Tabs>
        </div>
      </main>
    </div>
  );
}
