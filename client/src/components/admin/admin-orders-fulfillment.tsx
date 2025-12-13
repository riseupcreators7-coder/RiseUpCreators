import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Search, Package, Truck, RotateCcw, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import Loading from "@/components/common/loading";

export default function AdminOrdersFulfillment() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [returnStatusFilter, setReturnStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["/api/admin/orders", statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/orders?status=${statusFilter}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch return requests
  const { data: returnsData, isLoading: returnsLoading, error: returnsError } = useQuery({
    queryKey: ["/api/admin/returns", returnStatusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/returns?status=${returnStatusFilter}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch returns: ${response.status}`);
      }
      return response.json();
    },
  });

  // Update order status mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) => {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ status, notes })
      });
      if (!response.ok) throw new Error('Failed to update order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Success", description: "Order updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update order", variant: "destructive" });
    }
  });

  // Update return request mutation
  const updateReturnMutation = useMutation({
    mutationFn: async ({ returnId, status, adminNotes }: { returnId: string; status: string; adminNotes?: string }) => {
      const response = await fetch(`/api/admin/returns/${returnId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ status, adminNotes })
      });
      if (!response.ok) throw new Error('Failed to update return request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/returns"] });
      toast({ title: "Success", description: "Return request updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update return request", variant: "destructive" });
    }
  });

  // Retry shipment creation mutation
  const retryShipmentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}/retry-shipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to retry shipment creation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({ title: "Success", description: "Shipment created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create shipment", 
        variant: "destructive" 
      });
    }
  });

  const filteredOrders = ordersData?.orders?.filter((order: any) =>
    order._id?.toString().includes(searchTerm) ||
    order.items?.some((item: any) => item.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const filteredReturns = returnsData?.returnRequests?.filter((returnReq: any) =>
    returnReq.orderId?.toString().includes(searchTerm) ||
    returnReq.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getOrderStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'SHIPPED':
        return <Badge variant="default" className="bg-blue-500">Shipped</Badge>;
      case 'DELIVERED':
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReturnStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="default" className="bg-blue-500">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'REFUNDED':
        return <Badge variant="default" className="bg-green-500">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Calculate summary stats
  const totalOrders = ordersData?.total || 0;
  const pendingOrders = filteredOrders.filter((o: any) => o.status === 'PENDING').length;
  const shippedOrders = filteredOrders.filter((o: any) => o.status === 'SHIPPED').length;
  const pendingReturns = filteredReturns.filter((r: any) => r.status === 'PENDING').length;

  if (ordersLoading || returnsLoading) {
    return <Loading size="lg" text="Loading orders data..." />;
  }

  if (ordersError || returnsError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading data</div>
        <div className="text-sm text-muted-foreground">
          {ordersError?.message || returnsError?.message || "Unknown error occurred"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">All time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shipped Orders</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shippedOrders}</div>
            <p className="text-xs text-muted-foreground">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Return Requests</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReturns}</div>
            <p className="text-xs text-muted-foreground">Pending review</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders & Fulfillment Tabs */}
      <Tabs defaultValue="orders" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground min-w-full lg:w-full">
            <TabsTrigger value="orders" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Order Management</TabsTrigger>
            <TabsTrigger value="returns" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Returns & Exchanges</TabsTrigger>
            <TabsTrigger value="shipping" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Shipping & Tracking</TabsTrigger>
          </TabsList>
        </div>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Management</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage order processing, status updates, and fulfillment
              </p>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="search">Search Orders</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by order ID or item name..."
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
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                      <SelectItem value="SHIPPED">Shipped</SelectItem>
                      <SelectItem value="DELIVERED">Delivered</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Orders List */}
              <div className="space-y-4">
                {filteredOrders.map((order: any) => (
                  <div key={order._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Order #{order._id.toString().slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.items?.length || 0} items • ₹{(order.totalAmount || order.total || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                        {order.trackingNumber && (
                          <p className="text-xs text-blue-600 font-mono">
                            AWB: {order.trackingNumber}
                          </p>
                        )}
                        {order.courierName && (
                          <p className="text-xs text-muted-foreground">
                            Courier: {order.courierName}
                          </p>
                        )}
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/admin/orders/${order._id}/download-excel`, {
                              headers: { 
                                Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` 
                              }
                            });
                            
                            if (!response.ok) {
                              throw new Error('Download failed');
                            }
                            
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `order-${order._id.slice(-8)}.xlsx`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Excel download failed:', error);
                          }
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Excel
                      </Button>

                      {order.status === 'PAID' && !order.shipmentId && (order.type === 'MERCH' || order.type === 'MIXED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryShipmentMutation.mutate(order._id)}
                          disabled={retryShipmentMutation.isPending}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          Create Shipment
                        </Button>
                      )}
                      
                      {order.status === 'PENDING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateOrderMutation.mutate({
                            orderId: order._id,
                            status: 'SHIPPED',
                            notes: 'Order shipped by admin'
                          })}
                          disabled={updateOrderMutation.isPending}
                        >
                          <Truck className="w-4 h-4 mr-1" />
                          Ship
                        </Button>
                      )}
                      
                      {order.status === 'SHIPPED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateOrderMutation.mutate({
                            orderId: order._id,
                            status: 'DELIVERED',
                            notes: 'Order delivered'
                          })}
                          disabled={updateOrderMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Delivered
                        </Button>
                      )}

                      {order.shipmentId && order.trackingDetails?.trackingUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(order.trackingDetails.trackingUrl, '_blank')}
                        >
                          <Truck className="w-4 h-4 mr-1" />
                          Track
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Returns Tab */}
        <TabsContent value="returns" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Returns & Exchanges</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage return requests, approvals, and refunds
              </p>
            </CardHeader>
            <CardContent>
              {/* Return Status Filter */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Label htmlFor="return-search">Search Returns</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="return-search"
                      placeholder="Search by order ID or reason..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Label htmlFor="return-status-filter">Status</Label>
                  <Select value={returnStatusFilter} onValueChange={setReturnStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                      <SelectItem value="REFUNDED">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Returns List */}
              <div className="space-y-4">
                {filteredReturns.map((returnReq: any) => (
                  <div key={returnReq._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Return #{returnReq._id.toString().slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Order #{returnReq.orderId?.toString().slice(-8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Reason: {returnReq.reason || 'Not specified'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested {new Date(returnReq.createdAt).toLocaleDateString()}
                        </p>
                        {getReturnStatusBadge(returnReq.status)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {returnReq.status === 'PENDING' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-success border-success hover:bg-success hover:text-white"
                            onClick={() => updateReturnMutation.mutate({
                              returnId: returnReq._id,
                              status: 'APPROVED',
                              adminNotes: 'Return approved by admin'
                            })}
                            disabled={updateReturnMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => updateReturnMutation.mutate({
                              returnId: returnReq._id,
                              status: 'REJECTED',
                              adminNotes: 'Return rejected - does not meet criteria'
                            })}
                            disabled={updateReturnMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filteredReturns.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No return requests found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipping Tab */}
        <TabsContent value="shipping" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipping & Tracking</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track shipments and manage delivery status
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredOrders
                  .filter((order: any) => order.status === 'SHIPPED' || order.status === 'DELIVERED')
                  .map((order: any) => (
                  <div key={order._id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-muted rounded-full">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">Order #{order._id.toString().slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Tracking: TRK{order._id.toString().slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Shipped {new Date(order.updatedAt || order.createdAt).toLocaleDateString()}
                        </p>
                        {getOrderStatusBadge(order.status)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{(order.totalAmount || order.total || 0).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.status === 'DELIVERED' ? 'Delivered' : 'In Transit'}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredOrders.filter((order: any) => order.status === 'SHIPPED' || order.status === 'DELIVERED').length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No shipped orders to track</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}