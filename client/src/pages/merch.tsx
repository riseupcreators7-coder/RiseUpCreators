import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Heart,
  Star,
  Grid,
  List,
} from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { Link } from "wouter";
import Loading from "@/components/common/loading";
import { MERCH_CATEGORIES } from "@/lib/constants";

export default function Merch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all-categories");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState("popular");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Debounce for price range changes
  const [debouncedRange, setDebouncedRange] = useState(priceRange);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRange(priceRange), 400);
    return () => clearTimeout(t);
  }, [priceRange]);

  // Normalize category
  const categoryParam = selectedCategory === "all-categories" ? "" : selectedCategory;

  // Fetch merchandise (FIXED: dynamic filters)
  const { data: merchItems, isLoading } = useQuery({
    queryKey: [
      "/api/merch",
      { searchQuery, categoryParam, priceMin: debouncedRange[0], priceMax: debouncedRange[1], sortBy },
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/merch?search=${encodeURIComponent(searchQuery)}&category=${categoryParam}&minPrice=${debouncedRange[0]}&maxPrice=${debouncedRange[1]}&sort=${sortBy}`
      );
      if (!res.ok) throw new Error("Failed to fetch merch");
      return res.json();
    },
    placeholderData: keepPreviousData => keepPreviousData,
  });



  // Like item
  const likeItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/merch/${id}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("ruc_auth_token")}` },
      });
      if (!res.ok) throw new Error("Failed to like item");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/merch"] }),
  });



  const handleLike = (item: any) => {
    if (!user)
      return toast({
        title: "Sign in required",
        description: "Please sign in to like items",
        variant: "destructive",
      });
    likeItem.mutate(item._id);
  };

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Artist Merchandise</h1>
          <p className="text-muted-foreground">
            Support your favorite artists with official merchandise
          </p>
        </div>

        {/* 🧭 Sticky Filter Bar */}
        <div className="sticky top-16 z-30 bg-background/90 backdrop-blur-md border-b border-border py-3 mb-6">
          <div className="flex flex-col lg:flex-row items-center gap-3">
            <Input
              placeholder="Search merchandise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-input border-border rounded-xl w-full lg:w-1/3"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">All Categories</SelectItem>
                  {MERCH_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex border border-border rounded-lg">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 💰 Price Range Filter */}
        <Card className="p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Price Range</span>
            <span className="text-sm text-muted-foreground">
              ₹{priceRange[0]} - ₹{priceRange[1]}
            </span>
          </div>
          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange(value as [number, number])}
            max={10000}
            step={100}
            className="w-full"
          />
        </Card>

        {/* 🛒 Product Grid/List */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-muted h-80 rounded-xl" />
            ))}
          </div>
        ) : merchItems && Array.isArray(merchItems) && merchItems.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(merchItems as any[]).map((item: any) => (
                <Card
                  key={item._id}
                  className="group overflow-hidden rounded-2xl border hover:shadow-lg transition-all duration-300 bg-card cursor-pointer"
                >
                  <Link href={`/merch/${item._id}`} className="block">
                    <div className="relative aspect-square overflow-hidden">
                      <img
                        src={
                          item.images?.[0] ||
                          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80"
                        }
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLike(item);
                        }}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                      {item.stock < 10 && (
                        <Badge className="absolute top-2 left-2 bg-yellow-400 text-black">
                          Only {item.stock} left
                        </Badge>
                      )}
                    </div>
                  </Link>

                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      by {item.artistName || "Artist"}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold text-primary">
                          ₹{item.price}
                        </span>
                        {item.originalPrice > item.price && (
                          <span className="text-sm line-through text-muted-foreground">
                            ₹{item.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.rating && (
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < Math.floor(item.rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        ))}
                        <span className="text-xs text-muted-foreground">
                          ({item.reviewCount || 0})
                        </span>
                      </div>
                    )}


                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {merchItems.map((item: any) => (
                <Card
                  key={item._id}
                  className="flex items-center p-4 hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer"
                >
                  <Link href={`/merch/${item._id}`} className="flex items-center flex-1">
                    <img
                      src={
                        item.images?.[0] ||
                        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=80"
                      }
                      alt={item.name}
                      className="w-24 h-24 rounded-lg object-cover mr-4"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-1">
                        by {item.artistName || "Artist"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {item.description}
                      </p>
                      <span className="text-lg font-bold text-primary">
                        ₹{item.price}
                      </span>
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLike(item);
                      }}
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No merchandise found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : "No merchandise available right now."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
