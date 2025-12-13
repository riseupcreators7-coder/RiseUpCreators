import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { AudioAd, BannerAd } from "../types";

interface AdCardProps {
  ad: AudioAd | BannerAd;
  type: "audio" | "banner";
  onEdit: (ad: AudioAd | BannerAd, type: "audio" | "banner") => void;
  onDelete: (adId: string) => void;
  isDeleting: boolean;
}

export default function AdCard({
  ad,
  type,
  onEdit,
  onDelete,
  isDeleting
}: AdCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const isAudioAd = type === "audio";
  const audioAd = ad as AudioAd;
  const bannerAd = ad as BannerAd;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">{ad.title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {isAudioAd ? (
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {Math.floor(audioAd.durationSec / 60)}:{(audioAd.durationSec % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground">Size</p>
                  <p className="font-medium">
                    {typeof bannerAd.size === 'object' && bannerAd.size?.width && bannerAd.size?.height
                      ? `${bannerAd.size.width}x${bannerAd.size.height}`
                      : (typeof bannerAd.size === 'string' ? bannerAd.size : '300x250')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Impressions</p>
                <p className="font-medium">{formatNumber(ad.impressions)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Clicks</p>
                <p className="font-medium">{formatNumber(ad.clicks)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-medium text-green-600">{formatCurrency(ad.revenue)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(ad, type)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(ad._id)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
