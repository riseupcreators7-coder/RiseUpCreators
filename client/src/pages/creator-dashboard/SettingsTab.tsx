import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Shield, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import type { ArtistProfile } from "./types";
import { createSafeArtistProfile, getCreatorAuthHeaders } from "./utils";
import { useState, useEffect } from "react";

interface BankDetails {
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  bankName?: string;
  phoneNumber?: string;
  panNumber?: string;
  aadharNumber?: string;
  verified?: boolean;
}

interface SubscriptionSettings {
  monthlyPrice: number;
  yearlyPrice: number;
  benefits: string[];
  isActive: boolean;
}

// ---------- COMPONENT ----------
export default function SettingsTab() {
  const auth = useRequireRole("artist");
  const [isBankFormOpen, setIsBankFormOpen] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    bankName: "",
    phoneNumber: "",
    panNumber: "",
    aadharNumber: ""
  });
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>({
    monthlyPrice: 99,
    yearlyPrice: 999,
    benefits: ["Exclusive content", "Early access", "Direct messaging"],
    isActive: true
  });

  // Artist profile form state
  const [artistProfileData, setArtistProfileData] = useState({
    bio: "",
    instagram: "",
    youtube: "",
    website: "",
    x: ""
  });

  const queryClient = useQueryClient();

  // ---------- QUERIES ----------
  const { data: artistProfile } = useQuery({
    queryKey: ["artistProfile"],
    queryFn: () => fetch("/api/artists/profile", {
      headers: getCreatorAuthHeaders()
    }).then(res => res.json()),
    enabled: !!auth.user,
  });

  // Fetch current bank details
  const { data: bankDetails, isLoading: bankDetailsLoading } = useQuery<BankDetails>({
    queryKey: ["/api/users/me/bank-details"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/bank-details", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch bank details");
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Fetch current subscription settings
  const { data: currentSubscriptionSettings, isLoading: subscriptionSettingsLoading } = useQuery<SubscriptionSettings>({
    queryKey: ["/api/artists/subscription-settings"],
    queryFn: async () => {
      const response = await fetch("/api/artists/subscription-settings", {
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` }
      });
      if (!response.ok) throw new Error("Failed to fetch subscription settings");
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Save subscription settings mutation
  const saveSubscriptionSettingsMutation = useMutation({
    mutationFn: async (settings: SubscriptionSettings) => {
      const response = await fetch("/api/artists/subscription-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error("Failed to save subscription settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists/subscription-settings"] });
      // Invalidate artist profile cache so fans see updated prices
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${auth.user?._id}`] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      toast({
        title: "Success",
        description: "Subscription settings saved successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save subscription settings",
        variant: "destructive"
      });
    }
  });

  // Save artist profile mutation
  const saveArtistProfileMutation = useMutation({
    mutationFn: async (profileData: typeof artistProfileData) => {
      const response = await fetch("/api/artists/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify({
          bio: profileData.bio,
          socialLinks: {
            instagram: profileData.instagram,
            youtube: profileData.youtube,
            website: profileData.website,
            x: profileData.x
          }
        })
      });
      if (!response.ok) throw new Error("Failed to save artist profile");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/settings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/artists/${auth.user?._id}`] });
      toast({
        title: "Success",
        description: "Artist profile saved successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save artist profile",
        variant: "destructive"
      });
    }
  });
  const saveBankDetailsMutation = useMutation({
    mutationFn: async (details: typeof bankFormData) => {
      const response = await fetch("/api/users/me/bank-details", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`
        },
        body: JSON.stringify(details)
      });
      if (!response.ok) throw new Error("Failed to save bank details");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/bank-details"] });
      toast({
        title: "Success",
        description: "Bank details saved successfully"
      });
      setIsBankFormOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save bank details",
        variant: "destructive"
      });
    }
  });

  // Update subscription settings when data is loaded
  useEffect(() => {
    if (currentSubscriptionSettings) {
      setSubscriptionSettings(prev => ({ ...prev, ...currentSubscriptionSettings }));
    }
  }, [currentSubscriptionSettings]);

  // Update artist profile form when data is loaded
  useEffect(() => {
    if (artistProfile) {
      const safeProfile = createSafeArtistProfile(artistProfile, auth.user);
      setArtistProfileData({
        bio: safeProfile.bio,
        instagram: safeProfile.socialLinks.instagram,
        youtube: safeProfile.socialLinks.youtube,
        website: safeProfile.socialLinks.website,
        x: safeProfile.socialLinks.x
      });
    }
  }, [artistProfile, auth.user]);

  const handleSaveSubscriptionSettings = () => {
    saveSubscriptionSettingsMutation.mutate(subscriptionSettings);
  };

  const handleSaveArtistProfile = () => {
    saveArtistProfileMutation.mutate(artistProfileData);
  };

  const handleBankFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!bankFormData.accountNumber || !bankFormData.ifscCode || !bankFormData.accountHolderName ||
        !bankFormData.phoneNumber || !bankFormData.panNumber || !bankFormData.aadharNumber) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankFormData.ifscCode)) {
      toast({
        title: "Invalid IFSC Code",
        description: "Please enter a valid IFSC code",
        variant: "destructive"
      });
      return;
    }

    // Validate phone number format
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(bankFormData.phoneNumber)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive"
      });
      return;
    }

    // Validate PAN number format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(bankFormData.panNumber)) {
      toast({
        title: "Invalid PAN Number",
        description: "Please enter a valid PAN number (e.g., ABCDE1234F)",
        variant: "destructive"
      });
      return;
    }

    // Validate Aadhar number format
    const aadharRegex = /^[0-9]{12}$/;
    if (!aadharRegex.test(bankFormData.aadharNumber)) {
      toast({
        title: "Invalid Aadhar Number",
        description: "Please enter a valid 12-digit Aadhar number",
        variant: "destructive"
      });
      return;
    }

    saveBankDetailsMutation.mutate(bankFormData);
  };

  const handleEditBankDetails = () => {
    if (bankDetails) {
      setBankFormData({
        accountNumber: bankDetails.accountNumber || "",
        ifscCode: bankDetails.ifscCode || "",
        accountHolderName: bankDetails.accountHolderName || "",
        bankName: bankDetails.bankName || "",
        phoneNumber: bankDetails.phoneNumber || "",
        panNumber: bankDetails.panNumber || "",
        aadharNumber: bankDetails.aadharNumber || ""
      });
    }
    setIsBankFormOpen(true);
  };

  return (
    <TabsContent value="settings">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Artist Profile</CardTitle>
            <p className="text-sm text-muted-foreground">
              Update your public artist information
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={artistProfileData.bio}
                onChange={(e) => setArtistProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell fans about yourself..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={artistProfileData.instagram}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, instagram: e.target.value }))}
                  placeholder="https://instagram.com/username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={artistProfileData.youtube}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, youtube: e.target.value }))}
                  placeholder="https://youtube.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={artistProfileData.website}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://yourwebsite.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="x">X (Twitter)</Label>
                <Input
                  id="x"
                  value={artistProfileData.x}
                  onChange={(e) => setArtistProfileData(prev => ({ ...prev, x: e.target.value }))}
                  placeholder="https://x.com/username"
                />
              </div>
            </div>

            <Button 
              className="bg-primary hover:bg-primary/80"
              onClick={handleSaveArtistProfile}
              disabled={saveArtistProfileMutation.isPending}
            >
              {saveArtistProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Subscription Pricing
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Set your subscription price and manage fan support tiers
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="monthly-price">Monthly Price (₹) *</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min="1"
                  max="10000"
                  value={subscriptionSettings.monthlyPrice}
                  onChange={(e) => setSubscriptionSettings(prev => ({ 
                    ...prev, 
                    monthlyPrice: parseInt(e.target.value) || 99 
                  }))}
                  placeholder="Enter monthly subscription price"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Price fans will pay monthly to support you
                </p>
              </div>

              <div>
                <Label htmlFor="yearly-price">Yearly Price (₹) *</Label>
                <Input
                  id="yearly-price"
                  type="number"
                  min="1"
                  max="100000"
                  value={subscriptionSettings.yearlyPrice}
                  onChange={(e) => setSubscriptionSettings(prev => ({ 
                    ...prev, 
                    yearlyPrice: parseInt(e.target.value) || 999 
                  }))}
                  placeholder="Enter yearly subscription price"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Discounted price for yearly subscribers
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="subscription-active">Enable Subscriptions</Label>
                <p className="text-sm text-muted-foreground">
                  Allow fans to subscribe to your content
                </p>
              </div>
              <Switch
                id="subscription-active"
                checked={subscriptionSettings.isActive}
                onCheckedChange={(checked) => setSubscriptionSettings(prev => ({ 
                  ...prev, 
                  isActive: checked 
                }))}
              />
            </div>

            <div>
              <Label htmlFor="tier-benefits">Benefits (one per line)</Label>
              <Textarea
                id="tier-benefits"
                rows={4}
                value={subscriptionSettings.benefits?.join('\n') || ''}
                onChange={(e) => setSubscriptionSettings(prev => ({ 
                  ...prev, 
                  benefits: e.target.value.split('\n').filter(b => b.trim()) 
                }))}
                placeholder="Exclusive content&#10;Early access to music&#10;Direct messaging&#10;Monthly live sessions"
              />
              <p className="text-sm text-muted-foreground mt-1">
                What benefits will subscribers get?
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Pricing Preview</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Monthly subscriber pays:</span>
                  <span className="font-medium">₹{subscriptionSettings.monthlyPrice}/month</span>
                </div>
                <div className="flex justify-between">
                  <span>Yearly subscriber pays:</span>
                  <span className="font-medium">₹{subscriptionSettings.yearlyPrice}/year</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (10%):</span>
                  <span>₹{Math.round(subscriptionSettings.monthlyPrice * 0.1)}/month</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>You receive (monthly):</span>
                  <span className="text-green-600">₹{Math.round(subscriptionSettings.monthlyPrice * 0.9)}/month</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>You receive (yearly):</span>
                  <span className="text-green-600">₹{Math.round(subscriptionSettings.yearlyPrice * 0.9)}/year</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSaveSubscriptionSettings}
              disabled={saveSubscriptionSettingsMutation.isPending}
              className="bg-primary hover:bg-primary/80"
            >
              {saveSubscriptionSettingsMutation.isPending ? "Saving..." : "Save Subscription Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Bank Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Bank Account Details
              {bankDetails?.verified ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : bankDetails?.accountNumber ? (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Pending Verification
                </Badge>
              ) : (
                <Badge variant="destructive">Not Added</Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add your bank account details to receive payouts from your earnings
            </p>
          </CardHeader>
          <CardContent>
            {bankDetailsLoading ? (
              <div>Loading bank details...</div>
            ) : bankDetails && bankDetails.accountNumber ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Account Holder</Label>
                    <p className="font-medium">{bankDetails.accountHolderName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Bank Name</Label>
                    <p className="font-medium">{bankDetails.bankName || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Account Number</Label>
                    <p className="font-mono">
                      {bankDetails.accountNumber?.replace(/\d(?=\d{4})/g, "*") || "****"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">IFSC Code</Label>
                    <p className="font-mono">{bankDetails.ifscCode}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                    <p className="font-mono">{bankDetails.phoneNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PAN Number</Label>
                    <p className="font-mono">{bankDetails.panNumber?.replace(/(?<=^.{2}).*(?=.{2}$)/g, "*****") || "********"}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Aadhar Number</Label>
                    <p className="font-mono">{bankDetails.aadharNumber?.replace(/\d(?=\d{4})/g, "*") || "************"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
                  <Button onClick={handleEditBankDetails} variant="outline">
                    Edit Details
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    Your bank details are encrypted and secure
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Add Bank Details</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your bank account details to receive payouts from your earnings
                </p>
                <Button onClick={() => setIsBankFormOpen(true)}>
                  Add Bank Details
                </Button>
              </div>
            )}

            {/* Bank Details Form Dialog */}
            <Dialog open={isBankFormOpen} onOpenChange={setIsBankFormOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Bank Account Details</DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleBankFormSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input
                      id="accountHolderName"
                      value={bankFormData.accountHolderName}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                      placeholder="Enter account holder name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                      placeholder="Enter account number"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="ifscCode">IFSC Code *</Label>
                    <Input
                      id="ifscCode"
                      value={bankFormData.ifscCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="Enter IFSC code (e.g., SBIN0001234)"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bankName">Bank Name (Optional)</Label>
                    <Input
                      id="bankName"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      value={bankFormData.phoneNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, phoneNumber: e.target.value })}
                      placeholder="Enter phone number"
                      required
                      type="tel"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="panNumber">PAN Number *</Label>
                    <Input
                      id="panNumber"
                      value={bankFormData.panNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="Enter PAN number"
                      required
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <Label htmlFor="aadharNumber">Aadhar Number *</Label>
                    <Input
                      id="aadharNumber"
                      value={bankFormData.aadharNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, aadharNumber: e.target.value })}
                      placeholder="Enter Aadhar number"
                      required
                      type="number"
                      maxLength={12}
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <p className="text-sm text-muted-foreground">
                      Your bank details are encrypted and stored securely. We use this information only for processing payouts.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsBankFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveBankDetailsMutation.isPending}>
                      {saveBankDetailsMutation.isPending ? "Saving..." : "Save Details"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
