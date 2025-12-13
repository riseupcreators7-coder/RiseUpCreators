import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Ban, Clock } from "lucide-react";

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  banned?: boolean;
  banReason?: string;
  banUntil?: string;
}

interface BanUserDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onBan: (userId: string, reason: string, duration?: number) => Promise<void>;
  onUnban: (userId: string) => Promise<void>;
  isLoading: boolean;
}

export default function BanUserDialog({
  user,
  isOpen,
  onClose,
  onBan,
  onUnban,
  isLoading
}: BanUserDialogProps) {
  const [reason, setReason] = useState("");
  const [durationType, setDurationType] = useState("permanent");
  const [customDays, setCustomDays] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      if (user.banned) {
        // Unban user
        await onUnban(user._id);
      } else {
        // Ban user
        let duration = undefined;
        if (durationType === "7days") duration = 7;
        else if (durationType === "30days") duration = 30;
        else if (durationType === "custom" && customDays) {
          duration = parseInt(customDays);
        }

        await onBan(user._id, reason, duration);
      }
      
      handleClose();
    } catch (error) {
      console.error("Failed to process ban/unban:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDurationType("permanent");
    setCustomDays("");
    setIsSubmitting(false);
    onClose();
  };

  if (!user) return null;

  const isBanned = user.banned;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBanned ? (
              <>
                <Ban className="w-5 h-5 text-green-500" />
                Unban User
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Ban User
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">Role: {user.role}</p>
          </div>

          {/* Current Ban Status */}
          {isBanned && (
            <Alert>
              <Ban className="w-4 h-4" />
              <AlertDescription>
                <strong>Currently Banned</strong>
                {user.banReason && (
                  <div className="mt-1">
                    <span className="text-sm">Reason: {user.banReason}</span>
                  </div>
                )}
                {user.banUntil && (
                  <div className="mt-1">
                    <span className="text-sm">
                      Until: {new Date(user.banUntil).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Ban/Unban Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">
                {isBanned ? "Reason for Unbanning" : "Reason for Banning"} *
              </Label>
              <Textarea
                id="reason"
                placeholder={
                  isBanned 
                    ? "Explain why this user is being unbanned..." 
                    : "Explain why this user is being banned..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {!isBanned && (
              <div>
                <Label htmlFor="duration">Ban Duration</Label>
                <Select value={durationType} onValueChange={setDurationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4" />
                        Permanent Ban
                      </div>
                    </SelectItem>
                    <SelectItem value="7days">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        7 Days
                      </div>
                    </SelectItem>
                    <SelectItem value="30days">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        30 Days
                      </div>
                    </SelectItem>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Custom Duration
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {durationType === "custom" && (
                  <div className="mt-2">
                    <Label htmlFor="customDays">Number of Days</Label>
                    <Input
                      id="customDays"
                      type="number"
                      min="1"
                      max="365"
                      placeholder="Enter number of days"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Warning */}
            {!isBanned && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Banned users will not be able to login and will see a message 
                  directing them to contact support at Riseupcreators7@gmail.com.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting || isLoading}
            variant={isBanned ? "default" : "destructive"}
          >
            {isSubmitting ? "Processing..." : isBanned ? "Unban User" : "Ban User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}