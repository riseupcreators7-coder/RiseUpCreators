import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, Play, Image } from "lucide-react";
import { AudioAd, BannerAd } from "../types";

interface SimpleAdListProps {
  audioAds: AudioAd[];
  bannerAds: BannerAd[];
  audioAdsLoading: boolean;
  bannerAdsLoading: boolean;
  selectedAdType: "audio" | "banner";
  onAdTypeChange: (type: "audio" | "banner") => void;
  onEdit?: (ad: AudioAd | BannerAd, type: "audio" | "banner") => void;
  onDelete?: (adId: string, type: "audio" | "banner") => void;
}

export default function SimpleAdList({
  audioAds,
  bannerAds,
  audioAdsLoading,
  bannerAdsLoading,
  selectedAdType,
  onAdTypeChange,
  onEdit,
  onDelete,
}: SimpleAdListProps) {

  return (
    <div className="space-y-6">
      

        <TabsContent value="audio" className="mt-6">
          {audioAdsLoading ? (
            <div className="text-center py-8">Loading audio ads...</div>
          ) : (
            <div className="space-y-4">
              {audioAds && audioAds.length > 0 ? (
                audioAds.map((ad) => (
                  <Card key={ad._id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Play className="w-5 h-5 text-blue-500" />
                          <div>
                            <h4 className="font-medium">{ad.title || "Audio Ad"}</h4>
                            <p className="text-sm text-muted-foreground">
                              Duration: {Math.floor(ad.durationSec / 60)}:{(ad.durationSec % 60).toString().padStart(2, '0')}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={ad.status === "ACTIVE" ? "default" : "secondary"}>
                                {ad.status || "ACTIVE"}
                              </Badge>
                              {ad.approved && <Badge variant="outline">Approved</Badge>}
                              {ad.placements && ad.placements.length > 0 && (
                                <Badge variant="outline">{ad.placements.join(", ")}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Impressions: {ad.impressions || 0} | Clicks: {ad.clicks || 0}
                          </div>
                          {onEdit && onDelete && (
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(ad, "audio")}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete && onDelete(ad._id, "audio")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audio ads found</p>
                  <p className="text-xs mt-2">Create your first audio ad to get started</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="banner" className="mt-6">
          {bannerAdsLoading ? (
            <div className="text-center py-8">Loading banner ads...</div>
          ) : (
            <div className="space-y-4">
              {bannerAds && bannerAds.length > 0 ? (
                bannerAds.map((ad) => (
                  <Card key={ad._id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Image className="w-5 h-5 text-green-500" />
                          <div>
                            <h4 className="font-medium">{ad.title || "Banner Ad"}</h4>
                            <p className="text-sm text-muted-foreground">
                              Size: {typeof ad.size === 'object' && ad.size?.width && ad.size?.height
                                ? `${ad.size.width}x${ad.size.height}`
                                : (typeof ad.size === 'string' ? ad.size : '300x250')}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={ad.status === "ACTIVE" ? "default" : "secondary"}>
                                {ad.status || "ACTIVE"}
                              </Badge>
                              {ad.approved && <Badge variant="outline">Approved</Badge>}
                              {ad.placements && ad.placements.length > 0 && (
                                <Badge variant="outline">{ad.placements.join(", ")}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          <div className="text-sm text-muted-foreground">
                            Impressions: {ad.impressions || 0} | Clicks: {ad.clicks || 0}
                          </div>
                          {onEdit && onDelete && (
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(ad, "banner")}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete && onDelete(ad._id, "banner")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No banner ads found</p>
                  <p className="text-xs mt-2">Create your first banner ad to get started</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
    </div>
  );
}