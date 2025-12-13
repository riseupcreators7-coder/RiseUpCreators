import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Music,
  Calendar,
  Crown,
  Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreatorEarningsProps {
  artistProfile: any;
  analytics: any;
}

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingPayouts: number;
  lastPayoutDate: string | null;
  nextPayoutDate: string | null;
  breakdown: {
    subscriptions: number;
    merchandise: number;
    events: number;
    adRevenue: number;
    streamingEarnings: number;
  };
  platformFee: number;
}

export default function CreatorEarnings({ artistProfile, analytics }: CreatorEarningsProps) {
  // Fetch detailed earnings breakdown from new API
  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ["/api/artists/earnings"],
    queryFn: async () => {
      const response = await fetch("/api/artists/earnings", {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}` 
        }
      });
      if (!response.ok) throw new Error('Failed to fetch earnings');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const defaultEarnings: EarningsData = {
    totalEarnings: 0,
    availableBalance: 0,
    pendingPayouts: 0,
    lastPayoutDate: null,
    nextPayoutDate: null,
    breakdown: {
      subscriptions: 0,
      merchandise: 0,
      events: 0,
      adRevenue: 0,
      streamingEarnings: 0
    },
    platformFee: 10
  };

  const earnings: EarningsData = earningsData || defaultEarnings;

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;

  const netEarnings = earnings.totalEarnings * (1 - earnings.platformFee / 100);
  const platformFee = earnings.totalEarnings * (earnings.platformFee / 100);

  return (
    <div className="space-y-6">
      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(earnings.totalEarnings)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              This month
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Crown className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(earnings.availableBalance)}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Ready for payout
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              You'll Receive
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 ml-1 text-blue-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>After {earnings.platformFee}% platform fee</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {formatCurrency(netEarnings)}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Platform fee: {formatCurrency(platformFee)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {formatCurrency(earnings.pendingPayouts)}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              {earnings.nextPayoutDate 
                ? `Next payout: ${new Date(earnings.nextPayoutDate).toLocaleDateString()}`
                : "No pending payouts"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Breakdown</CardTitle>
          <p className="text-muted-foreground text-sm">
            See how your earnings are distributed across different sources
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Crown className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium">Subscriptions</div>
                  <div className="text-sm text-muted-foreground">Monthly supporter revenue (₹99/month per subscriber)</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-purple-700">
                  {formatCurrency(earnings.breakdown.subscriptions)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {analytics?.newSubscribers || 0} new this month
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Music className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium">Streaming Royalties</div>
                  <div className="text-sm text-muted-foreground">Revenue from plays & downloads</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-blue-700">
                  {formatCurrency(earnings.breakdown.streamingEarnings)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {analytics.totalPlays?.toLocaleString() || 0} plays
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium">Ad Revenue</div>
                  <div className="text-sm text-muted-foreground">Revenue from ads on your content</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-700">
                  {formatCurrency(earnings.breakdown.adRevenue)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Ad impressions
                </div>
              </div>
            </div>

            {earnings.breakdown.merchandise > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="font-medium">Merchandise Sales</div>
                    <div className="text-sm text-muted-foreground">Revenue from merch sales</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-yellow-700">
                    {formatCurrency(earnings.breakdown.merchandise)}
                  </div>
                </div>
              </div>
            )}

            {earnings.breakdown.events > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-red-600" />
                  <div>
                    <div className="font-medium">Event Tickets</div>
                    <div className="text-sm text-muted-foreground">Revenue from event sales</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-red-700">
                    {formatCurrency(earnings.breakdown.events)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payout Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payout Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Platform Fee</div>
                <div className="text-sm text-muted-foreground">
                  Fee charged by RiseUp Creators for platform services
                </div>
              </div>
              <Badge variant="secondary">{earnings.platformFee}%</Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Minimum Payout Threshold</div>
                <div className="text-sm text-muted-foreground">
                  Minimum earnings required for payout processing
                </div>
              </div>
              <Badge variant="outline">₹100</Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Payout Schedule</div>
                <div className="text-sm text-muted-foreground">
                  Payouts are processed monthly by the admin team
                </div>
              </div>
              <Badge variant="outline">Monthly</Badge>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Payouts are processed by our admin team and transferred directly to your bank account. 
                You'll receive a notification when your payout is processed.
              </p>
              {earnings.lastPayoutDate && (
                <p className="text-xs text-muted-foreground">
                  Last payout: {new Date(earnings.lastPayoutDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}