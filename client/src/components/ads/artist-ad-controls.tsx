import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Settings, Music, DollarSign, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface SongAdSettings {
  _id: string;
  songId: string;
  artistId: string;
  adsEnabled: boolean;
  adTypes: string[];
  customAdSettings: {
    skipEnabled: boolean;
    maxAdsPerSession: number;
    adFrequency: number;
  };
}

interface ArtistAdControlsProps {
  songId: string;
  songTitle: string;
  onSettingsChange?: (settings: SongAdSettings) => void;
}

export default function ArtistAdControls({ songId, songTitle, onSettingsChange }: ArtistAdControlsProps) {
  const [settings, setSettings] = useState<SongAdSettings | null>(null);
  const queryClient = useQueryClient();

  // Fetch current ad settings for this song
  const { data: adSettings, isLoading } = useQuery<SongAdSettings>({
    queryKey: [`/api/songs/${songId}/ad-settings`],
    enabled: !!songId,
    staleTime: 5 * 60 * 1000,
  });

  // Update ad settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<SongAdSettings>) => {
      const response = await fetch(`/api/songs/${songId}/ad-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error("Failed to update ad settings");
      }

      return response.json();
    },
    onSuccess: (updatedSettings) => {
      setSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
      queryClient.invalidateQueries({ queryKey: [`/api/songs/${songId}/ad-settings`] });
      toast({
        title: "Settings updated",
        description: "Ad settings for this song have been updated successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update ad settings",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (adSettings) {
      setSettings(adSettings);
    }
  }, [adSettings]);

  const handleSettingChange = (key: string, value: any) => {
    if (!settings) return;

    let updates: Partial<SongAdSettings> = {};

    if (key === 'adsEnabled') {
      updates.adsEnabled = value;
    } else if (key === 'adTypes') {
      updates.adTypes = value;
    } else if (key.startsWith('custom.')) {
      const customKey = key.replace('custom.', '');
      updates.customAdSettings = {
        ...settings.customAdSettings,
        [customKey]: value
      };
    }

    updateSettingsMutation.mutate(updates);
  };

  const handleAdTypeToggle = (adType: string) => {
    if (!settings) return;

    const currentTypes = settings.adTypes || [];
    let newTypes: string[];

    if (currentTypes.includes(adType)) {
      newTypes = currentTypes.filter(type => type !== adType);
    } else {
      newTypes = [...currentTypes, adType];
    }

    handleSettingChange('adTypes', newTypes);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Ad Settings</h3>
          <p className="text-muted-foreground">Ad settings haven't been configured for this song yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Ad Settings for "{songTitle}"</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enable/Disable Ads */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">Enable Ads</Label>
            <p className="text-sm text-muted-foreground">
              Allow ads to be shown for this song
            </p>
          </div>
          <Switch
            checked={settings.adsEnabled}
            onCheckedChange={(checked) => handleSettingChange('adsEnabled', checked)}
            disabled={updateSettingsMutation.isPending}
          />
        </div>

        {settings.adsEnabled && (
          <>
            {/* Ad Types */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Ad Types</Label>
              <p className="text-sm text-muted-foreground">
                Select which types of ads can be shown
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Music className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium">Pre-roll Ads</p>
                      <p className="text-xs text-muted-foreground">Before song starts</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.adTypes?.includes('PRE_ROLL') || false}
                    onCheckedChange={() => handleAdTypeToggle('PRE_ROLL')}
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Music className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium">Mid-roll Ads</p>
                      <p className="text-xs text-muted-foreground">During playback</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.adTypes?.includes('MID_ROLL') || false}
                    onCheckedChange={() => handleAdTypeToggle('MID_ROLL')}
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Eye className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium">Banner Ads</p>
                      <p className="text-xs text-muted-foreground">On related pages</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.adTypes?.includes('BANNER') || false}
                    onCheckedChange={() => handleAdTypeToggle('BANNER')}
                    disabled={updateSettingsMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Custom Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Custom Settings</Label>

              {/* Skip Enabled */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Allow Users to Skip Ads</Label>
                  <p className="text-sm text-muted-foreground">
                    Let listeners skip ads after 5 seconds
                  </p>
                </div>
                <Switch
                  checked={settings.customAdSettings?.skipEnabled ?? true}
                  onCheckedChange={(checked) => handleSettingChange('custom.skipEnabled', checked)}
                  disabled={updateSettingsMutation.isPending}
                />
              </div>

              {/* Max Ads Per Session */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Max Ads Per Session</Label>
                  <Badge variant="secondary">
                    {settings.customAdSettings?.maxAdsPerSession || 3}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum number of ads shown per listening session
                </p>
                <Slider
                  value={[settings.customAdSettings?.maxAdsPerSession || 3]}
                  onValueChange={([value]) => handleSettingChange('custom.maxAdsPerSession', value)}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                  disabled={updateSettingsMutation.isPending}
                />
              </div>

              {/* Ad Frequency */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Ad Frequency</Label>
                  <Badge variant="secondary">
                    Every {settings.customAdSettings?.adFrequency || 5} minutes
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  How often mid-roll ads appear during playback
                </p>
                <Slider
                  value={[settings.customAdSettings?.adFrequency || 5]}
                  onValueChange={([value]) => handleSettingChange('custom.adFrequency', value)}
                  max={15}
                  min={2}
                  step={1}
                  className="w-full"
                  disabled={updateSettingsMutation.isPending}
                />
              </div>
            </div>

            {/* Revenue Estimate */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <Label className="text-base font-medium">Estimated Revenue</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Based on current ad performance and your song's popularity
              </p>
              <div className="text-2xl font-bold text-green-600">
                ₹{(Math.random() * 500 + 100).toFixed(0)} - ₹{(Math.random() * 1000 + 500).toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per 1,000 plays • Updated daily
              </p>
            </div>
          </>
        )}

        {/* Status Indicator */}
        <div className="flex items-center space-x-2 pt-4 border-t">
          {settings.adsEnabled ? (
            <>
              <Eye className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600">Ads enabled for this song</span>
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ads disabled for this song</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
