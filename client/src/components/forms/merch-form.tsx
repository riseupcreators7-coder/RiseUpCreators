
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShoppingBag, DollarSign, Package, Upload, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import Loading from "@/components/common/loading";

const merchFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Product description is required"),
  price: z.number().min(0, "Price must be non-negative"),
  stock: z.number().min(1, "Stock must be at least 1"),
  category: z.string().optional(),
  sizes: z.array(z.string()).default(["S", "M", "L", "XL", "XXL"]),
  colors: z.array(z.string()).default([]),
});

type MerchForm = z.infer<typeof merchFormSchema>;



interface MerchFormProps {
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialData?: {
    _id?: string;
    name?: string;
    description?: string;
    price?: number;
    stock?: number;
    category?: string;
    images?: string[];
    sizes?: string[];
    colors?: string[];
  } | null;
}

const MERCH_CATEGORIES = [
  "T-Shirts",
  "Hoodies",
  "Hats",
  "Posters",
  "Stickers",
  "Accessories",
  "Vinyl Records",
  "CDs",
  "Other"
];

export default function MerchForm({ onSubmit, onCancel, isLoading, initialData }: MerchFormProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [availableSizes, setAvailableSizes] = useState<string[]>(["S", "M", "L", "XL", "XXL"]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<MerchForm>({
    resolver: zodResolver(merchFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      stock: initialData?.stock || 1,
      category: initialData?.category || "",
      sizes: initialData?.sizes || ["S", "M", "L", "XL", "XXL"],
      colors: initialData?.colors || []
    }
  });

  useEffect(() => {
    if (initialData?.sizes) {
      setAvailableSizes(initialData.sizes);
    }
    if (initialData?.colors) {
      setAvailableColors(initialData.colors);
    }
  });

  const category = watch("category");

  const handleFormSubmit = (data: MerchForm) => {
    const formData = new FormData();
    
    const merchData = {
      ...data,
      price: Number(data.price),
      stock: Number(data.stock),
      sizes: availableSizes,
      colors: availableColors
    };

    selectedImages.forEach((image) => {
      formData.append('images', image);
    });
    
    formData.append('data', JSON.stringify(merchData));
    onSubmit(formData);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedImages(files.slice(0, 5)); // Limit to 5 images
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="flex items-center space-x-2">
          <ShoppingBag className="w-4 h-4" />
          <span>Product Name *</span>
        </Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Enter product name"
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Describe your product..."
          rows={4}
          className={errors.description ? "border-destructive" : ""}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select onValueChange={(value) => setValue("category", value)} value={category}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {MERCH_CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price" className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
            <span>Price (₹) *</span>
          </Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            {...register("price", { valueAsNumber: true })}
            placeholder="0.00"
            className={errors.price ? "border-destructive" : ""}
          />
          {errors.price && (
            <p className="text-sm text-destructive">{errors.price.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock" className="flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Stock Quantity *</span>
          </Label>
          <Input
            id="stock"
            type="number"
            min="1"
            {...register("stock", { valueAsNumber: true })}
            placeholder="1"
            className={errors.stock ? "border-destructive" : ""}
          />
          {errors.stock && (
            <p className="text-sm text-destructive">{errors.stock.message}</p>
          )}
        </div>
      </div>

      {/* Sizes and Colors Selection */}
      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Available Sizes</Label>
          <div className="flex flex-wrap gap-2">
            {["S", "M", "L", "XL", "XXL"].map((size) => (
              <Badge
                key={size}
                variant={availableSizes.includes(size) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => {
                  if (availableSizes.includes(size)) {
                    setAvailableSizes(prev => prev.filter(s => s !== size));
                  } else {
                    setAvailableSizes(prev => [...prev, size]);
                  }
                }}
              >
                {size}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Click to toggle sizes. Default sizes are auto-selected.
          </p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Available Colors</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {availableColors.map((color, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer"
              >
                {color}
                <X 
                  className="w-3 h-3 ml-1 hover:text-destructive" 
                  onClick={() => {
                    setAvailableColors(prev => prev.filter((_, i) => i !== index));
                  }}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter color name (e.g., Red, Blue, Black)"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newColor.trim() && !availableColors.includes(newColor.trim())) {
                    setAvailableColors(prev => [...prev, newColor.trim()]);
                    setNewColor("");
                  }
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (newColor.trim() && !availableColors.includes(newColor.trim())) {
                  setAvailableColors(prev => [...prev, newColor.trim()]);
                  setNewColor("");
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Add color options for your product. Leave empty if not applicable.
          </p>
        </div>
      </div>



      <div className="space-y-2">
        <Label htmlFor="images" className="flex items-center space-x-2">
          <Upload className="w-4 h-4" />
          <span>Product Images (Optional)</span>
        </Label>
        <Input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
        />
        <p className="text-xs text-muted-foreground">
          You can upload up to 5 images. Recommended: 800x800px
        </p>
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedImages.map((file, index) => (
              <div key={index} className="text-xs bg-muted px-2 py-1 rounded">
                {file.name}
              </div>
            ))}
          </div>
        )}
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
              Adding...
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4 mr-2" />
              {initialData ? "Update Product" : "Add Product"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
