import { useState } from "react";
import { useLocation } from "wouter";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Share2,
  Heart,
  Ticket,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";

export default function EventDetails() {
  const [location, navigate] = useLocation();
  const eventId = location.split("/")[2];
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ticketQuantity, setTicketQuantity] = useState(1);

  const { data: event, isLoading } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      return response.json();
    },
    enabled: !!eventId,
    retry: (failureCount, error) => {
      // Don't retry on 401/403 errors for public endpoints
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as any).message;
        if (message.includes('401') || message.includes('403')) return false;
      }
      return failureCount < 1;
    },
  });

  const { data: artist } = useQuery({
    queryKey: [`/api/artists/${event?.artistId}`],
    queryFn: async () => {
      if (!event?.artistId) return null;
      const response = await fetch(`/api/artists/${event.artistId}`);
      if (!response.ok) throw new Error("Failed to fetch artist");
      return response.json();
    },
    enabled: !!event?.artistId,
    retry: (failureCount, error) => {
      // Don't retry on 401/403 errors for public endpoints
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as any).message;
        if (message.includes('401') || message.includes('403')) return false;
      }
      return failureCount < 1;
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    queryFn: async () => {
      const token = localStorage.getItem("ruc_auth_token");
      if (!token) return null;
      const res = await fetch("/api/users/me/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    retry: false, // Don't retry auth-required endpoints
  });

  const buyTicketMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify({
          type: "event",
          id: eventId,
          quantity: ticketQuantity,
        }),
      });
      if (!response.ok) throw new Error("Failed to add to cart");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to cart",
        description: `${ticketQuantity} ticket(s) added to your cart`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      navigate("/cart");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add tickets to cart",
        variant: "destructive",
      });
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/me/favorites/events/${eventId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to toggle favorite");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.isNowFavorited ? "Added to favorites" : "Removed from favorites",
        description: data.isNowFavorited
          ? "Event saved to your favorites"
          : "Event removed from favorites",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/favorites"] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading event details..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen pt-16 pb-24">
        <div className="container-custom py-8">
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Event not found</h3>
              <p className="text-muted-foreground">
                The event you're looking for doesn't exist.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isEventPast = new Date(event.date) < new Date();
  const eventDate = new Date(event.date);
  const isEventFavorited = favorites?.events?.some((e: any) => e._id === eventId) || false;

  const handleBuyTicket = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to buy tickets",
        variant: "destructive",
      });
      return;
    }
    buyTicketMutation.mutate();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: `Check out "${event.title}" on Rise Up Creators`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Event link copied to clipboard",
      });
    }
  };

  return (
    <div className="min-h-screen pt-16 pb-24 bg-background">
      <div className="container-custom py-8 max-w-6xl mx-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/events")}
          className="mb-6 hover:bg-muted rounded-full"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden shadow-md">
              <img
                src={
                  event.imageUrl ||
                  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80"
                }
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>

              <Badge
                className={`absolute top-4 right-4 text-sm px-3 py-1.5 rounded-full ${
                  isEventPast
                    ? "bg-muted text-muted-foreground"
                    : event.onlineUrl
                    ? "bg-blue-600 text-white"
                    : "bg-primary text-white"
                }`}
              >
                {isEventPast
                  ? "PAST EVENT"
                  : event.onlineUrl
                  ? "ONLINE"
                  : "LIVE"}
              </Badge>

              <div className="absolute top-4 left-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => toggleFavoriteMutation.mutate()}
                  disabled={!user}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full"
                >
                  <Heart className={`w-4 h-4 ${isEventFavorited ? "fill-red-500 text-red-500" : "text-white"}`} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleShare}
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Event Details */}
            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-tight">{event.title}</h1>
              {artist && (
                <p className="text-lg text-muted-foreground">
                  by{" "}
                  <span
                    className="text-primary font-semibold cursor-pointer hover:underline"
                    onClick={() => navigate(`/artist/${artist._id}`)}
                  >
                    {artist.name}
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                {eventDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-primary" />
                {eventDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-primary" />
                {event.location}
              </div>
              {event.capacity && (
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2 text-primary" />
                  {event.attendees?.length || 0} / {event.capacity} attending
                </div>
              )}
            </div>

            {/* About Section */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              </CardContent>
            </Card>

            {/* Artist Section */}
            {artist && (
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle>About the Artist</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4">
                    <img
                      src={
                        artist.avatarUrl ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${artist.email}`
                      }
                      alt={artist.name}
                      className="w-16 h-16 rounded-full border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => navigate(`/artist/${artist._id}`)}
                    />
                    <div>
                      <h3 
                        className="font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/artist/${artist._id}`)}
                      >
                        {artist.name}
                      </h3>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        {artist.bio || "No bio available"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ticket Sidebar */}
          <div className="space-y-6">
            <Card className="sticky top-24 border-border shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Ticket className="w-5 h-5 mr-2 text-primary" />
                  Get Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    ₹{event.ticketPrice}
                  </div>
                  <div className="text-sm text-muted-foreground">per ticket</div>
                </div>

                {!isEventPast && (
                  <>
                    <div>
                      <Label htmlFor="quantity">Quantity</Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setTicketQuantity(Math.max(1, ticketQuantity - 1))
                          }
                          disabled={ticketQuantity <= 1}
                        >
                          -
                        </Button>
                        <Input
                          id="quantity"
                          type="number"
                          value={ticketQuantity}
                          onChange={(e) =>
                            setTicketQuantity(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="text-center w-20"
                          min="1"
                          max="6"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setTicketQuantity(Math.min(6, ticketQuantity + 1))
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center font-semibold">
                      <span>Total:</span>
                      <span className="text-primary">
                        ₹{event.ticketPrice * ticketQuantity}
                      </span>
                    </div>

                    <Button
                      onClick={handleBuyTicket}
                      disabled={buyTicketMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/80 text-white rounded-full"
                    >
                      {buyTicketMutation.isPending ? (
                        <Loading size="sm" />
                      ) : (
                        "Add to Cart"
                      )}
                    </Button>

                    {event.onlineUrl && (
                      <p className="text-xs text-muted-foreground text-center">
                        This is an online event. You’ll receive a link after purchase.
                      </p>
                    )}
                  </>
                )}

                {isEventPast && (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm">
                      This event has already ended.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
