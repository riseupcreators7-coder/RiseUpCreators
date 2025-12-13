import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Check, Star, Crown, Zap, Shield, Headphones, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    description: "Perfect for getting started",
    icon: Headphones,
    features: [
      "Listen to music",
      "Create playlists",
      "Follow artists",
      "Basic recommendations",
      "Limited skips per hour"
    ],
    limitations: [
      "Ads between songs",
      "Lower audio quality",
      "No offline downloads",
      "Limited customer support",
      "Cannot upload music"
    ],
    popular: false,
    buttonText: "Current Plan"
  },
  {
    id: "premium",
    name: "Premium",
    price: 199, // Will be updated dynamically
    period: "month",
    description: "The complete music experience",
    icon: Crown,
    features: [
      "Ad-free listening",
      "High-quality audio (320kbps)",
      "Offline downloads",
      "Unlimited skips",
      "Priority customer support",
      "Exclusive content access",
      "Early access to new releases"
    ],
    popular: true,
    buttonText: "Upgrade to Premium"
  },
  {
    id: "artist",
    name: "Artist Pro",
    price: 299, // Will be updated dynamically
    period: "month",
    description: "Unlock your creative potential",
    icon: Star,
    features: [
      "All Premium features",
      "Upload unlimited songs",
      "Advanced analytics dashboard",
      "Direct fan communication",
      "Merchandise store",
      "Event management tools",
      "Custom artist profile",
      "Revenue insights",
      "Fan engagement tools",
      "Priority distribution",
      "Become a creator"
    ],
    popular: false,
    buttonText: "Start Creating"
  }
];

export default function Plans() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch dynamic pricing from platform stats (public endpoint)
  const { data: platformStats } = useQuery({
    queryKey: ["/api/stats/platform"],
    queryFn: async () => {
      const response = await fetch("/api/stats/platform");
      if (!response.ok) throw new Error("Failed to fetch platform stats");
      return response.json();
    },
  });

  // Update plans with dynamic pricing
  const dynamicPlans = PLANS.map(plan => ({
    ...plan,
    price: plan.id === "premium" ? (platformStats?.pricing?.premiumPlanPrice || 199) :
           plan.id === "artist" ? (platformStats?.pricing?.artistProPlanPrice || 299) :
           plan.price
  }));
  const queryClient = useQueryClient();

  // Check for auto-select parameter from signup
  const urlParams = new URLSearchParams(window.location.search);
  const autoSelect = urlParams.get('autoSelect');
  const fromSignup = urlParams.get('fromSignup') === 'true';

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

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const token = localStorage.getItem('ruc_auth_token');
      const response = await fetch(`/api/users/me/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to initiate upgrade";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, use the status text
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: async (data, planId) => {
      // If it's a free plan, directly update
      if (planId === "free") {
        queryClient.invalidateQueries({ queryKey: ["user"] });
        toast({
          title: "Plan updated successfully!",
          description: `Welcome to ${PLANS.find(p => p.id === planId)?.name}!`,
        });
        setLocation("/home");
        return;
      }

      // For paid plans, ensure Razorpay script is loaded first
      const isRazorpayLoaded = await loadRazorpayScript();
      if (!isRazorpayLoaded) {
        toast({
          title: "Payment gateway error",
          description: "Failed to load payment gateway. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // For paid plans, initiate Razorpay payment
      if (data.orderId && data.key && window.Razorpay) {
        const options = {
          key: data.key,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          name: "Rise Up Creators",
          description: `Upgrade to ${PLANS.find(p => p.id === planId)?.name}`,
          handler: async function (response: any) {
            // Payment completed, verifying with backend...

            let verificationAttempts = 0;
            const maxVerificationAttempts = 3;

            const verifyPayment = async (): Promise<void> => {
              try {
                verificationAttempts++;
                // Payment verification attempt

                const token = localStorage.getItem('ruc_auth_token');
                const verifyResponse = await fetch("/api/users/me/upgrade/verify", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    orderId: response.razorpay_order_id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                    planId: data.planId,
                  }),
                });

                const verifyData = await verifyResponse.json();

                if (verifyResponse.status === 202) {
                  // Payment is still processing
                  if (verificationAttempts < maxVerificationAttempts) {
                    // Payment still processing, retrying in 3 seconds...
                    toast({
                      title: "Processing payment...",
                      description: "Please wait while we verify your payment.",
                    });
                    setTimeout(verifyPayment, 3000);
                    return;
                  } else {
                    throw new Error("Payment verification is taking longer than expected. Please check your payment status in a few minutes.");
                  }
                }

                if (!verifyResponse.ok) {
                  const errorMessage = verifyData.message || "Payment verification failed";
                  throw new Error(errorMessage);
                }

                // Payment successful
                // Payment verification successful

                // Update user data in localStorage if new token provided
                if (verifyData.token) {
                  localStorage.setItem("ruc_auth_token", verifyData.token);
                  if (verifyData.user) {
                    localStorage.setItem("ruc_user_data", JSON.stringify(verifyData.user));
                  }
                }

                queryClient.invalidateQueries({ queryKey: ["user"] });

                // Special message for ARTIST plan upgrade
                const successMessage = data.planId === "ARTIST"
                  ? "Congratulations! You're now a creator. Welcome to the Artist Pro plan!"
                  : `Welcome to ${PLANS.find(p => p.id === data.planId.toLowerCase())?.name}!`;

                toast({
                  title: "Plan upgraded successfully!",
                  description: successMessage,
                });

                // Redirect to creator dashboard for new artists
                if (data.planId === "ARTIST") {
                  setLocation("/creator");
                } else {
                  setLocation("/home");
                }

              } catch (error: any) {
                // Payment verification error

                // Handle different error types
                let errorTitle = "Payment verification failed";
                let errorDescription = error.message;

                if (error.message?.includes("network") || error.message?.includes("fetch")) {
                  errorTitle = "Network error";
                  errorDescription = "Please check your internet connection and try again.";
                } else if (error.message?.includes("timeout")) {
                  errorTitle = "Verification timeout";
                  errorDescription = "Payment verification is taking longer than expected. Please check your payment status in a few minutes.";
                } else if (verificationAttempts >= maxVerificationAttempts) {
                  errorTitle = "Verification failed";
                  errorDescription = "Unable to verify payment after multiple attempts. Please contact support if you were charged.";
                }

                toast({
                  title: errorTitle,
                  description: errorDescription,
                  variant: "destructive",
                });

                // If this is the last attempt and payment might have succeeded, suggest checking status
                if (verificationAttempts >= maxVerificationAttempts) {
                  setTimeout(() => {
                    toast({
                      title: "Need help?",
                      description: "If you were charged but didn't receive your plan, please contact our support team.",
                      duration: 10000,
                    });
                  }, 3000);
                }
              }
            };

            // Start verification process
            await verifyPayment();
          },
          prefill: {
            name: user?.name,
            email: user?.email,
          },
          theme: {
            color: "#7c3aed",
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast({
          title: "Payment service unavailable",
          description: "Payment gateway is not configured. Please contact support.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-upgrade to artist plan if coming from signup
  useEffect(() => {
    if (autoSelect === 'artist' && user && !upgradeMutation.isPending) {
      // Clear the URL parameter to prevent re-triggering
      window.history.replaceState({}, document.title, window.location.pathname);

      // Show different messages for signup vs. upgrade
      if (fromSignup) {
        toast({
          title: "🎵 Welcome to Rise Up Creators!",
          description: "You're almost ready to start creating! Complete your Artist Pro subscription below to unlock all creator features.",
          duration: 8000,
        });
      } else {
        toast({
          title: "Upgrade to Artist Pro",
          description: "Complete your Artist Pro subscription to unlock creator features and start uploading music.",
        });
      }

      // Auto-trigger artist plan upgrade after a short delay
      setTimeout(() => {
        handleUpgrade('artist');
      }, 2000);
    }
  }, [autoSelect, user, upgradeMutation.isPending, fromSignup]);

  const handleUpgrade = (planId: string) => {
    if (!user) {
      setLocation("/auth/login");
      return;
    }

    if (planId === "free") {
      return; // Already on free plan
    }

    upgradeMutation.mutate(planId);
  };

  const currentPlan = user?.plan?.type?.toLowerCase() || "free";

  // Map uppercase plan types to lowercase for comparison
  const planTypeMap = {
    FREE: "free",
    PREMIUM: "premium",
    ARTIST: "artist"
  };

  return (
    <div className="min-h-screen pt-16 pb-16">
      <div className="container-custom py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {fromSignup && autoSelect === 'artist' ? 'Complete Your Artist Setup' : 'Choose Your Plan'}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {fromSignup && autoSelect === 'artist'
              ? 'One final step to unlock your creator dashboard and start uploading music!'
              : 'Unlock the full potential of Rise Up Creators with our premium plans'
            }
          </p>
          {fromSignup && autoSelect === 'artist' && (
            <div className="mt-6 bg-primary/10 border border-primary/20 rounded-lg p-4 max-w-lg mx-auto">
              <p className="text-primary font-medium">🎵 Artist Pro Plan Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete your subscription to access unlimited uploads, analytics, and all creator features.
              </p>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {dynamicPlans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentPlan === plan.id;
            const isPopular = plan.popular;

            return (
              <Card
                key={plan.id}
                className={`relative ${
                  isPopular
                    ? "border-primary shadow-lg scale-105"
                    : isCurrentPlan
                    ? "border-success"
                    : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-success text-white px-4 py-1">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-full ${
                      isPopular ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <Icon className={`w-8 h-8 ${
                        isPopular ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                  </div>

                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>

                  <div className="text-3xl font-bold mb-2">
                    {plan.price === 0 ? (
                      "Free"
                    ) : (
                      <>
                        ₹{plan.price}
                        <span className="text-lg font-normal text-muted-foreground">
                          /{plan.period}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm uppercase tracking-wide">
                      What's Included
                    </h4>
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Limitations (for free plan) */}
                  {plan.limitations && (
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                        Limitations
                      </h4>
                      {plan.limitations.map((limitation, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-4 h-4 rounded-full bg-muted flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">
                            {limitation}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Button */}
                  <div className="pt-6">
                    <Button
                      className={`w-full ${
                        isCurrentPlan
                          ? "bg-muted text-muted-foreground cursor-not-allowed"
                          : isPopular
                          ? "bg-primary hover:bg-primary/90"
                          : ""
                      }`}
                      variant={isPopular ? "default" : "outline"}
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isCurrentPlan || upgradeMutation.isPending}
                    >
                      {upgradeMutation.isPending
                        ? "Processing..."
                        : isCurrentPlan
                        ? "Current Plan"
                        : plan.buttonText
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time.
                  Changes take effect immediately for upgrades, or at the end of your billing cycle for downgrades.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We accept all major credit cards, debit cards, UPI, net banking,
                  and digital wallets through our secure Razorpay integration.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We offer a 7-day free trial for Premium plans. No credit card required to start.
                  Cancel anytime during the trial period.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I cancel my subscription?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Absolutely! You can cancel your subscription at any time from your account settings.
                  You'll continue to have access until the end of your billing period.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
              Join thousands of artists and fans who are already creating and discovering amazing music on Rise Up Creators.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="gradient-primary text-primary-foreground px-8 py-4 rounded-2xl font-semibold text-lg"
                onClick={() => handleUpgrade("premium")}
              >
                <Zap className="w-5 h-5 mr-2" />
                Start Free Trial
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-4 rounded-2xl font-semibold text-lg"
                onClick={() => setLocation("/")}
              >
                <Headphones className="w-5 h-5 mr-2" />
                Explore Music
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
