import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Search, DollarSign, CreditCard, Receipt, RotateCcw, TrendingUp, ArrowUpDown, Banknote, Settings, Package, Calculator, TrendingDown, Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import Loading from "@/components/common/loading";

interface Transaction {
  _id: string;
  userId: string;
  amount: number;
  totalAmount?: number; // Tax-inclusive amount
  currency: string;
  status: string;
  type: string;
  description: string;
  createdAt: string;
  transactionId?: string;
}

interface Payout {
  _id: string;
  artistId: string;
  artistName: string;
  artistEmail: string;
  payoutAmount: number;
  status: string;
  createdAt: string;
}

interface MerchCostSettings {
  _id?: string;
  baseCost: number;
  manufacturingCost: number;
  shippingCost: number;
  packagingCost: number;
  platformFee: number;
  lastUpdated: string;
  updatedBy: string;
}

interface RevenueAnalytics {
  totalRevenue: number;
  platformRevenue: number;
  creatorRevenue: number;
  subscriptionRevenue: number;
  merchRevenue: number;
  eventRevenue: number;
  totalCosts: number;
  netProfit: number;
}

export default function AdminFinancialManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [costSettings, setCostSettings] = useState<MerchCostSettings>({
    baseCost: 0,
    manufacturingCost: 0,
    shippingCost: 0,
    packagingCost: 0,
    platformFee: 10,
    lastUpdated: '',
    updatedBy: ''
  });
  const queryClient = useQueryClient();

  // Fetch transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/admin/payments/transactions", statusFilter, typeFilter],
    queryFn: () => fetch(`/api/admin/payments/transactions?status=${statusFilter}&type=${typeFilter}&limit=100`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
  });

  // Fetch payouts
  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ["/api/admin/payouts"],
    queryFn: () => fetch("/api/admin/payouts", {
      headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
    }).then(res => res.json()),
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Fetch merch cost settings
  const { data: merchCosts, isLoading: merchCostsLoading } = useQuery({
    queryKey: ["/api/admin/merch-costs"],
    queryFn: async () => {
      const response = await fetch("/api/admin/merch-costs", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch merch costs');
      return response.json();
    },
  });

  // Fetch revenue analytics
  const { data: revenueAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/admin/analytics/revenue"],
    queryFn: async () => {
      const response = await fetch("/api/admin/analytics/revenue", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch revenue analytics');
      return response.json();
    },
  });

  // Process refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ transactionId, amount, reason }: { transactionId: string; amount: string; reason: string }) => {
      const response = await fetch(`/api/admin/payments/${transactionId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ amount: parseFloat(amount), reason })
      });
      if (!response.ok) throw new Error('Failed to process refund');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/transactions"] });
      toast({ title: "Success", description: "Refund processed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process refund", variant: "destructive" });
    }
  });

  // Mark payout as done mutation
  const markPayoutDoneMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const response = await fetch(`/api/admin/payouts/${payoutId}/mark-done`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          notes: 'Marked as completed by admin'
        })
      });
      if (!response.ok) throw new Error('Failed to mark payout as done');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries for consistency
      const queriesToInvalidate = [
        ["/api/admin/payouts"],
        ["/api/artists/payouts"],
        ["/api/artists/earnings"],
        ["/api/admin/analytics/revenue"],
        ["/api/users/me"]
      ];
      
      // Batch invalidate for better performance
      queriesToInvalidate.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      toast({ title: "Success", description: "Payout marked as completed" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to mark payout as done", 
        variant: "destructive" 
      });
    }
  });

  // Download Excel mutation
  const downloadExcelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/payouts/download-excel', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to download Excel file');
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payouts-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return true;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Excel file downloaded successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to download Excel file", 
        variant: "destructive" 
      });
    }
  });
  const processPayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const response = await fetch(`/api/admin/payouts/${payoutId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to process payout');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate admin payout queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      // Invalidate artist payout queries (so creator dashboard updates)
      queryClient.invalidateQueries({ queryKey: ["/api/artists/payouts"] });
      // Invalidate analytics queries that might include payout data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/revenue"] });
      toast({ title: "Success", description: "Payout processed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to process payout", 
        variant: "destructive" 
      });
    }
  });

  // Update merch cost settings mutation
  const updateMerchCostsMutation = useMutation({
    mutationFn: async (costSettings: MerchCostSettings) => {
      const response = await fetch('/api/admin/merch-costs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({
          costs: {
            baseCost: costSettings.baseCost,
            manufacturingCost: costSettings.manufacturingCost,
            shippingCost: costSettings.shippingCost,
            packagingCost: costSettings.packagingCost,
          },
          platformCommission: costSettings.platformFee
        })
      });
      if (!response.ok) throw new Error('Failed to update merch costs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merch-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/revenue"] });
      toast({ title: "Success", description: "Merchandise cost settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update merchandise cost settings", variant: "destructive" });
    }
  });

  // Set cost settings when data is loaded
  useEffect(() => {
    if (merchCosts?.costs) {
      setCostSettings({
        baseCost: merchCosts.costs.baseCost || 0,
        manufacturingCost: merchCosts.costs.manufacturingCost || 0,
        shippingCost: merchCosts.costs.shippingCost || 0,
        packagingCost: merchCosts.costs.packagingCost || 0,
        platformFee: merchCosts.platformCommission || 10,
        lastUpdated: merchCosts.updatedAt || '',
        updatedBy: merchCosts.updatedBy || ''
      });
    }
  }, [merchCosts]);

  const filteredTransactions = transactionsData?.transactions?.filter((transaction: Transaction) =>
    transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.transactionId?.includes(searchTerm)
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="outline">Refunded</Badge>;
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'subscription':
        return <Badge variant="secondary">Subscription</Badge>;
      case 'merch':
        return <Badge variant="outline">Merchandise</Badge>;
      case 'event':
        return <Badge variant="default">Event</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Memoize merchandise profit calculation
  const merchProfit = useMemo(() => {
    // If server provided a platform merch profit/breakdown, prefer that (keeps single source of truth)
    const serverMerchProfit = (revenueAnalytics as any)?.platformProfitBreakdown?.merchProfits ?? (revenueAnalytics as any)?.merchProfits;
    if (typeof serverMerchProfit === 'number' && serverMerchProfit >= 0) return serverMerchProfit;

    // Fallback: compute platform profit for merch as sum of per-item costs + platform fee (10%)
    const totalCosts = (costSettings.baseCost || 0) + (costSettings.manufacturingCost || 0) + (costSettings.shippingCost || 0) + (costSettings.packagingCost || 0);
    const platformFeeFromRevenue = (revenueAnalytics?.merchRevenue || 0) * ( (costSettings.platformFee || 10) / 100 );
    return (revenueAnalytics?.merchRevenue || 0) > 0 ? (totalCosts + platformFeeFromRevenue) : 0;
  }, [revenueAnalytics?.merchRevenue, costSettings]);

  // Memoize platform revenue calculation for consistency
  const platformRevenue = useMemo(() => {
    if (!revenueAnalytics) return 0;
    
    const subscriptionProfit = revenueAnalytics.subscriptionRevenue || 0;
    const eventProfit = (revenueAnalytics.eventRevenue || 0) * 0.1;
    
    return subscriptionProfit + eventProfit + merchProfit;
  }, [revenueAnalytics, costSettings]);

  // Calculate financial summary with memoization
  const financialSummary = useMemo(() => {
    const totalRevenueWithoutGst = filteredTransactions
      .filter((t: Transaction) => t.status === 'completed' || t.status === 'paid')
      .reduce((sum: number, t: Transaction) => sum + (t.amount || 0), 0);

    // Calculate total transaction amount (already includes GST)
    const totalTransactionAmount = filteredTransactions
      .filter((t: Transaction) => t.status === 'completed' || t.status === 'paid')
      .reduce((sum: number, t: Transaction) => {
        // totalAmount already includes GST
        return sum + (t.totalAmount || t.amount || 0);
      }, 0);

    const pendingPayments = filteredTransactions.filter((t: Transaction) => t.status === 'pending').length;
    
    const refundedTransactions = filteredTransactions.filter((t: Transaction) => t.status === 'refunded');
    const refundRate = filteredTransactions.length > 0 
      ? Math.round((refundedTransactions.length / filteredTransactions.length) * 100) 
      : 0;

    // Calculate base amount by removing GST from total
    const baseAmount = Math.round(totalTransactionAmount / 1.18);
    const gstAmount = totalTransactionAmount - baseAmount;

    return { 
      totalTransactionAmount,
      baseAmount,
      gstAmount,
      pendingPayments, 
      refundedTransactions, 
      refundRate 
    };
  }, [filteredTransactions]);

  const pendingPayouts = payoutsData?.payouts?.filter((p: Payout) => p.status.toLowerCase() === 'pending') || [];
  const totalPendingPayoutAmount = pendingPayouts.reduce((sum: number, p: Payout) => sum + p.payoutAmount, 0);

  if (transactionsLoading || payoutsLoading || merchCostsLoading || analyticsLoading) {
    return <Loading size="lg" text="Loading financial data..." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Payouts Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalPendingPayoutAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{pendingPayouts.length} artists</p>
          </CardContent>
        </Card>

        {/* Total Transactions Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Math.round(financialSummary.totalTransactionAmount).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Base: ₹{Math.round(financialSummary.baseAmount).toLocaleString()} + GST: ₹{Math.round(financialSummary.gstAmount).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Profits Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Profits Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            Revenue analysis by different income sources
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="border-blue-100 dark:border-blue-900">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Platform Subscriptions</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">100% platform profit</p>
                </CardContent>
              </Card>

              <Card className="border-green-100 dark:border-green-900">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₹{((revenueAnalytics?.eventRevenue || 0) * 0.1).toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Event Ticket Fees</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">10% of ticket price</p>
                </CardContent>
              </Card>

              <Card className="border-purple-100 dark:border-purple-900">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ₹{merchProfit.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">Merchandise Profit</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Costs + 10% commission</p>
                </CardContent>
              </Card>
            </div>

            {/* Total Platform Profit Summary */}
            <Card className="border-orange-100 dark:border-orange-900">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                    ₹{platformRevenue.toLocaleString()}
                  </div>
                  <p className="text-lg font-medium text-muted-foreground">Total Platform Profit</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Net platform earnings across all revenue sources</p>
                </div>
              </CardContent>
            </Card>
            {/* Visual Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Sources Visualization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <div className="grid grid-cols-3 gap-4 h-full items-end">
                    {/* Platform Subscriptions Bar */}
                    <div className="flex flex-col items-center justify-end h-full">
                      <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                           style={{ 
                             height: (revenueAnalytics?.subscriptionRevenue || 0) > 0 ? '120px' : '60px'
                           }}>
                        ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-medium text-sm">Platform</p>
                        <p className="font-medium text-sm">Subscriptions</p>
                        <p className="text-xs text-muted-foreground mt-1">100% platform</p>
                      </div>
                    </div>

                    {/* Event Tickets Bar */}
                    <div className="flex flex-col items-center justify-end h-full">
                      <div className="w-full bg-gradient-to-t from-green-500 to-green-400 dark:from-green-600 dark:to-green-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                           style={{ 
                             height: (revenueAnalytics?.eventRevenue || 0) > 0 ? '100px' : '60px'
                           }}>
                        ₹{((revenueAnalytics?.eventRevenue || 0) * 0.1).toLocaleString()}
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-medium text-sm">Event</p>
                        <p className="font-medium text-sm">Tickets</p>
                        <p className="text-xs text-muted-foreground mt-1">10% platform fee</p>
                      </div>
                    </div>

                    {/* Merchandise Sales Bar */}
                    <div className="flex flex-col items-center justify-end h-full">
                      <div className="w-full bg-gradient-to-t from-purple-500 to-purple-400 dark:from-purple-600 dark:to-purple-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                           style={{ 
                             height: merchProfit > 0 ? '90px' : '60px'
                           }}>
                        ₹{merchProfit.toLocaleString()}
                      </div>
                      <div className="mt-3 text-center">
                        <p className="font-medium text-sm">Merchandise</p>
                        <p className="font-medium text-sm">Sales</p>
                        <p className="text-xs text-muted-foreground mt-1">Costs + 10% fee</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Financial Management Tabs */}
      <Tabs defaultValue="transactions" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground min-w-full lg:w-full">
            <TabsTrigger value="transactions" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Transactions</TabsTrigger>
            <TabsTrigger value="merch-costs" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Merch Costs</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Payouts</TabsTrigger>
            <TabsTrigger value="refunds" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Refunds</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Analytics</TabsTrigger>
          </TabsList>
        </div>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">
                All payment transactions from orders and subscriptions
              </p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Search Transactions</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by description or transaction ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-48">
                  <Label htmlFor="type-filter">Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="merch">Merchandise</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Transactions List */}
              <div className="space-y-4">
                {filteredTransactions.map((transaction: Transaction) => (
                  <div key={transaction._id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg space-y-3 md:space-y-0">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {transaction.transactionId || 'No transaction ID'} • {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {getStatusBadge(transaction.status)}
                          {getTypeBadge(transaction.type)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end md:space-x-4">
                      <div className="text-left md:text-right">
                        <p className="font-semibold">₹{transaction.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{transaction.currency.toUpperCase()}</p>
                      </div>

                      {transaction.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refundMutation.mutate({
                            transactionId: transaction._id,
                            amount: transaction.amount.toString(),
                            reason: "Admin initiated refund"
                          })}
                          className="text-destructive hover:text-destructive"
                          disabled={refundMutation.isPending}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Refund
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Merchandise Cost Management Tab */}
        <TabsContent value="merch-costs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Merchandise Cost Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure base costs for merchandise production and shipping
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cost Settings Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseCost">Base Cost (₹)</Label>
                    <Input
                      id="baseCost"
                      type="number"
                      value={costSettings.baseCost}
                      onChange={(e) => setCostSettings({ ...costSettings, baseCost: parseFloat(e.target.value) || 0 })}
                      placeholder="Base production cost"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manufacturingCost">Manufacturing Cost (₹)</Label>
                    <Input
                      id="manufacturingCost"
                      type="number"
                      value={costSettings.manufacturingCost}
                      onChange={(e) => setCostSettings({ ...costSettings, manufacturingCost: parseFloat(e.target.value) || 0 })}
                      placeholder="Manufacturing overhead"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shippingCost">Shipping Cost (₹)</Label>
                    <Input
                      id="shippingCost"
                      type="number"
                      value={costSettings.shippingCost}
                      onChange={(e) => setCostSettings({ ...costSettings, shippingCost: parseFloat(e.target.value) || 0 })}
                      placeholder="Shipping charges"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="packagingCost">Packaging Cost (₹)</Label>
                    <Input
                      id="packagingCost"
                      type="number"
                      value={costSettings.packagingCost}
                      onChange={(e) => setCostSettings({ ...costSettings, packagingCost: parseFloat(e.target.value) || 0 })}
                      placeholder="Packaging materials"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platformFee">Platform Fee (%)</Label>
                    <Input
                      id="platformFee"
                      type="number"
                      value={costSettings.platformFee}
                      onChange={(e) => setCostSettings({ ...costSettings, platformFee: parseFloat(e.target.value) || 0 })}
                      placeholder="Platform commission"
                      min="0"
                      max="100"
                    />
                  </div>

                  <Button 
                    onClick={() => updateMerchCostsMutation.mutate(costSettings)}
                    disabled={updateMerchCostsMutation.isPending}
                    className="w-full"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {updateMerchCostsMutation.isPending ? 'Updating...' : 'Update Cost Settings'}
                  </Button>
                </div>

                {/* Cost Preview */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Cost Breakdown Preview</h3>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Sample Merchandise (₹500)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Selling Price:</span>
                        <span className="font-medium">₹500</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Base Cost:</span>
                        <span>-₹{costSettings.baseCost}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Manufacturing:</span>
                        <span>-₹{costSettings.manufacturingCost}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Shipping:</span>
                        <span>-₹{costSettings.shippingCost}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Packaging:</span>
                        <span>-₹{costSettings.packagingCost}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Platform Fee ({costSettings.platformFee}%):</span>
                        <span>-₹{Math.round(500 * (costSettings.platformFee / 100))}</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Artist Earnings:</span>
                        <span className="text-green-600">
                          ₹{Math.max(0, 500 - costSettings.baseCost - costSettings.manufacturingCost - costSettings.shippingCost - costSettings.packagingCost - Math.round(500 * (costSettings.platformFee / 100)))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Platform Revenue:</span>
                        <span className="text-blue-600">
                          ₹{costSettings.baseCost + costSettings.manufacturingCost + costSettings.shippingCost + costSettings.packagingCost + Math.round(500 * (costSettings.platformFee / 100))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {merchCosts?.costs?.lastUpdated && (
                    <div className="text-sm text-muted-foreground">
                      <p>Last updated: {new Date(merchCosts.costs.lastUpdated).toLocaleDateString()}</p>
                      <p>Updated by: {merchCosts.costs.updatedBy}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Refund Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage refunds for transactions and returns
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financialSummary.refundedTransactions.map((transaction: Transaction) => (
                  <div key={transaction._id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg space-y-2 md:space-y-0">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Refunded on {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                        <div className="mt-1">
                          <Badge variant="outline">Refunded</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="font-semibold text-destructive">-₹{transaction.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Refund processed</p>
                    </div>
                  </div>
                ))}
                {financialSummary.refundedTransactions.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No refunds processed yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Artist Payouts</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadExcelMutation.mutate()}
                    disabled={downloadExcelMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {downloadExcelMutation.isPending ? "Downloading..." : "Download Excel"}
                  </Button>
                </div>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage artist earnings and bank transfers
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingPayouts.map((payout: Payout) => (
                  <div key={payout._id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg space-y-3 md:space-y-0">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{payout.artistName}</p>
                        <p className="text-sm text-muted-foreground truncate">{payout.artistEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(payout.createdAt).toLocaleDateString()}
                        </p>
                        <div className="mt-1">
                          {getStatusBadge(payout.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
                      <div className="text-left md:text-right">
                        <p className="font-semibold">₹{payout.payoutAmount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Payout amount</p>
                      </div>

                      <div className="flex gap-2 justify-start md:justify-end">
                        {payout.status.toLowerCase() === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => processPayoutMutation.mutate(payout._id)}
                              disabled={processPayoutMutation.isPending}
                              className="text-xs"
                            >
                              <Banknote className="w-4 h-4 mr-1" />
                              Process
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markPayoutDoneMutation.mutate(payout._id)}
                              disabled={markPayoutDoneMutation.isPending}
                              className="text-green-600 hover:text-green-700 text-xs"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Mark Done
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {pendingPayouts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No pending payouts</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Profits Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revenue analysis by different income sources
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Summary Stats First */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="border-blue-100 dark:border-blue-900">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Platform Subscriptions</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">100% platform profit</p>
                    </CardContent>
                  </Card>

                  <Card className="border-green-100 dark:border-green-900">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        ₹{((revenueAnalytics?.eventRevenue || 0) * 0.1).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Event Ticket Fees</p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">10% of ticket price</p>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-100 dark:border-purple-900">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        ₹{merchProfit.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Merchandise Profit</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Costs + 10% commission</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Total Platform Profit Summary */}
                <Card className="border-orange-100 dark:border-orange-900">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                        ₹{platformRevenue.toLocaleString()}
                      </div>
                      <p className="text-lg font-medium text-muted-foreground">Total Platform Profit</p>
                      <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Net platform earnings across all revenue sources</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Visual Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Revenue Sources Visualization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 w-full">
                      <div className="grid grid-cols-3 gap-4 h-full items-end">
                        {/* Platform Subscriptions Bar */}
                        <div className="flex flex-col items-center justify-end h-full">
                          <div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                               style={{ 
                                 height: (revenueAnalytics?.subscriptionRevenue || 0) > 0 ? '120px' : '60px'
                               }}>
                            ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}
                          </div>
                          <div className="mt-3 text-center">
                            <p className="font-medium text-sm">Platform</p>
                            <p className="font-medium text-sm">Subscriptions</p>
                            <p className="text-xs text-muted-foreground mt-1">100% platform</p>
                          </div>
                        </div>

                        {/* Event Tickets Bar */}
                        <div className="flex flex-col items-center justify-end h-full">
                          <div className="w-full bg-gradient-to-t from-green-500 to-green-400 dark:from-green-600 dark:to-green-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                               style={{ 
                                 height: (revenueAnalytics?.eventRevenue || 0) > 0 ? '100px' : '60px'
                               }}>
                            ₹{((revenueAnalytics?.eventRevenue || 0) * 0.1).toLocaleString()}
                          </div>
                          <div className="mt-3 text-center">
                            <p className="font-medium text-sm">Event</p>
                            <p className="font-medium text-sm">Tickets</p>
                            <p className="text-xs text-muted-foreground mt-1">10% platform fee</p>
                          </div>
                        </div>

                        {/* Merchandise Sales Bar */}
                        <div className="flex flex-col items-center justify-end h-full">
                          <div className="w-full bg-gradient-to-t from-purple-500 to-purple-400 dark:from-purple-600 dark:to-purple-500 rounded-t-lg flex items-end justify-center text-white font-medium text-xs p-2 transition-all hover:scale-105"
                               style={{ 
                                 height: merchProfit > 0 ? '90px' : '60px'
                               }}>
                            ₹{merchProfit.toLocaleString()}
                          </div>
                          <div className="mt-3 text-center">
                            <p className="font-medium text-sm">Merchandise</p>
                            <p className="font-medium text-sm">Sales</p>
                            <p className="text-xs text-muted-foreground mt-1">Costs + 10% fee</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue Breakdown Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Revenue Breakdown Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Platform Subscriptions */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-blue-700 dark:text-blue-300">Platform Subscriptions (Premium/ArtistPro)</h4>
                          <span className="text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">100% Platform</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>Total Revenue: ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}</div>
                          <div>Platform Profit: ₹{(revenueAnalytics?.subscriptionRevenue || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Event Tickets */}
                      <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-green-700 dark:text-green-300">Event Ticket Sales</h4>
                          <span className="text-sm bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-2 py-1 rounded">10% Platform Fee</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>Total Revenue: ₹{(revenueAnalytics?.eventRevenue || 0).toLocaleString()}</div>
                          <div>Platform Profit: ₹{((revenueAnalytics?.eventRevenue || 0) * 0.1).toLocaleString()}</div>
                          <div>Artist Revenue: ₹{((revenueAnalytics?.eventRevenue || 0) * 0.9).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Merchandise */}
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-purple-700 dark:text-purple-300">Merchandise Sales</h4>
                          <span className="text-sm bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">Costs + 10% Fee</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div>Total Revenue: ₹{(revenueAnalytics?.merchRevenue || 0).toLocaleString()}</div>
                            <div>Base Cost: ₹{(costSettings.baseCost || 0).toLocaleString()}</div>
                            <div>Manufacturing: ₹{(costSettings.manufacturingCost || 0).toLocaleString()}</div>
                            <div>Shipping: ₹{(costSettings.shippingCost || 0).toLocaleString()}</div>
                            <div>Packaging: ₹{(costSettings.packagingCost || 0).toLocaleString()}</div>
                            <div>Platform Fee (10%): ₹{((revenueAnalytics?.merchRevenue || 0) * 0.1).toLocaleString()}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium">Platform Profit: ₹{merchProfit.toLocaleString()}</div>
                            <div className="font-medium">Artist Revenue: ₹{(revenueAnalytics?.merchRevenue || 0) > 0 ? Math.max(0, 
                              (revenueAnalytics?.merchRevenue || 0) - merchProfit
                            ).toLocaleString() : '0'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}