import { useState } from "react";
import { ShoppingBag, Plus, Edit, Trash2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireRole } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import Loading from "@/components/common/loading";
import MerchForm from "@/components/forms/merch-form";
import { getCreatorAuthHeaders } from "./utils";
import type { Merch } from "./types";

// ---------- COMPONENT ----------
export default function MerchTab() {
  const auth = useRequireRole("artist");
  const queryClient = useQueryClient();
  const [showAddMerchModal, setShowAddMerchModal] = useState(false);
  const [showEditMerchModal, setShowEditMerchModal] = useState(false);
  const [editingMerch, setEditingMerch] = useState<Merch | null>(null);

  // ---------- QUERIES ----------
  const { data: artistMerch, isLoading: merchLoading, error: merchError } = useQuery({
    queryKey: ["artistMerch"],
    queryFn: async () => {
      const response = await fetch("/api/merch/artist", {
        headers: getCreatorAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch merch: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !!auth.user,
  });

  // Fetch merchandise cost settings
  const { data: merchCosts } = useQuery({
    queryKey: ["/api/merch/cost-breakdown"],
    queryFn: async () => {
      const response = await fetch("/api/merch/cost-breakdown", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCreatorAuthHeaders()
        },
        body: JSON.stringify({ sellingPrice: 500 }) // Sample price for display
      });
      if (!response.ok) throw new Error('Failed to fetch cost breakdown');
      return response.json();
    },
    enabled: !!auth.user,
  });

  // ---------- MUTATIONS ----------
  const createMerchMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/merch", {
        method: "POST",
        headers: getCreatorAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create merchandise");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all related queries to update analytics
      queryClient.invalidateQueries({ queryKey: ["artistMerch"] });
      queryClient.invalidateQueries({ queryKey: ["artistAnalytics"] });
      queryClient.invalidateQueries({ queryKey: ["artistProfile"] });
      toast({
        title: "Merchandise added successfully",
        description: "Your product is now available in your store",
      });
      setShowAddMerchModal(false);
    },
    onError: () => {
      toast({
        title: "Merchandise creation failed",
        description: "Failed to add merchandise. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMerchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/merch/${id}`, {
        method: "DELETE",
        headers: getCreatorAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete merchandise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artistMerch"] });
      toast({
        title: "Merchandise deleted successfully",
        description: "Your product has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Merchandise deletion failed",
        description: "Failed to delete merchandise. Please try again.",
        variant: "destructive",
      });
    },
  });

  const editMerchMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const res = await fetch(`/api/merch/${id}`, {
        method: "PATCH",
        headers: getCreatorAuthHeaders(),
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update merchandise");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artistMerch"] });
      toast({
        title: "Merchandise updated successfully",
        description: "Your product changes have been saved",
      });
      setShowEditMerchModal(false);
      setEditingMerch(null);
    },
    onError: () => {
      toast({
        title: "Merchandise update failed",
        description: "Failed to update merchandise. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ---------- SAFE DEFAULTS ----------
  const safeArtistMerch: Merch[] = Array.isArray(artistMerch) ? artistMerch : [];

  return (
    <>
      <TabsContent value="merch">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">My Merchandise</h2>
              <p className="text-sm text-muted-foreground">Manage your products</p>
            </div>
            <Button
              className="gradient-primary hover:opacity-90 w-full sm:w-auto"
              onClick={() => setShowAddMerchModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Merchandise
            </Button>
          </div>

          {/* Current Merchandise Cost Information */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Current Merchandise Costs (Set by Admin):</p>
                {merchCosts ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Base Cost:</span>
                      <br />
                      <span className="font-medium">₹{merchCosts.baseCost}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manufacturing:</span>
                      <br />
                      <span className="font-medium">₹{merchCosts.manufacturingCost}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Shipping:</span>
                      <br />
                      <span className="font-medium">₹{merchCosts.shippingCost}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <br />
                      <span className="font-medium">{merchCosts.platformCommission}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading cost information...</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  These costs will be automatically deducted from your earnings when customers purchase your merchandise.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {merchLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="aspect-square bg-muted rounded mb-4"></div>
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : merchError ? (
            <Card className="text-center py-12 border-red-200">
              <CardContent>
                <div className="text-red-500 mb-4">
                  <ShoppingBag className="w-16 h-16 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold mb-2">Failed to load merchandise</h3>
                  <p className="text-sm">Please try refreshing the page</p>
                </div>
              </CardContent>
            </Card>
          ) : safeArtistMerch.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {safeArtistMerch.map((item, index) => (
                <Card key={item._id} data-testid={`merch-item-${index}`}>
                  <CardContent className="p-6">
                    <div className="aspect-square rounded-lg overflow-hidden mb-4">
                      <img
                        src={
                          item.images?.[0] ||
                          "https://images.unsplash.com/photo-1521572163474-686442075746?w=300&h=300"
                        }
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">₹{item.price}</span>
                        <span className="text-sm text-muted-foreground">
                          Stock: {item.stock}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditingMerch(item);
                            setShowEditMerchModal(true);
                          }}
                          data-testid={`edit-merch-${index}`}
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => deleteMerchMutation.mutate(item._id)}
                          disabled={deleteMerchMutation.isPending}
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
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No merchandise added</h3>
                <p className="text-muted-foreground mb-4">
                  Start selling products to your fans.
                </p>
                <Button
                  className="gradient-primary hover:opacity-90"
                  onClick={() => setShowAddMerchModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Merchandise
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>

      {/* Add Merch Modal */}
      <Dialog open={showAddMerchModal} onOpenChange={setShowAddMerchModal}>
        <DialogContent className="max-w-lg max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add New Merchandise</DialogTitle>
            <DialogDescription>Add a new product to your store</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <MerchForm
              onSubmit={(data) => createMerchMutation.mutate(data)}
              onCancel={() => setShowAddMerchModal(false)}
              isLoading={createMerchMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Merch Modal */}
      <Dialog open={showEditMerchModal} onOpenChange={setShowEditMerchModal}>
        <DialogContent className="max-w-lg max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Merchandise</DialogTitle>
            <DialogDescription>Update your product details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <MerchForm
              onSubmit={(data) => editingMerch && editMerchMutation.mutate({ id: editingMerch._id, formData: data })}
              onCancel={() => {
                setShowEditMerchModal(false);
                setEditingMerch(null);
              }}
              isLoading={editMerchMutation.isPending}
              initialData={editingMerch}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
