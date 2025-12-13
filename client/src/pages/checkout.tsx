import { useState, useEffect } from "react";
import { CreditCard, Lock, MapPin, User, Phone, Mail, ArrowLeft, CheckCircle, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import Loading from "@/components/common/loading";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const checkoutSchema = z.object({
  // Billing Information
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),

  // Shipping Address (optional here) - enforced only when merch is present
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const auth = useRequireAuth();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [serviceabilityStatus, setServiceabilityStatus] = useState<{
    isChecking: boolean;
    isServiceable: boolean | null;
    estimatedDays: number | null;
    message: string;
  }>({
    isChecking: false,
    isServiceable: null,
    estimatedDays: null,
    message: "",
  });
  const queryClient = useQueryClient();

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: auth.user?.name || "",
      email: auth.user?.email || "",
      phone: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
    },
    mode: "onChange"
  });

  

  // Fetch cart data
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ["/api/cart"],
    enabled: !!auth.user,
    staleTime: 30 * 1000,
  });

  const cartItems = (cartData as any)?.items || [];
  const cartSummary = (cartData as any)?.summary || { subtotal: 0, discount: 0, tax: 0, total: 0 };

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

  // Check serviceability mutation
  const checkServiceabilityMutation = useMutation({
    mutationFn: async (pincode: string) => {
      const response = await fetch("/api/check-serviceability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ pincode })
      });
      if (!response.ok) throw new Error("Failed to check serviceability");
      return response.json();
    },
    onMutate: () => {
      setServiceabilityStatus({
        isChecking: true,
        isServiceable: null,
        estimatedDays: null,
        message: "Checking delivery availability...",
      });
    },
    onSuccess: (data) => {
      setServiceabilityStatus({
        isChecking: false,
        isServiceable: data.serviceable,
        estimatedDays: data.estimatedDeliveryDays,
        message: data.serviceable 
          ? `Delivery available in ${data.estimatedDeliveryDays} business days`
          : "Delivery not available to this location",
      });
    },
    onError: () => {
      setServiceabilityStatus({
        isChecking: false,
        isServiceable: false,
        message: "Unable to check delivery availability",
        estimatedDays: null,
      });
    }
  });

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(paymentData)
      });
      if (!response.ok) throw new Error("Payment verification failed");
      return response.json();
    },
    onSuccess: () => {
      setPaymentSuccess(true);
      toast({
        title: "Payment successful!",
        description: "Your order has been confirmed."
      });

      // Clear cart and redirect after 3 seconds
      setTimeout(() => {
        setLocation("/dashboard?tab=orders");
      }, 3000);
    },
    onError: () => {
      toast({
        title: "Payment verification failed",
        description: "Please contact support if amount was debited.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    }
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(orderData)
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
    onSuccess: async (data) => {
      await initializePayment(data.order, data.razorpayOrder);
    },
    onError: (error) => {
      toast({
        title: "Order failed",
        description: "Failed to create order. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  // Load Razorpay script dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if script is already loaded
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  };

  const initializePayment = async (order: any, razorpayOrder: any) => {
    // Ensure Razorpay script is loaded
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      toast({
        title: "Payment gateway error",
        description: "Failed to load payment gateway. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_RBrm0Lx0fWj5Rz",
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      name: "Rise Up Creators",
      description: `Order #${order._id.slice(-6)}`,
      order_id: razorpayOrder.id,
      handler: async (response: any) => {
        try {
          // Verify payment
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
            },
            body: JSON.stringify({
              orderId: razorpayOrder.id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              orderDbId: order._id
            })
          });

          if (verifyResponse.ok) {
            // Clear the cart after successful payment
            await fetch("/api/cart/clear", {
              method: "DELETE",
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
              }
            });

            setPaymentSuccess(true);
            toast({
              title: "Payment successful!",
              description: "Your order has been confirmed."
            });

            // Invalidate orders query to refresh dashboard
            queryClient.invalidateQueries({ queryKey: ["/api/orders/me"] });

            // Clear cart and redirect after 3 seconds
            setTimeout(() => {
              setLocation("/dashboard?tab=orders");
            }, 3000);
          } else {
            throw new Error("Payment verification failed");
          }
        } catch (error) {
          toast({
            title: "Payment verification failed",
            description: "Please contact support if amount was debited.",
            variant: "destructive"
          });
        } finally {
          setIsProcessing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setIsProcessing(false);
          toast({
            title: "Payment cancelled",
            description: "Your order was not completed.",
          });
        }
      },
      prefill: {
        name: form.getValues("fullName"),
        email: form.getValues("email"),
        contact: form.getValues("phone"),
      },
      theme: {
        color: "#FF3C2A"
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    applyPromoMutation.mutate(promoCode.trim().toUpperCase());
  };

  // Debounced pincode check
  useEffect(() => {
    const pincode = form.watch("pincode");
    
    if (pincode && pincode.length >= 6) {
      const timeoutId = setTimeout(() => {
        // Only check if we have merch items that need shipping
        const hasMerch = cartItems?.some((item: any) => item.type === 'merch');
        if (hasMerch) {
          checkServiceabilityMutation.mutate(pincode);
        }
      }, 500); // Debounce by 500ms

      return () => clearTimeout(timeoutId);
    } else {
      setServiceabilityStatus({
        isChecking: false,
        isServiceable: null,
        estimatedDays: null,
        message: "",
      });
    }
  }, [form.watch("pincode"), cartItems]);

  const handleSubmit = (data: CheckoutForm) => {
    if (!cartItems?.length) {
      toast({
        title: "Cart is empty",
        description: "Please add items to cart before checkout.",
        variant: "destructive"
      });
      return;
    }

    // Check serviceability for merch orders and require address when merch exists
    const hasMerch = cartItems.some((item: any) => item.type === 'merch');
    if (hasMerch) {
      // Ensure shipping address fields are provided
      if (!data.address || !data.city || !data.state || !data.pincode) {
        toast({
          title: "Address required",
          description: "Please provide a shipping address for merchandise orders.",
          variant: "destructive"
        });
        return;
      }

      if (serviceabilityStatus.isServiceable === false) {
        toast({
          title: "Delivery not available",
          description: "We cannot deliver to this pincode. Please check your address.",
          variant: "destructive"
        });
        return;
      }

      if (serviceabilityStatus.isServiceable === null) {
        toast({
          title: "Please wait",
          description: "Checking delivery availability for your pincode...",
          variant: "destructive"
        });
        return;
      }
    }

    setIsProcessing(true);

    // Determine order type based on cart items
    let orderType = "MERCH";
    const hasTickets = cartItems.some((item: any) => item.type === 'event');

    if (hasTickets && hasMerch) {
      orderType = "MIXED";
    } else if (hasTickets) {
      orderType = "TICKET";
    } else {
      orderType = "MERCH";
    }

    const baseOrder: any = {
      type: orderType,
      items: cartItems.map((item: any) => ({
        [item.type === 'merch' ? 'merchId' : 'eventId']: item.id,
        qty: item.quantity,
        unitPrice: item.price,
        size: item.size,
        color: item.color,
        name: item.name,
        image: item.image
      })),
      totalAmount: cartSummary.total,
      currency: "INR",
    };

    if (hasMerch) {
      baseOrder.shippingAddress = {
        name: data.fullName,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        phone: data.phone
      };
    }

    createOrderMutation.mutate(baseOrder);
  };

  if (auth.isLoading || cartLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading checkout..." />
      </div>
    );
  }

  if (!auth.user) {
    return null;
  }

  const hasPhysicalItems = cartItems.some((item: any) => item.type === 'merch');

  // Redirect if cart is empty
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <Card className="text-center py-12 max-w-md mx-auto">
            <CardContent>
              <CreditCard className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Cart is empty</h3>
              <p className="text-muted-foreground mb-6">
                Please add items to your cart before checkout.
              </p>
              <Link href="/merch">
                <Button>Browse Products</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <Card className="text-center py-12 max-w-md mx-auto">
            <CardContent>
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
              <p className="text-muted-foreground mb-6">
                Your order has been confirmed. You will receive an email confirmation shortly.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to your orders...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="mb-6 md:mb-8">
          <Link href="/cart">
            <Button variant="ghost" className="mb-4" data-testid="back-to-cart">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cart
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-sm md:text-base text-muted-foreground">Complete your order securely</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={form.handleSubmit((data) => handleSubmit(data))} className="space-y-6">
              {/* Contact Information */}
              <Card className="border border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <User className="w-5 h-5 mr-2" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-foreground">Full Name *</Label>
                      <Input
                        id="fullName"
                        {...form.register("fullName")}
                        className="bg-input text-foreground border-border"
                        data-testid="full-name-input"
                      />
                      {form.formState.errors.fullName && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.fullName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-foreground">Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        {...form.register("phone")}
                        className="bg-input text-foreground border-border"
                        data-testid="phone-input"
                      />
                      {form.formState.errors.phone && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.phone.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register("email")}
                      className="bg-input text-foreground border-border"
                      data-testid="email-input"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Address - only required and shown when cart contains merch */}
              {hasPhysicalItems ? (
                <Card className="border border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center text-foreground">
                      <MapPin className="w-5 h-5 mr-2" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-foreground">Address *</Label>
                      <Input
                        id="address"
                        {...form.register("address")}
                        placeholder="Street address, apartment, suite, etc."
                        className="bg-input text-foreground border-border"
                        data-testid="address-input"
                      />
                      {form.formState.errors.address && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.address.message}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-foreground">City *</Label>
                        <Input
                          id="city"
                          {...form.register("city")}
                          className="bg-input text-foreground border-border"
                          data-testid="city-input"
                        />
                        {form.formState.errors.city && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.city.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-foreground">State *</Label>
                        <Input
                          id="state"
                          {...form.register("state")}
                          className="bg-input text-foreground border-border"
                          data-testid="state-input"
                        />
                        {form.formState.errors.state && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.state.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pincode" className="text-foreground">Pincode *</Label>
                        <div className="relative">
                          <Input
                            id="pincode"
                            {...form.register("pincode")}
                            className="bg-input text-foreground border-border"
                            data-testid="pincode-input"
                            placeholder="Enter 6-digit pincode"
                          />
                          {serviceabilityStatus.isChecking && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                            </div>
                          )}
                        </div>
                        {form.formState.errors.pincode && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.pincode.message}
                          </p>
                        )}
                        {serviceabilityStatus.message && !serviceabilityStatus.isChecking && (
                          <div className="flex items-center gap-2 mt-2">
                            {serviceabilityStatus.isServiceable === true && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <Truck className="w-3 h-3 mr-1" />
                                {serviceabilityStatus.message}
                              </Badge>
                            )}
                            {serviceabilityStatus.isServiceable === false && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <X className="w-3 h-3 mr-1" />
                                {serviceabilityStatus.message}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border bg-card">
                  <CardContent>
                    <p className="text-sm text-muted-foreground">No shipping address is required for ticket-only orders. You will receive tickets via email.</p>
                  </CardContent>
                </Card>
              )}

              {/* Payment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lock className="w-5 h-5 mr-2" />
                    Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Lock className="w-4 h-4 text-success" />
                      <span className="text-muted-foreground">
                        Your payment information is secure and encrypted
                      </span>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full gradient-primary hover:opacity-90 text-white"
                      size="lg"
                      disabled={
                        isProcessing || 
                        createOrderMutation.isPending ||
                        (cartItems?.some((item: any) => item.type === 'merch') && serviceabilityStatus.isServiceable === false) ||
                        (cartItems?.some((item: any) => item.type === 'merch') && serviceabilityStatus.isChecking)
                      }
                      data-testid="complete-order-button"
                    >
                      {isProcessing || createOrderMutation.isPending ? (
                        <>
                          <Loading size="sm" />
                          Processing...
                        </>
                      ) : serviceabilityStatus.isChecking ? (
                        <>
                          <Loading size="sm" />
                          Checking delivery...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Complete Order - ₹{cartSummary.total.toLocaleString()}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      <Lock className="w-3 h-3 inline mr-1" />
                      Secure payment powered by Razorpay
                    </p>
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Items */}
                <div className="space-y-3">
                  {cartItems.map((item: any, index: number) => (
                    <div key={item._id} className="flex items-center space-x-3">
                      <img
                        src={item.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60"}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60";
                        }}
                      />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium truncate">{item.name}</h4>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Qty: {item.quantity}</p>
                          {(item.size || item.color) && (
                            <div className="flex flex-wrap gap-1">
                              {item.size && (
                                <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">
                                  {item.size}
                                </span>
                              )}
                              {item.color && (
                                <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">
                                  {item.color}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{cartSummary.subtotal.toLocaleString()}</span>
                  </div>

                  {cartSummary.discount > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Discount</span>
                      <span>-₹{cartSummary.discount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>₹{cartSummary.tax.toLocaleString()}</span>
                  </div>

                  {hasPhysicalItems && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>₹0</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-primary">₹{cartSummary.total.toLocaleString()}</span>
                </div>

                {/* Promo Code */}
                <Card className="mt-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Have a promo code?</CardTitle>
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

                {/* Security Notice */}
                <div className="bg-muted/50 rounded-lg p-3 mt-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <Lock className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">
                      Your payment information is secure and encrypted
                    </span>
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
