import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Checkbox } from "../../ui/checkbox";
import { AudioAd, BannerAd } from "../../../types";

// Simplified types for form editing that don't require all fields
type EditableAudioAd = Pick<AudioAd, '_id' | 'title' | 'audioUrl' | 'imageUrl' | 'durationSec' | 'callToAction' | 'placements' | 'status' | 'approved'>;
type EditableBannerAd = Pick<BannerAd, '_id' | 'title' | 'imageUrl' | 'callToAction' | 'placements' | 'status' | 'approved'> & {
  size: string | { width: number; height: number };
};

interface AdFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (adData: any) => void;
  editingAd?: EditableAudioAd | EditableBannerAd | null;
  adType: "audio" | "banner";
  isSubmitting: boolean;
}

export default function AdForm({
  isOpen,
  onClose,
  onSubmit,
  editingAd,
  adType,
  isSubmitting,
}: AdFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    audioUrl: "",
    audioFile: null as File | null,
    imageUrl: "",
    size: "responsive" as string | { width: number; height: number }, // Auto-sized per placement
    customSize: { width: 300, height: 250 },
    durationSec: 30,
    placements: adType === "banner" ? ["HOME"] : ["PRE_ROLL"], // Better defaults
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    approved: true, // Default to approved for admin
    callToAction: {
      text: "",
      url: ""
    }
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingAd) {
        const isBannerAd = 'imageUrl' in editingAd && !('audioUrl' in editingAd);
        setFormData({
          title: editingAd.title,
          audioUrl: isBannerAd ? "" : (editingAd as EditableAudioAd).audioUrl,
          audioFile: null, // Reset file when editing existing ad
          imageUrl: isBannerAd 
            ? (editingAd as EditableBannerAd).imageUrl 
            : (editingAd as EditableAudioAd).imageUrl || "",
          size: "responsive", // Size is now handled automatically per placement
          customSize: { width: 300, height: 250 }, // Legacy support
          durationSec: isBannerAd ? 30 : (editingAd as EditableAudioAd).durationSec,
          placements: editingAd.placements || (isBannerAd ? ["HOME"] : ["PRE_ROLL"]),
          status: (editingAd.status as "ACTIVE" | "INACTIVE") || "ACTIVE",
          approved: editingAd.approved ?? true,
          callToAction: editingAd.callToAction
            ? {
                text: editingAd.callToAction.text,
                url: editingAd.callToAction.url || ""
              }
            : { text: "", url: "" }
        });
      } else {
        setFormData({
          title: "",
          audioUrl: "",
          audioFile: null,
          imageUrl: "",
          size: "300x250",
          customSize: { width: 300, height: 250 },
          durationSec: 30,
          placements: adType === "audio" ? ["PRE_ROLL"] : ["home"],
          status: "ACTIVE" as "ACTIVE" | "INACTIVE",
          approved: true,
          callToAction: {
            text: "",
            url: ""
          }
        });
      }
    }
  }, [isOpen, editingAd, adType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adType === "audio") {
      // Check if we have audio (either file or existing URL)
      if (!formData.audioFile && !formData.audioUrl) {
        alert('Please select an audio file');
        return;
      }
      
      // If editing and no new file provided, use existing audioUrl
      let audioUrl = formData.audioUrl;
      
      // If a new file is provided, upload it first
      if (formData.audioFile) {
        setIsUploading(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('audio', formData.audioFile);
          
          const uploadResponse = await fetch('/api/upload/audio', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
            },
            body: uploadFormData
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload audio file');
          }
          
          const uploadResult = await uploadResponse.json();
          audioUrl = uploadResult.url;
        } catch (error) {
          alert('Failed to upload audio file. Please try again.');
          return;
        } finally {
          setIsUploading(false);
        }
      }

      const audioAdData = {
        title: formData.title,
        audioUrl: audioUrl,
        imageUrl: formData.imageUrl,
        durationSec: formData.durationSec,
        placements: formData.placements,
        status: formData.status,
        approved: formData.approved,
        callToAction: formData.callToAction.text ? formData.callToAction : undefined,
        active: true
      };
      onSubmit(audioAdData);
    } else {
      const bannerAdData = {
        title: formData.title,
        imageUrl: formData.imageUrl,
        size: formData.size === "custom" ? formData.customSize : formData.size,
        placements: formData.placements,
        status: formData.status,
        approved: formData.approved,
        callToAction: formData.callToAction.text ? formData.callToAction : undefined,
        active: true
      };
      onSubmit(bannerAdData);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid audio file (MP3, WAV, or OGG)');
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('File size must be less than 10MB');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        audioFile: file,
        audioUrl: "" // Clear URL when file is selected
      }));
    }
  };

  const handleCustomSizeChange = (dimension: 'width' | 'height', value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      customSize: {
        ...prev.customSize,
        [dimension]: numValue
      }
    }));
  };

  const handlePlacementChange = (placement: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      placements: checked 
        ? [...prev.placements, placement]
        : prev.placements.filter(p => p !== placement)
    }));
  };

  const audioAdPlacements = [
    { id: "PRE_ROLL", label: "Pre-roll (Before song)" },
    { id: "MID_ROLL", label: "Mid-roll (During song)" },
    { id: "POST_ROLL", label: "Post-roll (After song)" }
  ];

  const bannerAdPlacements = [
    { id: "HOME", label: "Home Page Hero (Responsive Banner)" },
    { id: "HOME_INLINE", label: "Home Page Inline (Between Content)" },
    { id: "DISCOVER_FEATURED", label: "Discover Page Featured (Large Banner)" },
    { id: "ARTIST_PROFILE", label: "Artist Profile Pages" },
    { id: "SEARCH_RESULTS", label: "Search Results" },
    { id: "PLAYLIST", label: "Playlist Pages" },
    { id: "DASHBOARD", label: "User Dashboard" }
  ];

  const bannerSizes = [
    { value: "300x250", label: "Medium Rectangle (300x250)" },
    { value: "728x90", label: "Leaderboard (728x90)" },
    { value: "320x50", label: "Mobile Banner (320x50)" },
    { value: "160x600", label: "Wide Skyscraper (160x600)" },
    { value: "custom", label: "Custom Size" }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingAd ? "Edit" : "Create"} {adType === "audio" ? "Audio" : "Banner"} Ad
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Ad title"
              required
            />
          </div>

          {adType === "audio" ? (
            <>
              <div>
                <Label htmlFor="audioFile">Audio File</Label>
                <Input
                  id="audioFile"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Supported formats: MP3, WAV, OGG (max 10MB)
                </p>
                {formData.audioFile && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {formData.audioFile.name}
                  </p>
                )}
                {formData.audioUrl && !formData.audioFile && (
                  <p className="text-sm text-blue-600 mt-1">
                    Current: {formData.audioUrl.split('/').pop()}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.durationSec}
                  onChange={(e) => handleInputChange("durationSec", parseInt(e.target.value) || 30)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="imageUrl">Ad Artwork/Image URL (Optional)</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                  placeholder="https://example.com/ad-artwork.jpg"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Image to display during ad playback (recommended: 300x300px)
                </p>
              </div>

              {/* Placements for Audio Ads */}
              <div>
                <Label>Ad Placements</Label>
                <div className="space-y-2 mt-2">
                  {audioAdPlacements.map((placement) => (
                    <div key={placement.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={placement.id}
                        checked={formData.placements.includes(placement.id)}
                        onCheckedChange={(checked) => 
                          handlePlacementChange(placement.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={placement.id} className="text-sm">
                        {placement.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call to Action for Audio Ads */}
              <div>
                <Label>Call to Action (Optional)</Label>
                <div className="space-y-2 mt-2">
                  <Input
                    placeholder="Button text (e.g., 'Learn More')"
                    value={formData.callToAction.text}
                    onChange={(e) => handleInputChange("callToAction", {
                      ...formData.callToAction,
                      text: e.target.value
                    })}
                  />
                  <Input
                    placeholder="Button URL (e.g., 'https://example.com')"
                    value={formData.callToAction.url}
                    onChange={(e) => handleInputChange("callToAction", {
                      ...formData.callToAction,
                      url: e.target.value
                    })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  value={formData.imageUrl}
                  onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  required
                />
              </div>

              <div>
                <Label>Placements</Label>
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Ad sizes are automatically optimized for each placement. Select where you want this ad to appear:
                  </p>
                  {bannerAdPlacements.map((placement) => (
                    <div key={placement.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={placement.id}
                        checked={formData.placements.includes(placement.id)}
                        onCheckedChange={(checked) => 
                          handlePlacementChange(placement.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={placement.id} className="text-sm">
                        {placement.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Call to Action (Optional)</Label>
                <div className="space-y-2 mt-2">
                  <Input
                    placeholder="Button text (e.g., 'Learn More')"
                    value={formData.callToAction.text}
                    onChange={(e) => handleInputChange("callToAction", {
                      ...formData.callToAction,
                      text: e.target.value
                    })}
                  />
                  <Input
                    placeholder="Button URL (e.g., 'https://example.com')"
                    value={formData.callToAction.url}
                    onChange={(e) => handleInputChange("callToAction", {
                      ...formData.callToAction,
                      url: e.target.value
                    })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Status and Approval - Common for both ad types */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: "ACTIVE" | "INACTIVE") => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="approved"
                checked={formData.approved}
                onCheckedChange={(checked) => handleInputChange("approved", checked as boolean)}
              />
              <Label htmlFor="approved" className="text-sm">
                Approved for display
              </Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading}>
              {isUploading 
                ? "Uploading..." 
                : isSubmitting 
                  ? "Saving..." 
                  : editingAd 
                    ? "Update" 
                    : "Create"} Ad
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}