import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  QrCode, 
  Users, 
  CheckCircle, 
  Clock, 
  Download, 
  Search,
  Calendar,
  MapPin,
  Ticket
} from 'lucide-react';
import QRScanner from '@/components/common/qr-scanner';
import { toast } from '@/hooks/use-toast';

interface Event {
  _id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  venue?: string;
  ticketPrice: number;
  maxTickets: number;
  ticketsSold: number;
  imageUrl?: string;
  type: 'LIVE' | 'ONLINE' | 'HYBRID';
}

interface TicketStats {
  totalTickets: number;
  soldTickets: number;
  availableTickets: number;
  checkedInTickets: number;
  validTickets: number;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';
  checkedInAt?: string;
  createdAt: string;
  holderName: string;
  holderEmail: string;
}

interface OrganizerScannerProps {
  eventId?: string;
  className?: string;
}

export default function OrganizerScanner({ eventId, className }: OrganizerScannerProps) {
  const [selectedEventId, setSelectedEventId] = useState(eventId || '');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch artist's events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events/artist'],
    queryFn: async () => {
      const response = await fetch('/api/events/artist', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  // Fetch ticket stats for selected event
  const { data: ticketStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<TicketStats>({
    queryKey: ['/api/tickets/event', selectedEventId, 'stats'],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const response = await fetch(`/api/tickets/event/${selectedEventId}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch ticket stats');
      return response.json();
    },
    enabled: !!selectedEventId
  });

  // Fetch tickets for selected event
  const { data: tickets = [], isLoading: ticketsLoading, refetch: refetchTickets } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets/event', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const response = await fetch(`/api/tickets/event/${selectedEventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    },
    enabled: !!selectedEventId
  });

  const selectedEvent = events.find((event: Event) => event._id === selectedEventId);

  const handleScanResult = (result: any) => {
    // Refresh stats and tickets after scan
    refetchStats();
    refetchTickets();
  };

  const downloadAttendeeList = async () => {
    if (!selectedEventId) return;
    
    try {
      const response = await fetch(`/api/tickets/event/${selectedEventId}/attendees/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to download attendee list');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${selectedEvent?.title?.replace(/[^a-zA-Z0-9]/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Attendee list downloaded successfully"
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download attendee list",
        variant: "destructive"
      });
    }
  };

  const filteredTickets = tickets.filter((ticket: Ticket) =>
    ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.holderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.holderEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      VALID: { label: 'Valid', className: 'bg-green-100 text-green-800' },
      USED: { label: 'Used', className: 'bg-blue-100 text-blue-800' },
      CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
      EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-800' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.EXPIRED;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Event Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Event
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="animate-pulse">Loading events...</div>
          ) : events.length === 0 ? (
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                No events found. Create an event first to manage tickets.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="event-select">Choose an event to manage tickets:</Label>
              <select
                id="event-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select an event...</option>
                {events.map((event: Event) => (
                  <option key={event._id} value={event._id}>
                    {event.title} - {new Date(event.date).toLocaleDateString()} - {event.location}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                {selectedEvent.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{new Date(selectedEvent.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedEvent.maxTickets} max tickets</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Stats */}
          {ticketStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{ticketStats.totalTickets}</div>
                  <div className="text-sm text-muted-foreground">Total Tickets</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{ticketStats.soldTickets}</div>
                  <div className="text-sm text-muted-foreground">Sold</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">{ticketStats.availableTickets}</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-purple-600">{ticketStats.checkedInTickets}</div>
                  <div className="text-sm text-muted-foreground">Checked In</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-emerald-600">{ticketStats.validTickets}</div>
                  <div className="text-sm text-muted-foreground">Valid</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="scanner" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scanner" className="flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                QR Scanner
              </TabsTrigger>
              <TabsTrigger value="attendees" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Attendees
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scanner" className="space-y-4">
              <QRScanner 
                onScanResult={handleScanResult}
                autoCheckIn={true}
                className="max-w-2xl mx-auto"
              />
            </TabsContent>

            <TabsContent value="attendees" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Attendee List
                    </CardTitle>
                    <Button onClick={downloadAttendeeList} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Download CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search */}
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ticket number, name, or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Tickets List */}
                  {ticketsLoading ? (
                    <div className="animate-pulse text-center py-8">Loading tickets...</div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {tickets.length === 0 ? 'No tickets sold yet' : 'No tickets match your search'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTickets.map((ticket: Ticket) => (
                        <div
                          key={ticket._id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{ticket.holderName}</div>
                            <div className="text-sm text-muted-foreground">{ticket.holderEmail}</div>
                            <div className="text-xs text-muted-foreground">{ticket.ticketNumber}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getStatusBadge(ticket.status)}
                            {ticket.checkedInAt && (
                              <div className="text-xs text-muted-foreground">
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                {new Date(ticket.checkedInAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}