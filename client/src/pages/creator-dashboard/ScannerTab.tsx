import React, { useState, useEffect } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import QRScanner from '@/components/common/qr-scanner';
import { 
  Scan, 
  Users, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Download,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import Loading from '@/components/common/loading';

interface Event {
  _id: string;
  title: string;
  date: string;
  location: string;
  venue?: string;
  ticketPrice: number;
  maxTickets: number;
  ticketsSold: number;
}

interface TicketStats {
  totalTickets: number;
  soldTickets: number;
  availableTickets: number;
  checkedInTickets: number;
  validTickets: number;
}

interface ScanResult {
  valid: boolean;
  status: 'VALID' | 'INVALID' | 'USED' | 'EXPIRED' | 'EVENT_ENDED';
  message: string;
  ticketDetails?: {
    ticketNumber: string;
    eventTitle: string;
    eventDate: string;
    venue: string;
    holderName: string;
    checkedInAt?: string;
  };
}

export default function ScannerTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<(ScanResult & { timestamp: Date })[]>([]);
  const [scanMode, setScanMode] = useState<'verify' | 'checkin'>('verify');

  // Fetch artist's events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events/artist'],
    queryFn: async () => {
      const response = await fetch('/api/events/artist', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      return data as Event[];
    }
  });

  // Fetch ticket stats for selected event
  const { data: ticketStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/tickets/event', selectedEventId, 'stats'],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const response = await fetch(`/api/tickets/event/${selectedEventId}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch ticket stats');
      const data = await response.json();
      return data as TicketStats;
    },
    enabled: !!selectedEventId
  });

  // Download attendee list
  const downloadAttendeeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/tickets/event/${eventId}/attendees/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to download attendee list');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendees-${eventId}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: 'Download Started',
        description: 'Attendee list is being downloaded.'
      });
    },
    onError: () => {
      toast({
        title: 'Download Failed',
        description: 'Failed to download attendee list.',
        variant: 'destructive'
      });
    }
  });

  const handleScanResult = (result: ScanResult) => {
    setScanHistory(prev => [
      { ...result, timestamp: new Date() },
      ...prev.slice(0, 49) // Keep last 50 scans
    ]);

    // Refresh ticket stats if scanning for the selected event
    if (selectedEventId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tickets/event', selectedEventId, 'stats'] 
      });
    }
  };

  const selectedEvent = events?.find(e => e._id === selectedEventId);
  const isEventToday = selectedEvent && 
    new Date(selectedEvent.date).toDateString() === new Date().toDateString();

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VALID': return 'bg-green-100 text-green-800 border-green-200';
      case 'USED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'INVALID': 
      case 'EXPIRED':
      case 'EVENT_ENDED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (eventsLoading) {
    return (
      <TabsContent value="scanner">
        <div className="flex justify-center py-8">
          <Loading />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="scanner" className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">QR Scanner</h2>
        <p className="text-muted-foreground">
          Scan ticket QR codes to verify and check in attendees for your events.
        </p>
      </div>

      {/* Event Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Event
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Event</label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event to scan tickets for" />
                </SelectTrigger>
                <SelectContent>
                  {events?.filter(event => new Date(event.date) >= new Date(Date.now() - 24 * 60 * 60 * 1000)).map(event => (
                    <SelectItem key={event._id} value={event._id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Scan Mode</label>
              <Select value={scanMode} onValueChange={(value: 'verify' | 'checkin') => setScanMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verify">Verify Only</SelectItem>
                  <SelectItem value="checkin">Check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedEvent && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold">{selectedEvent.title}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(selectedEvent.date).toLocaleString()} • {selectedEvent.location}
              </p>
              {!isEventToday && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not today's event
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Statistics */}
      {selectedEventId && ticketStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Ticket Statistics
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadAttendeeMutation.mutate(selectedEventId)}
                disabled={downloadAttendeeMutation.isPending}
              >
                <Download className="w-4 h-4 mr-2" />
                Download List
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{ticketStats.totalTickets}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{ticketStats.soldTickets}</div>
                <div className="text-sm text-muted-foreground">Sold</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{ticketStats.availableTickets}</div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{ticketStats.checkedInTickets}</div>
                <div className="text-sm text-muted-foreground">Checked In</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{ticketStats.validTickets}</div>
                <div className="text-sm text-muted-foreground">Valid</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner */}
        <div>
          <QRScanner
            onScanResult={handleScanResult}
            autoCheckIn={scanMode === 'checkin'}
          />
        </div>

        {/* Scan History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scanHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Scan className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No scans yet</p>
                  <p className="text-sm">Scan QR codes to see results here</p>
                </div>
              ) : (
                scanHistory.map((scan, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusBadgeColor(scan.status)}>
                        {scan.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {scan.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{scan.message}</div>
                      {scan.ticketDetails && (
                        <div className="text-muted-foreground mt-1">
                          {scan.ticketDetails.ticketNumber} • {scan.ticketDetails.holderName}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}