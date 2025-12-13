import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Settings, Save, RotateCcw, Mail, Phone, Clock, MessageSquare } from "lucide-react";
import Loading from "@/components/common/loading";

interface SystemSettings {
  platformFee: number;
  taxRate: number;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  maintenanceMode: boolean;
  maxUploadsPerArtist: number;
  // Platform subscription pricing
  premiumPlanPrice: number;
  artistProPlanPrice: number;
  // Contact information
  supportEmail: string;
  supportPhone: string;
  customerServiceHours: string;
  whatsappNumber: string;
  telegramUsername: string;
}

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    platformFee: 2.5,
    taxRate: 18,
    allowNewRegistrations: true,
    requireEmailVerification: true,
    maintenanceMode: false,
    maxUploadsPerArtist: 10,
    premiumPlanPrice: 199,
    artistProPlanPrice: 299,
    // Contact information defaults
    supportEmail: "support@riseup.com",
    supportPhone: "+91 9876543210",
    customerServiceHours: "9 AM - 6 PM (Mon-Fri)",
    whatsappNumber: "",
    telegramUsername: ""
  });

  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: currentSettings, isLoading, error } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      return response.json();
    }
  });

  // Update settings when data is loaded
  useEffect(() => {
    if (currentSettings) {
      setSettings(prev => ({ ...prev, ...currentSettings }));
    }
  }, [currentSettings]);

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SystemSettings>) => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error("Failed to update settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Settings updated",
        description: "System settings have been saved successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  });

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settings);
  };

  const handleResetSettings = () => {
    setSettings({
      platformFee: 2.5,
      taxRate: 18,
      allowNewRegistrations: true,
      requireEmailVerification: true,
      maintenanceMode: false,
      maxUploadsPerArtist: 10,
      premiumPlanPrice: 199,
      artistProPlanPrice: 299,
      supportEmail: "support@riseup.com",
      supportPhone: "+91 9876543210",
      customerServiceHours: "9 AM - 6 PM (Mon-Fri)",
      whatsappNumber: "",
      telegramUsername: ""
    });
  };

  if (isLoading) {
    return <Loading size="lg" text="Loading system settings..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading settings</div>
        <div className="text-sm text-muted-foreground">
          {error?.message || "Unknown error occurred"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">Configure essential platform settings</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleResetSettings}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Platform Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="platform-fee">Platform Fee (%)</Label>
              <Input
                id="platform-fee"
                type="number"
                step="0.1"
                value={settings.platformFee}
                onChange={(e) => updateSetting('platformFee', parseFloat(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Commission charged on transactions
              </p>
            </div>

            <div>
              <Label htmlFor="tax-rate">Tax Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                step="0.1"
                value={settings.taxRate}
                onChange={(e) => updateSetting('taxRate', parseFloat(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Tax applied to transactions
              </p>
            </div>

            <div>
              <Label htmlFor="max-uploads">Max Uploads per Artist (daily)</Label>
              <Input
                id="max-uploads"
                type="number"
                value={settings.maxUploadsPerArtist}
                onChange={(e) => updateSetting('maxUploadsPerArtist', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Daily upload limit to prevent spam
              </p>
            </div>

            <div>
              <Label htmlFor="premium-plan-price">Premium Plan Price (₹/month)</Label>
              <Input
                id="premium-plan-price"
                type="number"
                value={settings.premiumPlanPrice}
                onChange={(e) => updateSetting('premiumPlanPrice', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Premium plan subscription price for fans
              </p>
            </div>

            <div>
              <Label htmlFor="artist-pro-plan-price">Artist Pro Plan Price (₹/month)</Label>
              <Input
                id="artist-pro-plan-price"
                type="number"
                value={settings.artistProPlanPrice}
                onChange={(e) => updateSetting('artistProPlanPrice', parseInt(e.target.value))}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Artist Pro plan subscription price for creators
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable platform for maintenance
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="new-registrations">Allow New Registrations</Label>
                <p className="text-sm text-muted-foreground">
                  Enable/disable new user registrations
                </p>
              </div>
              <Switch
                id="new-registrations"
                checked={settings.allowNewRegistrations}
                onCheckedChange={(checked) => updateSetting('allowNewRegistrations', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-verification">Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Force email verification for new accounts
                </p>
              </div>
              <Switch
                id="email-verification"
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Phone className="w-5 h-5 mr-2" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="support-email">Support Email</Label>
              <Input
                id="support-email"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => updateSetting('supportEmail', e.target.value)}
                placeholder="support@example.com"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Primary support email address
              </p>
            </div>

            <div>
              <Label htmlFor="support-phone">Support Phone</Label>
              <Input
                id="support-phone"
                type="tel"
                value={settings.supportPhone}
                onChange={(e) => updateSetting('supportPhone', e.target.value)}
                placeholder="+91 9876543210"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Primary support phone number
              </p>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="service-hours">Customer Service Hours</Label>
              <Input
                id="service-hours"
                type="text"
                value={settings.customerServiceHours}
                onChange={(e) => updateSetting('customerServiceHours', e.target.value)}
                placeholder="9 AM - 6 PM (Mon-Fri)"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Hours when customer support is available
              </p>
            </div>

            <div>
              <Label htmlFor="whatsapp-number">WhatsApp Number (Optional)</Label>
              <Input
                id="whatsapp-number"
                type="tel"
                value={settings.whatsappNumber}
                onChange={(e) => updateSetting('whatsappNumber', e.target.value)}
                placeholder="+91 9876543210"
              />
              <p className="text-sm text-muted-foreground mt-1">
                WhatsApp support number
              </p>
            </div>

            <div>
              <Label htmlFor="telegram-username">Telegram Username (Optional)</Label>
              <Input
                id="telegram-username"
                type="text"
                value={settings.telegramUsername}
                onChange={(e) => updateSetting('telegramUsername', e.target.value)}
                placeholder="@yourusername"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Telegram support username
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}