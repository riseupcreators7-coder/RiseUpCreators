import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

interface CartItem {
  _id: string;
  type: "merch" | "event";
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  artistName?: string;
  eventDate?: string;
  venue?: string;
}

interface CartSummary {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

interface Cart {
  items: CartItem[];
  summary: CartSummary;
  appliedPromoCode?: string;
}

export default function Cart() {
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch cart data
  const { data: cart, isLoading } = useQuery<Cart>({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      const response = await fetch("/api/cart", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch cart");
      return response.json();
    },
    enabled: !!user,
  });

  // Update cart item mutation
  const updateCartMutation = useMutation({
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
        description: "Failed to update cart",
        variant: "destructive"
      });
    }
  });

  // Remove cart item mutation
  const removeCartMutation = useMutation({
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
        description: "Failed to remove item",
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
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to apply promo code");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Promo code applied",
        description: data.message
      });
      setPromoCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Invalid promo code",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Remove promo code mutation
  const removePromoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/promo", {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to remove promo code");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Promo code removed",
        description: "Promo code has been removed"
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
        description: "All items removed from cart"
      });
    }
  });

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateCartMutation.mutate({ itemId, quantity: newQuantity });
  };

  const handleRemoveItem = (itemId: string) => {
    removeCartMutation.mutate(itemId);
  };

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    applyPromoMutation.mutate(promoCode.trim().toUpperCase());
    setIsApplyingPromo(false);
  };

  const handleCheckout = () => {
    // Navigate to checkout page
    setLocation("/checkout");
  };

  if (!user) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign in to view cart</h3>
          <p className="text-muted-foreground">Please sign in to access your shopping cart</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Loading size="lg" text="Loading cart..." />;
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
          <p className="text-muted-foreground mb-4">Add some items to get started</p>
          <Button onClick={() => setLocation("/merch")}>
            Browse Merchandise
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shopping Cart</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">{cart.items.length} items</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearCartMutation.mutate()}
            disabled={clearCartMutation.isPending}
          >
            {clearCartMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Clear Cart
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={item.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=100"}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.artistName && (
                      <p className="text-sm text-muted-foreground">by {item.artistName}</p>
                    )}
                    {item.type === "event" && item.eventDate && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.eventDate).toLocaleDateString()} • {item.venue}
                      </p>
                    )}
                    <p className="text-lg font-bold text-primary">₹{item.price}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(item._id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || updateCartMutation.isPending}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    
                    <span className="w-12 text-center font-medium">{item.quantity}</span>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(item._id, item.quantity + 1)}
                      disabled={updateCartMutation.isPending}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">₹{item.price * item.quantity}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item._id)}
                      disabled={removeCartMutation.isPending}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cart Summary */}
        <div className="space-y-4">
          {/* Promo Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="w-5 h-5 mr-2" />
                Promo Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.appliedPromoCode ? (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="font-medium text-green-800">{cart.appliedPromoCode}</p>
                    <p className="text-sm text-green-600">
                      Discount: ₹{cart.summary.discount}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePromoMutation.mutate()}
                    disabled={removePromoMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="space-y-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    disabled={isApplyingPromo || applyPromoMutation.isPending}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!promoCode.trim() || isApplyingPromo || applyPromoMutation.isPending}
                  >
                    {applyPromoMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Tag className="w-4 h-4 mr-2" />
                    )}
                    Apply Code
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{cart.summary.subtotal}</span>
              </div>
              
              {cart.summary.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-₹{cart.summary.discount}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Tax (18% GST)</span>
                <span>₹{cart.summary.tax}</span>
              </div>
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">₹{cart.summary.total}</span>
              </div>

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.items.length === 0}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
