import { useState } from "react";
import { useLocation } from "wouter";
import { Calendar, Plus, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import CreateEventForm from "@/components/forms/create-event-form";
import { getCreatorAuthHeaders } from "./utils";
import type { Event } from "./types";

// ---------- COMPONENT ----------
export default function EventsTab() {
  const auth = useRequireRole("artist");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // ---------- QUERIES ----------
  const { data: artistEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ["artistEvents"],
    queryFn: () => {
      console.log("Fetching artist events...");
      return fetch("/api/events/artist", {
        headers: getCreatorAuthHeaders()
      }).then(res => {
        console.log("Events API response status:", res.status);
        return res.json();
      }).then(data => {
        console.log("Events API response data:", data);
        return data;
      });
    },
    enabled: !!auth.user,
  });

  // ---------- MUTATIONS ----------
  const createEventMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: getCreatorAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create event");
      return res.json();
    },
    onSuccess: () => {
      console.log("Event created successfully, invalidating cache...");
      // Invalidate all related queries to update analytics
      queryClient.invalidateQueries({ queryKey: ["artistEvents"] });
      queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      console.log("Cache invalidated, queries should refetch");
      toast({
        title: "Event created successfully",
        description: "Your event is now live for fans to discover",
      });
      setShowCreateEventModal(false);
    },
    onError: () => {
      toast({
        title: "Event creation failed",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: getCreatorAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artistEvents"] });
      toast({
        title: "Event deleted successfully",
        description: "Your event has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Event deletion failed",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const editEventMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      console.log("Updating event:", id);
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: getCreatorAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update event");
      const result = await res.json();
      console.log("Update response:", result);
      return result;
    },
    onSuccess: (updatedEvent) => {
      console.log("Event update successful, invalidating cache...");
      queryClient.invalidateQueries({ queryKey: ["artistEvents"] });
      queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ["artistEvents"] });
      console.log("Cache invalidated and refetch triggered");
      toast({
        title: "Event updated successfully",
        description: "Your event changes have been saved",
      });
      setShowEditEventModal(false);
      setEditingEvent(null);
    },
    onError: () => {
      toast({
        title: "Event update failed",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---------- SAFE DEFAULTS ----------
  const safeArtistEvents: Event[] = Array.isArray(artistEvents) ? artistEvents : [];

  return (
    <>
      <TabsContent value="events">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">My Events</h2>
              <p className="text-sm text-muted-foreground">Manage your upcoming shows</p>
            </div>
            <Button
              className="gradient-primary hover:opacity-90 w-full sm:w-auto"
              onClick={() => setShowCreateEventModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Create Event
            </Button>
          </div>

          {eventsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : safeArtistEvents.length > 0 ? (
            <div className="space-y-4">
              {safeArtistEvents.map((event, index) => (
                <Card key={event._id} data-testid={`event-item-${index}`}>
                  <CardContent className="p-6">
                    {/* Mobile layout - stacked */}
                    <div className="md:hidden space-y-4">
                      <div className="flex items-center space-x-4">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                            onClick={() => setLocation(`/event/${event._id}`)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=100&h=100";
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{event.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">{event.location}</p>
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            <div>
                              {new Date(event.date).toLocaleDateString()} @{" "}
                              {new Date(event.date).toLocaleTimeString()}
                            </div>
                            <div>
                              ₹{event.ticketPrice} per ticket
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingEvent(event);
                            setShowEditEventModal(true);
                          }}
                          data-testid={`edit-event-${index}`}
                          className="flex-1 max-w-[100px]"
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEventMutation.mutate(event._id)}
                          disabled={deleteEventMutation.isPending}
                          className="flex-1 max-w-[100px]"
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>

                    {/* Desktop layout - horizontal */}
                    <div className="hidden md:flex items-center justify-between">
                      {/* Event info */}
                      <div className="flex items-center space-x-4">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-16 h-16 rounded-lg object-cover cursor-pointer"
                            onClick={() => setLocation(`/event/${event._id}`)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=100&h=100";
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold">{event.title}</h3>
                          <p className="text-sm text-muted-foreground">{event.location}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.date).toLocaleDateString()} @{" "}
                              {new Date(event.date).toLocaleTimeString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ₹{event.ticketPrice} per ticket
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingEvent(event);
                            setShowEditEventModal(true);
                          }}
                          data-testid={`edit-event-${index}`}
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEventMutation.mutate(event._id)}
                          disabled={deleteEventMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first event to connect with fans.
                </p>
                <Button
                  className="gradient-primary hover:opacity-90"
                  onClick={() => setShowCreateEventModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Create Event
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      {/* Create Event Modal */}
      <Dialog open={showCreateEventModal} onOpenChange={setShowCreateEventModal}>
        <DialogContent className="max-w-lg max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>Set up a new event for your fans</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <CreateEventForm
              onSubmit={(data) => createEventMutation.mutate(data)}
              onCancel={() => setShowCreateEventModal(false)}
              isLoading={createEventMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Modal */}
      <Dialog open={showEditEventModal} onOpenChange={setShowEditEventModal}>
        <DialogContent className="max-w-lg max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update your event details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <CreateEventForm
              onSubmit={(data) => editingEvent && editEventMutation.mutate({ id: editingEvent._id, formData: data })}
              onCancel={() => {
                setShowEditEventModal(false);
                setEditingEvent(null);
              }}
              isLoading={editEventMutation.isPending}
              initialData={editingEvent}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
