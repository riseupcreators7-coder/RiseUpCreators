import { useState } from "react";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, CreditCard, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Loading from "@/components/common/loading";

export default function Cart() {
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch cart data
  const { data: cart, isLoading: cartLoading, error: cartError } = useQuery<any>({
    queryKey: ["/api/cart"],
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: 1000
  });

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await fetch("/api/cart/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ itemId, quantity })
      });
      if (!response.ok) throw new Error("Failed to update cart");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update cart item",
        variant: "destructive"
      });
    }
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch("/api/cart/remove", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ itemId })
      });
      if (!response.ok) throw new Error("Failed to remove item");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Item removed",
        description: "Item removed from cart"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item from cart",
        variant: "destructive"
      });
    }
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/clear", {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to clear cart");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Cart cleared",
        description: "All items have been removed from your cart"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear cart",
        variant: "destructive"
      });
    }
  });

  // Apply promo code mutation
  const applyPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch("/api/cart/promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ code })
      });
      if (!response.ok) throw new Error("Invalid promo code");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Promo applied",
        description: "Discount applied successfully"
      });
      setPromoCode("");
      setIsApplyingPromo(false);
    },
    onError: () => {
      toast({
        title: "Invalid promo code",
        description: "Please check the code and try again",
        variant: "destructive"
      });
      setIsApplyingPromo(false);
    }
  });

  const handleUpdateQuantity = (itemId: string, quantity: number, item: any) => {
    // Validate quantity limits
    let maxAllowed = quantity;
    
    if (item.type === 'event') {
      // For events, limit to 6 tickets max per order and check availability
      maxAllowed = Math.min(6, quantity);
    } else if (item.type === 'merch') {
      // For merch, check stock availability (we'll need to add this validation)
      maxAllowed = quantity; // For now, but we should validate against stock
    }
    
    if (maxAllowed !== quantity) {
      toast({
        title: "Quantity limited",
        description: `Maximum ${maxAllowed} items allowed per order`,
        variant: "destructive"
      });
      return;
    }
    
    updateQuantityMutation.mutate({ itemId, quantity: maxAllowed });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    applyPromoMutation.mutate(promoCode.trim().toUpperCase());
  };

  const handleClearCart = () => {
    clearCartMutation.mutate();
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-16 pb-24 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-12">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view cart</h2>
            <p className="text-muted-foreground">Please sign in to access your shopping cart</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <Loading size="lg" text="Loading your cart..." />
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <Card className="text-center py-12">
            <CardContent>
              <h2 className="text-xl font-semibold mb-2">Error loading cart</h2>
              <p className="text-muted-foreground mb-4">Please try refreshing the page</p>
              <Button onClick={() => queryClient.invalidateQueries()}>Refresh</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const cartItems = cart?.items || [];
  const cartSummary = cart?.summary || { subtotal: 0, discount: 0, tax: 0, total: 0 };

  // Group items by type
  const groupedItems = cartItems.reduce((groups: any, item: any) => {
    if (!groups[item.type]) {
      groups[item.type] = [];
    }
    groups[item.type].push(item);
    return groups;
  }, {});

  // Calculate category subtotals
  const categorySubtotals = Object.keys(groupedItems).reduce((totals: any, type: string) => {
    totals[type] = groupedItems[type].reduce((sum: number, item: any) =>
      sum + (item.price * item.quantity), 0
    );
    return totals;
  }, {});

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <div className="max-w-2xl mx-auto">
            <Card className="text-center py-12">
              <CardContent>
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
                <p className="text-muted-foreground mb-6">
                  Discover amazing music, merchandise, and events to add to your cart
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/discover">
                    <Button>Discover Music</Button>
                  </Link>
                  <Link href="/merch">
                    <Button variant="outline">Shop Merch</Button>
                  </Link>
                  <Link href="/events">
                    <Button variant="outline">Browse Events</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">Shopping Cart</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your cart
              </p>
            </div>
            {cartItems.length > 0 && (
              <Button
                variant="outline"
                onClick={() => clearCartMutation.mutate()}
                disabled={clearCartMutation.isPending}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                data-testid="clear-cart"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {clearCartMutation.isPending ? "Clearing..." : "Clear Cart"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">
            {Object.keys(groupedItems).map((type: string) => (
              <div key={type} className="space-y-4">
                {/* Category Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-sm">
                      {type === 'merch' ? 'Merchandise' : type === 'event' ? 'Event Tickets' : type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {groupedItems[type].length} item{groupedItems[type].length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-sm font-medium">
                    Subtotal: ₹{categorySubtotals[type].toLocaleString()}
                  </div>
                </div>

                {/* Category Items */}
                <div className="space-y-3">
                  {groupedItems[type].map((item: any, index: number) => (
                    <Card key={item._id} data-testid={`cart-item-${type}-${index}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          {/* Item Image */}
                          <img
                            src={item.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"}
                            alt={item.name}
                            className="w-16 h-16 rounded-lg object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100";
                            }}
                          />

                          {/* Item Details */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{item.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {item.type === 'merch' ? `by ${item.artistName}` : item.artistName}
                                </p>
                                {item.type === 'merch' && (item.size || item.color) && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    {item.size && (
                                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                        Size: {item.size}
                                      </span>
                                    )}
                                    {item.color && (
                                      <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                        Color: {item.color}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {item.type === 'event' && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(item.eventDate).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground">{item.venue}</span>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveItem(item._id)}
                                disabled={removeItemMutation.isPending}
                                data-testid="remove-item"
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                              {/* Quantity Controls */}
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUpdateQuantity(item._id, item.quantity - 1, item)}
                                  disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                                  data-testid="decrease-quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <div className="h-7 w-14 border rounded-md flex items-center justify-center text-sm bg-background">
                                  {item.quantity}
                                </div>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    const maxLimit = item.type === 'event' ? 6 : 99; // Event limit of 6, merch limit of 99
                                    handleUpdateQuantity(item._id, Math.min(maxLimit, item.quantity + 1), item);
                                  }}
                                  disabled={updateQuantityMutation.isPending || (item.type === 'event' && item.quantity >= 6)}
                                  data-testid="increase-quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                {item.type === 'event' && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    Max: 6 tickets
                                  </span>
                                )}
                              </div>

                              {/* Price */}
                              <div className="text-right">
                                <div className="font-semibold text-sm">₹{(item.price * item.quantity).toLocaleString()}</div>
                                {item.quantity > 1 && (
                                  <div className="text-xs text-muted-foreground">
                                    ₹{item.price} each
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order Summary</span>
                  <Badge variant="outline" className="text-xs">
                    {cartItems.length} item{cartItems.length > 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Itemized Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Item Details</h4>

                  {Object.keys(groupedItems).map((type: string) => (
                    <div key={type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">
                          {type === 'merch' ? 'Merchandise' : type === 'event' ? 'Event Tickets' : type}
                        </span>
                        <span className="font-medium">₹{categorySubtotals[type].toLocaleString()}</span>
                      </div>

                      {/* Individual items in this category */}
                      <div className="ml-4 space-y-1">
                        {groupedItems[type].map((item: any) => (
                          <div key={item._id} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-[120px]">{item.name}</span>
                            <span>₹{(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Price Breakdown</h4>

                  <div className="flex justify-between text-sm">
                    <span>Subtotal (before tax)</span>
                    <span>₹{cartSummary.subtotal.toLocaleString()}</span>
                  </div>

                  {cartSummary.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount Applied</span>
                      <span>-₹{cartSummary.discount.toLocaleString()}</span>
                    </div>
                  )}

                  {/* GST Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>GST Calculation</span>
                      <span className="font-medium">₹{cartSummary.tax.toLocaleString()}</span>
                    </div>

                    <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>CGST (9%)</span>
                        <span>₹{(cartSummary.tax / 2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST (9%)</span>
                        <span>₹{(cartSummary.tax / 2).toFixed(2)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        GST @ 18% on ₹{(cartSummary.subtotal - cartSummary.discount).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Final Total */}
                <div className="space-y-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total Amount</span>
                    <span className="text-primary">₹{cartSummary.total.toLocaleString()}</span>
                  </div>

                  <div className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded">
                    <div>Inclusive of all taxes</div>
                    <div>Prices may vary based on location</div>
                  </div>
                </div>

                <Link href="/checkout">
                  <Button
                    className="w-full gradient-primary hover:opacity-90 text-white"
                    size="lg"
                    data-testid="proceed-to-checkout"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceed to Checkout
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Savings Summary */}
            {cartSummary.discount > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">Savings Applied</span>
                    </div>
                    <span className="text-sm font-semibold text-green-800">
                      ₹{cartSummary.discount.toLocaleString()} saved
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    You saved {((cartSummary.discount / (cartSummary.subtotal + cartSummary.discount)) * 100).toFixed(1)}% on this order
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Promo Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Promo Code</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleApplyPromo(); }} className="space-y-3">
                  <Input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    data-testid="promo-code-input"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={!promoCode.trim() || isApplyingPromo}
                    data-testid="apply-promo"
                  >
                    {isApplyingPromo ? (
                      <Loading size="sm" />
                    ) : (
                      "Apply Code"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Continue Shopping */}
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">Continue exploring</p>
                  <div className="flex space-x-2">
                    <Link href="/merch" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        More Merch
                      </Button>
                    </Link>
                    <Link href="/events" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        More Events
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
