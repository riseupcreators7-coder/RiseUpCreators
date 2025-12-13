import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar, MapPin, Clock, Ticket, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

export default function Events() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("upcoming");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: [
      "/api/events",
      {
        search: searchQuery,
        location: selectedLocation,
        date: dateFilter,
        genre: genreFilter,
        type: activeTab === "all" ? "" : activeTab,
      },
    ],
    staleTime: 2 * 60 * 1000,
  });

  // Buy ticket mutation
  const buyTicketMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({
          type: "event",
          id: eventId,
          quantity: 1,
        }),
      });
      if (!response.ok) throw new Error("Failed to add ticket to cart");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: "Event ticket added to your cart",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add ticket to cart",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  };

  const handleBuyTicket = (event: any) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to buy tickets",
        variant: "destructive",
      });
      return;
    }
    buyTicketMutation.mutate(event._id);
  };

  const isEventPast = (eventDate: string) => {
    return new Date(eventDate) < new Date();
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
      fullDate: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container-custom py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Music Events</h1>
          <p className="text-muted-foreground">
            Discover and attend amazing live music experiences
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search events, artists, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-input border-border rounded-2xl"
                  data-testid="events-search-input"
                />
              </div>
            </form>

            <div className="flex gap-2">
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger
                  className="w-40"
                  data-testid="location-filter"
                >
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-locations">All Locations</SelectItem>
                  <SelectItem value="mumbai">Mumbai</SelectItem>
                  <SelectItem value="delhi">Delhi</SelectItem>
                  <SelectItem value="bangalore">Bangalore</SelectItem>
                  <SelectItem value="pune">Pune</SelectItem>
                  <SelectItem value="chennai">Chennai</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger
                  className="w-40"
                  data-testid="date-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="past">Past Events</SelectItem>
                </SelectContent>
              </Select>

              <Select value={genreFilter} onValueChange={setGenreFilter}>
                <SelectTrigger
                  className="w-40"
                  data-testid="genre-filter"
                >
                  <SelectValue placeholder="All Genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-genres">All Genres</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="electronic">Electronic</SelectItem>
                  <SelectItem value="hip-hop">Hip Hop</SelectItem>
                  <SelectItem value="jazz">Jazz</SelectItem>
                  <SelectItem value="classical">Classical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Event Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="all-events-tab">
              All Events
            </TabsTrigger>
            <TabsTrigger value="concert" data-testid="concerts-tab">
              Concerts
            </TabsTrigger>
            <TabsTrigger value="festival" data-testid="festivals-tab">
              Festivals
            </TabsTrigger>
            <TabsTrigger value="online" data-testid="online-tab">
              Online
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-8">
            {eventsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="w-full h-48 bg-muted rounded-2xl mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : events && Array.isArray(events) && events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event: any, index: number) => (
                  <div
                    key={event._id}
                    className="event-card group cursor-pointer"
                    onClick={() => navigate(`/event/${event._id}`)}
                    data-testid={`event-card-${index}`}
                  >
                    <div className="relative h-48 rounded-t-2xl overflow-hidden">
                      {event.imageUrl ? (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=400&h=200";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No Image</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

                      {/* Event Status Badge */}
                      <Badge
                        className={`absolute top-4 right-4 ${
                          isEventPast(event.date)
                            ? "bg-muted text-muted-foreground"
                            : event.onlineUrl
                            ? "bg-info text-white"
                            : "bg-primary text-white"
                        }`}
                      >
                        {isEventPast(event.date)
                          ? "PAST"
                          : event.onlineUrl
                          ? "ONLINE"
                          : "LIVE"}
                      </Badge>

                      {/* Date Display */}
                      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold text-white">
                          {formatEventDate(event.date).day}
                        </div>
                        <div className="text-xs text-white/80">
                          {formatEventDate(event.date).month}
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="mb-4">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          by {event.artistName || "Artist"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-2" />
                          {formatEventDate(event.date).fullDate}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 mr-2" />
                          {formatEventDate(event.date).time}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2" />
                          {event.location}
                        </div>
                        {event.capacity && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Users className="w-4 h-4 mr-2" />
                            {event.attendees?.length || 0} / {event.capacity} attending
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold text-primary">
                            ₹{event.ticketPrice}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">
                            onwards
                          </span>
                        </div>
                        <Button
                          className="bg-primary hover:bg-primary/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyTicket(event);
                          }}
                          disabled={isEventPast(event.date) || buyTicketMutation.isPending}
                          data-testid="buy-ticket-button"
                        >
                          {isEventPast(event.date)
                            ? "Past Event"
                            : buyTicketMutation.isPending
                            ? <Loading size="sm" />
                            : (
                              <>
                                <Ticket className="w-4 h-4 mr-2" />
                                Get Tickets
                              </>
                            )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No events found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? `No events match your search for "${searchQuery}"`
                      : "No events available for the selected filters. Try adjusting your criteria."}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
