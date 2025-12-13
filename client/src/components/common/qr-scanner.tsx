import React, { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Camera, StopCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TicketDetails {
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  holderName: string;
  checkedInAt?: string;
}

interface ScanResult {
  valid: boolean;
  status: 'VALID' | 'INVALID' | 'USED' | 'EXPIRED' | 'EVENT_ENDED';
  message: string;
  ticketDetails?: TicketDetails;
}

interface QRScannerProps {
  onScanResult?: (result: ScanResult) => void;
  autoCheckIn?: boolean; // If true, automatically check in valid tickets
  className?: string;
}

export default function QRScanner({ onScanResult, autoCheckIn = false, className }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const elementId = 'qr-scanner-' + Math.random().toString(36).substr(2, 9);

  const config = {
    fps: 10,
    qrbox: { width: 300, height: 300 },
    aspectRatio: 1.0,
    disableFlip: false,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    showTorchButtonIfSupported: true,
    showZoomSliderIfSupported: true,
  };

  const startScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }

    const scanner = new Html5QrcodeScanner(elementId, config, false);
    
    scanner.render(
      async (decodedText) => {
        try {
          setIsLoading(true);
          await handleScanSuccess(decodedText);
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        // Handle scan failure silently - this fires constantly while scanning
        console.debug('QR scan error:', error);
      }
    );

    scannerRef.current = scanner;
    setIsScanning(true);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccess = async (qrData: string) => {
    try {
      // First verify the ticket
      const verifyResponse = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qrData })
      });

      const result: ScanResult = await verifyResponse.json();
      setLastResult(result);
      onScanResult?.(result);

      // Show immediate feedback
      if (result.valid) {
        toast({
          title: "✅ Valid Ticket",
          description: `${result.ticketDetails?.eventTitle} - ${result.ticketDetails?.holderName}`,
        });

        // Auto check-in if enabled and user is authenticated
        if (autoCheckIn && result.status === 'VALID') {
          try {
            const token = localStorage.getItem('ruc_auth_token');
            if (token) {
              const checkinResponse = await fetch('/api/tickets/checkin', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ qrData })
              });

              if (checkinResponse.ok) {
                const checkinResult = await checkinResponse.json();
                toast({
                  title: "🎫 Ticket Checked In",
                  description: `${result.ticketDetails?.holderName} successfully checked in`,
                });

                // Update result to show checked in status
                setLastResult({
                  ...result,
                  status: 'USED',
                  message: 'Ticket checked in successfully',
                  ticketDetails: {
                    ...result.ticketDetails!,
                    checkedInAt: new Date().toISOString()
                  }
                });
              } else {
                toast({
                  title: "❌ Check-in Failed",
                  description: "Failed to check in ticket. You may not have permission.",
                  variant: "destructive"
                });
              }
            }
          } catch (checkinError) {
            console.error('Check-in error:', checkinError);
            toast({
              title: "❌ Check-in Error",
              description: "Failed to check in ticket",
              variant: "destructive"
            });
          }
        }
      } else {
        const statusMessages: Record<string, string> = {
          INVALID: "❌ Invalid Ticket",
          USED: "⚠️ Already Used",
          EXPIRED: "⏰ Expired Ticket",
          EVENT_ENDED: "📅 Event Ended"
        };

        toast({
          title: statusMessages[result.status] || "❌ Invalid",
          description: result.message,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Scan verification error:', error);
      const errorResult: ScanResult = {
        valid: false,
        status: 'INVALID',
        message: 'Failed to verify ticket'
      };
      setLastResult(errorResult);
      onScanResult?.(errorResult);

      toast({
        title: "❌ Verification Error",
        description: "Could not verify ticket. Please try again.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALID':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'USED':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'EXPIRED':
      case 'EVENT_ENDED':
        return <XCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'USED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'EXPIRED':
      case 'EVENT_ENDED':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            QR Code Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Start Scanning
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="destructive" className="flex items-center gap-2">
                <StopCircle className="w-4 h-4" />
                Stop Scanning
              </Button>
            )}
          </div>

          {isScanning && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div id={elementId} className="w-full" />
              {isLoading && (
                <div className="text-center mt-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Verifying ticket...</p>
                </div>
              )}
            </div>
          )}

          {!isScanning && (
            <Alert>
              <Camera className="h-4 w-4" />
              <AlertDescription>
                Click "Start Scanning" to begin scanning QR codes. Make sure to allow camera access when prompted.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(lastResult.status)}
              Scan Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className={getStatusColor(lastResult.status)}>
              {lastResult.status}
            </Badge>
            
            <p className="text-sm text-muted-foreground">{lastResult.message}</p>

            {lastResult.ticketDetails && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Ticket:</span> {lastResult.ticketDetails.ticketNumber}
                  </div>
                  <div>
                    <span className="font-medium">Holder:</span> {lastResult.ticketDetails.holderName}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Event:</span> {lastResult.ticketDetails.eventTitle}
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {new Date(lastResult.ticketDetails.eventDate).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Venue:</span> {lastResult.ticketDetails.venue}
                  </div>
                  {lastResult.ticketDetails.checkedInAt && (
                    <div className="col-span-2">
                      <span className="font-medium">Checked In:</span> {new Date(lastResult.ticketDetails.checkedInAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}