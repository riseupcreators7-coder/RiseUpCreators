import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ShoppingCart,
  Heart,
  Star,
  Share2,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { navigate } from "wouter/use-browser-location";
import Loading from "@/components/common/loading";
import SizeChart from "@/components/ui/size-chart";

interface MerchItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  stock: number;
  category: string;
  images: string[];
  sizes?: string[];
  colors?: string[];
  artistId: string;
  artistName?: string;
  createdAt: string;
  updatedAt: string;
}

export default function MerchDetails() {
  const [, params] = useRoute("/merch/:id");
  const merchId = params?.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const { data: merch, isLoading: merchLoading } = useQuery({
    queryKey: ["/api/merch", merchId],
    queryFn: () => fetch(`/api/merch/${merchId}`).then((res) => res.json()),
    enabled: !!merchId,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["/api/merch", merchId, "reviews"],
    queryFn: async () => {
      const response = await fetch(`/api/merch/${merchId}/reviews`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!merchId,
  });

  // Get user favorites
  const { data: favorites } = useQuery({
    queryKey: ["/api/users/me/favorites"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/favorites", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) return { merch: [] };
      return response.json();
    },
    enabled: !!user,
  });

  // Check if current merch is favorited
  const isFavorited = favorites?.merch?.some((m: any) => m._id === merchId);

  const addToCartMutation = useMutation({
    mutationFn: async (cartData: any) => {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}`,
        },
        body: JSON.stringify(cartData),
      });
      if (!res.ok) throw new Error("Failed to add to cart");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Added to cart!",
        description: `${merch?.name} has been added to your cart.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item to cart",
        variant: "destructive",
      });
    },
  });

  // Favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/merch/${merchId}/favorite`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        }
      });
      if (!response.ok) throw new Error("Failed to toggle favorite");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.favorited ? "Added to favorites" : "Removed from favorites",
        description: data.favorited ? "Merch added to your favorites" : "Merch removed from favorites"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/favorites"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  });

  // Review submission mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: any) => {
      const response = await fetch(`/api/merch/${merchId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(reviewData)
      });
      if (!response.ok) throw new Error("Failed to submit review");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Review submitted",
        description: "Thank you for your review!"
      });
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/merch", merchId, "reviews"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to add items to cart.",
        variant: "destructive",
      });
      return;
    }
    if (!merch) return;
    if (merch.sizes?.length && !selectedSize) {
      toast({
        title: "Select a size",
        description: "Please choose a size before adding to cart.",
        variant: "destructive",
      });
      return;
    }
    if (merch.colors?.length && !selectedColor) {
      toast({
        title: "Select a color",
        description: "Please choose a color before adding to cart.",
        variant: "destructive",
      });
      return;
    }
    if (quantity > merch.stock) {
      toast({
        title: "Not enough stock",
        description: `Only ${merch.stock} items available.`,
        variant: "destructive",
      });
      return;
    }

    addToCartMutation.mutate({
      type: "merch",
      id: merch._id,
      quantity,
      options: { size: selectedSize, color: selectedColor },
    });
  };

  const handleSubmitReview = () => {
    if (!reviewRating || !reviewComment.trim()) {
      toast({
        title: "Error",
        description: "Please provide both a rating and comment",
        variant: "destructive"
      });
      return;
    }

    submitReviewMutation.mutate({
      rating: reviewRating,
      comment: reviewComment.trim()
    });
  };

  const currentImage =
    merch?.images?.[selectedImageIndex] ||
    "https://images.unsplash.com/photo-1521572163474-686449cf17ab?auto=format&fit=crop&w=800&q=80";

  if (merchLoading) return <Loading />;

  if (!merch)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-semibold">Item not found</h2>
          <p className="text-muted-foreground">
            The product you're looking for doesn't exist.
          </p>
          <Link href="/merch">
            <Button>Browse Merchandise</Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-8 py-10">
        {/* Back Button */}
        <div className="mb-6 pt-4 sticky top-0 z-10 bg-background/70 backdrop-blur">
          <Button
            variant="ghost"
            onClick={() => navigate("/merch")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Merchandise
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Image Gallery */}
          <div className="space-y-4">
            <div className="relative rounded-lg border overflow-hidden bg-muted flex justify-center items-center">
              <img
                src={currentImage}
                alt={merch.name}
                className="max-h-[600px] w-auto object-contain transition-transform duration-300 hover:scale-[1.02]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1521572163474-686449cf17ab?auto=format&fit=crop&w=800&q=80";
                }}
              />
            </div>

            {merch.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto py-2">
                {merch.images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-20 h-20 flex-shrink-0 border rounded-md overflow-hidden ${
                      selectedImageIndex === i
                        ? "border-primary"
                        : "border-border"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${merch.name}-${i}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-start">
                <h1 className="text-2xl md:text-3xl font-bold leading-snug">
                  {merch.name}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => user ? toggleFavoriteMutation.mutate() : toast({
                    title: "Please sign in",
                    description: "You need to be signed in to add favorites.",
                    variant: "destructive"
                  })}
                  disabled={toggleFavoriteMutation.isPending}
                  className={isFavorited ? "text-red-500" : "text-muted-foreground"}
                >
                  <Heart
                    className={`w-5 h-5 ${isFavorited ? "fill-current" : ""}`}
                  />
                </Button>
              </div>

              {merch.artistName && (
                <p className="text-sm text-muted-foreground mt-1">
                  by {merch.artistName}
                </p>
              )}

              <Badge className="mt-2" variant="secondary">
                {merch.category}
              </Badge>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-primary">
                ₹{merch.price.toLocaleString()}
              </span>
              {merch.originalPrice && merch.originalPrice > merch.price && (
                <>
                  <span className="text-lg line-through text-muted-foreground">
                    ₹{merch.originalPrice.toLocaleString()}
                  </span>
                  <Badge variant="destructive">
                    {Math.round(
                      (1 - merch.price / merch.originalPrice) * 100
                    )}
                    % OFF
                  </Badge>
                </>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  merch.stock > 0 ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span
                className={`text-sm ${
                  merch.stock > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {merch.stock > 0
                  ? `In Stock (${merch.stock})`
                  : "Out of Stock"}
              </span>
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              {merch.sizes?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Size *
                    </label>
                    <SizeChart />
                  </div>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger className={!selectedSize && merch.sizes?.length ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select a size" />
                    </SelectTrigger>
                    <SelectContent>
                      {merch.sizes.map((s: string) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedSize && merch.sizes?.length > 0 && (
                    <p className="text-xs text-destructive mt-1">Please select a size</p>
                  )}
                </div>
              )}

              {merch.colors?.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Color *
                  </label>
                  <Select value={selectedColor} onValueChange={setSelectedColor}>
                    <SelectTrigger className={!selectedColor && merch.colors?.length ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {merch.colors.map((c: string) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedColor && merch.colors?.length > 0 && (
                    <p className="text-xs text-destructive mt-1">Please select a color</p>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-10 text-center font-medium">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setQuantity((q) =>
                        merch.stock ? Math.min(merch.stock, q + 1) : q + 1
                      )
                    }
                    disabled={quantity >= merch.stock}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Cart Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAddToCart}
                disabled={merch.stock === 0 || addToCartMutation.isPending}
                className="w-full h-11 text-base font-medium"
              >
                {addToCartMutation.isPending
                  ? "Adding..."
                  : merch.stock === 0
                  ? "Out of Stock"
                  : (
                      <>
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        Add to Cart • ₹
                        {(merch.price * quantity).toLocaleString()}
                      </>
                    )}
              </Button>

              <Button variant="outline" className="w-full">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {merch.description}
              </p>
            </div>

            {/* Info */}
            <Card>
              <CardContent className="p-4 space-y-1 text-sm">
                <h4 className="font-semibold mb-2">Product Information</h4>
                <p>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  {merch.category}
                </p>
                <p>
                  <span className="text-muted-foreground">Stock:</span>{" "}
                  {merch.stock} units
                </p>
                {merch.sizes?.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">
                      Available Sizes:
                    </span>{" "}
                    {merch.sizes.join(", ")}
                  </p>
                )}
                {merch.colors?.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">
                      Available Colors:
                    </span>{" "}
                    {merch.colors.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Customer Reviews</h3>
                <Button onClick={() => setShowReviewForm(true)}>
                  Write a Review
                </Button>
              </div>

              {reviewsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading reviews...
                </div>
              ) : reviews && reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((r: any) => (
                    <div key={r._id} className="border-b pb-5 last:border-0">
                      <div className="flex gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={r.userAvatar} />
                          <AvatarFallback>
                            {r.userName?.[0] || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.userName}</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < r.rating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {user && r.userId === user._id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                          <p className="text-sm mt-2 text-muted-foreground">
                            {r.comment}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-6">
                  No reviews yet. Be the first to review this product.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Review Form Modal */}
        <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle>Write a Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Rating Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setReviewRating(rating)}
                      className="p-1"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          rating <= reviewRating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Comment Field */}
              <div>
                <label className="block text-sm font-medium mb-2">Comment</label>
                <Textarea
                  placeholder="Share your thoughts about this product..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                />
              </div>
              
              {/* Submit Button */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={submitReviewMutation.isPending || !reviewRating || !reviewComment.trim()}
                >
                  {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
