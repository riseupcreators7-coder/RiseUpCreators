import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Users,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import Loading from "@/components/common/loading";

import UnifiedAnalyticsDashboard from "@/components/analytics/UnifiedAnalyticsDashboard";
import AdminUserManagementUnified from "@/components/admin/admin-user-management-unified";
import AdminFinancialManagement from "@/components/admin/admin-financial-management";
import AdminContentManagement from "@/components/admin/admin-content-management";
import AdminOrdersFulfillment from "@/components/admin/admin-orders-fulfillment";
import AdminMarketingPromotion from "@/components/admin/admin-marketing-promotion";
import AdminSystemSettings from "@/components/admin/admin-system-settings-simplified";

export default function AdminPanel() {
  const auth = useRequireRole("admin");
  const [location, setLocation] = useLocation();

  const getTabFromUrl = () => {
    const pathParts = location.split("/");
    return pathParts[2] || "overview";
  };

  const [activeTab, setActiveTab] = useState<string>(getTabFromUrl());

  // keep tab synced with URL
  useEffect(() => {
    const currentTab = getTabFromUrl();
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
    }
  }, [location]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "overview") {
      setLocation("/admin");
    } else {
      setLocation(`/admin/${value}`);
    }
  };

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: () =>
      fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      }).then((res) => res.json()),
    enabled: !!auth.user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: pendingArtists, isLoading: artistsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-artists"],
    enabled: !!auth.user,
    staleTime: 30 * 1000,
  });

  if (auth.isLoading || statsLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading admin panel..." />
      </div>
    );
  }

  if (!auth.user) return null;

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Admin Panel</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage platform operations and content</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-8 h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm">Users</TabsTrigger>
            <TabsTrigger value="financial" className="text-xs md:text-sm">Financial</TabsTrigger>
            <TabsTrigger value="content" className="text-xs md:text-sm">Content</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs md:text-sm">Orders</TabsTrigger>
            <TabsTrigger value="marketing" className="text-xs md:text-sm">Marketing</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs md:text-sm">Settings</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                  <Users className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardStats?.dau?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
                  <Users className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardStats?.mau?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ₹{dashboardStats?.platformRevenue?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Platform earnings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(dashboardStats?.retentionRate7d || 0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">7-day retention</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="cursor-pointer hover-glow"
                onClick={() => {
                  setLocation("/admin/users");
                  setActiveTab("users");
                }}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <Users className="w-12 h-12 text-warning mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Manage Users</h3>
                  <p className="text-sm text-muted-foreground">
                    User management and artist verification
                  </p>
                  {pendingArtists && pendingArtists.length > 0 && (
                    <Badge className="mt-2" variant="secondary">
                      {pendingArtists.length} pending artists
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover-glow"
                onClick={() => {
                  setLocation("/admin/financial");
                  setActiveTab("financial");
                }}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <DollarSign className="w-12 h-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Financial Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Revenue tracking and payouts
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Other Tabs */}
          <TabsContent value="users">
            <AdminUserManagementUnified />
          </TabsContent>

          <TabsContent value="financial">
            <AdminFinancialManagement />
          </TabsContent>

          <TabsContent value="content">
            <AdminContentManagement />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersFulfillment />
          </TabsContent>

          <TabsContent value="marketing">
            <AdminMarketingPromotion />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
