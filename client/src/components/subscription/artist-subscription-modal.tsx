import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Music, Users, Heart, X } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface ArtistSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: string;
  artistName: string;
  artistAvatar?: string;
  currentSubscription?: any; // Current subscription if any
  subscriptionSettings?: {
    monthlyPrice: number;
    yearlyPrice: number;
    benefits: string[];
    isActive: boolean;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function ArtistSubscriptionModal({
  isOpen,
  onClose,
  artistId,
  artistName,
  artistAvatar,
  currentSubscription,
  subscriptionSettings
}: ArtistSubscriptionModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use subscription settings passed as props (from artist data) instead of separate API call
  const artistSubscriptionSettings = subscriptionSettings;

  // Create dynamic subscription plan
  const SUBSCRIPTION_PLAN = {
    id: "SUPPORTER",
    name: "Supporter",
    price: artistSubscriptionSettings?.monthlyPrice || 99,
    monthlyPrice: artistSubscriptionSettings?.monthlyPrice || 99,
    color: "bg-primary",
    icon: Star,
    benefits: artistSubscriptionSettings?.benefits || [
      "Support your favorite artist",
      "Access to subscriber-only content",
      "Direct interaction opportunities",
      "Early access to new releases",
      "Exclusive behind-the-scenes content"
    ]
  };

  // Load Razorpay script dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if script is already loaded
      if (window.Razorpay) {
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

  // Create subscription mutation
  const createSubscriptionMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      const response = await fetch("/api/commerce/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify({
          artistId,
          plan: "SUPPORTER",
          amount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create subscription");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${artistId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/subscription-status", artistId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/me"] });
      toast({
        title: "Subscription Created!",
        description: `Successfully subscribed to ${artistName}`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle Razorpay payment
  const handlePayment = async (amount: number) => {
    if (!user) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to subscribe",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Ensure Razorpay script is loaded
      const isRazorpayLoaded = await loadRazorpayScript();
      if (!isRazorpayLoaded) {
        toast({
          title: "Payment gateway error",
          description: "Failed to load payment gateway. Please try again.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Create order
      const orderResponse = await fetch("/api/subscriptions/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify({
          artistId,
          tier: "SUPPORTER",
          amount
        })
      });

      if (!orderResponse.ok) {
        throw new Error("Failed to create order");
      }

      const orderData = await orderResponse.json();

      // Initialize Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.razorpayOrder.amount,
        currency: orderData.razorpayOrder.currency,
        name: "Rise Up Creators",
        description: `Subscription - ${artistName}`,
        order_id: orderData.razorpayOrder.id,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await fetch("/api/subscriptions/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                subscriptionId: orderData.subscription._id
              })
            });

            if (verifyResponse.ok) {
              // Payment verified and subscription created successfully
              queryClient.invalidateQueries({ queryKey: [`/api/artists/${artistId}`] });
              queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
              queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/me"] });
              queryClient.invalidateQueries({ queryKey: ["/api/users/me/subscription-status", artistId] });
              queryClient.invalidateQueries({ queryKey: ["/api/orders/me"] });
              queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
              queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
              
              // Force a refetch of subscription status with no cache
              queryClient.refetchQueries({ queryKey: ["/api/users/me/subscription-status", artistId] });
              
              // Force refetch analytics to show updated revenue
              queryClient.refetchQueries({ queryKey: ["artistAnalytics"] });
              
              toast({
                title: "Subscription Created!",
                description: `Successfully subscribed to ${artistName}`,
              });
              onClose();
            } else {
              throw new Error("Payment verification failed");
            }
          } catch (error) {
            toast({
              title: "Payment Error",
              description: "Payment verification failed. Please contact support.",
              variant: "destructive",
            });
          }
          setIsProcessing(false);
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: "#3B82F6"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error("Payment initialization error:", error);
      toast({
        title: "Payment Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3 text-2xl">
            <img
              src={artistAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${artistName}`}
              alt={artistName}
              className="w-10 h-10 rounded-full"
            />
            <span>Subscribe to {artistName}</span>
          </DialogTitle>
        </DialogHeader>

        {currentSubscription && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Check className="w-5 h-5 text-green-600" />
                <span className="font-medium">
                  You're currently subscribed to {artistName}
                </span>
                <Badge className="bg-green-100 text-green-800">
                  Active until {new Date(currentSubscription.endDate).toLocaleDateString()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="text-center pb-4">
            <div className={`w-20 h-20 ${SUBSCRIPTION_PLAN.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Heart className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl">{SUBSCRIPTION_PLAN.name}</CardTitle>
            <div className="space-y-1">
              <div className="text-4xl font-bold text-primary">₹{SUBSCRIPTION_PLAN.price}</div>
              <div className="text-sm text-muted-foreground">/month</div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="text-center mb-6">
              <p className="text-muted-foreground">
                Support {artistName} and get access to exclusive content
              </p>
            </div>
            <ul className="space-y-3">
              {SUBSCRIPTION_PLAN.benefits.map((feature: string, index: number) => (
                <li key={index} className="flex items-start space-x-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                ₹{SUBSCRIPTION_PLAN.price}/month
              </div>
              <div className="text-sm text-muted-foreground">
                {SUBSCRIPTION_PLAN.name}
              </div>
            </div>
            <Button
              size="lg"
              className="gradient-primary"
              onClick={() => handlePayment(SUBSCRIPTION_PLAN.price)}
              disabled={isProcessing || createSubscriptionMutation.isPending}
            >
              {isProcessing ? (
                "Processing..."
              ) : currentSubscription ? (
                "Renew Subscription"
              ) : (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Subscribe Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}