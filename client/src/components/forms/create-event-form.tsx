
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Clock, MapPin, DollarSign, Users, Link, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Loading from "@/components/common/loading";

const eventFormSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().min(1, "Event description is required"),
  date: z.string().min(1, "Event date is required"),
  time: z.string().min(1, "Event time is required"),
  location: z.string().min(1, "Event location is required"),
  onlineUrl: z.string().url("Valid URL required").optional().or(z.literal("")),
  ticketPrice: z.number().min(0, "Ticket price must be non-negative"),
  capacity: z.number().min(1, "Capacity must be at least 1").optional(),
});

type EventForm = z.infer<typeof eventFormSchema>;

interface CreateEventFormProps {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: {
    _id?: string;
    title?: string;
    description?: string;
    date?: Date | string;
    location?: string;
    onlineUrl?: string;
    ticketPrice?: number;
    capacity?: number;
    imageUrl?: string;
  } | null;
}

export default function CreateEventForm({ onSubmit, onCancel, isLoading, initialData }: CreateEventFormProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<EventForm>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : "",
      time: initialData?.date ? new Date(initialData.date).toTimeString().slice(0, 5) : "",
      location: initialData?.location || "",
      onlineUrl: initialData?.onlineUrl || "",
      ticketPrice: initialData?.ticketPrice || 0,
      capacity: initialData?.capacity || undefined
    }
  });

  const handleFormSubmit = (data: EventForm) => {
    const formData = new FormData();
    
    // Combine date and time
    const dateTime = new Date(`${data.date}T${data.time}`);
    
    const eventData = {
      ...data,
      date: dateTime.toISOString(),
      ticketPrice: Number(data.ticketPrice),
      capacity: data.capacity ? Number(data.capacity) : undefined
    };

    if (selectedImage) {
      formData.append('image', selectedImage);
    }
    
    formData.append('data', JSON.stringify(eventData));
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center space-x-2">
          <Calendar className="w-4 h-4" />
          <span>Event Title *</span>
        </Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="Enter event title"
          className={errors.title ? "border-destructive" : ""}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Describe your event..."
          rows={4}
          className={errors.description ? "border-destructive" : ""}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date" className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>Date *</span>
          </Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
            min={new Date().toISOString().split('T')[0]}
            className={`${errors.date ? "border-destructive" : ""} [color-scheme:dark] dark:[color-scheme:dark] cursor-pointer`}
            style={{
              colorScheme: 'dark'
            }}
          />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="time" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Time *</span>
          </Label>
          <Input
            id="time"
            type="time"
            {...register("time")}
            className={`${errors.time ? "border-destructive" : ""} [color-scheme:dark] dark:[color-scheme:dark] cursor-pointer`}
            style={{
              colorScheme: 'dark'
            }}
          />
          {errors.time && (
            <p className="text-sm text-destructive">{errors.time.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location" className="flex items-center space-x-2">
          <MapPin className="w-4 h-4" />
          <span>Location *</span>
        </Label>
        <Input
          id="location"
          {...register("location")}
          placeholder="Enter venue or location"
          className={errors.location ? "border-destructive" : ""}
        />
        {errors.location && (
          <p className="text-sm text-destructive">{errors.location.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="onlineUrl" className="flex items-center space-x-2">
          <Link className="w-4 h-4" />
          <span>Online Stream URL (Optional)</span>
        </Label>
        <Input
          id="onlineUrl"
          {...register("onlineUrl")}
          placeholder="https://..."
          type="url"
          className={errors.onlineUrl ? "border-destructive" : ""}
        />
        {errors.onlineUrl && (
          <p className="text-sm text-destructive">{errors.onlineUrl.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ticketPrice" className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
            <span>Ticket Price (₹) *</span>
          </Label>
          <Input
            id="ticketPrice"
            type="number"
            min="0"
            step="0.01"
            {...register("ticketPrice", { valueAsNumber: true })}
            placeholder="0.00"
            className={errors.ticketPrice ? "border-destructive" : ""}
          />
          {errors.ticketPrice && (
            <p className="text-sm text-destructive">{errors.ticketPrice.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="capacity" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Capacity (Optional)</span>
          </Label>
          <Input
            id="capacity"
            type="number"
            min="1"
            {...register("capacity", { valueAsNumber: true })}
            placeholder="Unlimited"
            className={errors.capacity ? "border-destructive" : ""}
          />
          {errors.capacity && (
            <p className="text-sm text-destructive">{errors.capacity.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image" className="flex items-center space-x-2">
          <Upload className="w-4 h-4" />
          <span>Event Image (Optional)</span>
        </Label>
        <Input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
        />
        <p className="text-xs text-muted-foreground">Recommended: 1200x600px</p>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 gradient-primary hover:opacity-90"
        >
          {isLoading ? (
            <>
              <Loading size="sm" />
              {initialData ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              {initialData ? "Update Event" : "Create Event"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
