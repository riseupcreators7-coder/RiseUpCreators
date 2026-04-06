import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, History, Loader2, Copy, CheckCircle, CreditCard, IndianRupee, Coins } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getCreatorAuthHeaders } from "@/pages/creator-dashboard/utils";

interface WalletBalance {
  balance: string;
  balanceETH: string;
  walletAddress: string;
  note?: string;
}

interface WalletTransaction {
  _id: string;
  type: "credit" | "debit";
  amount: string;
  amountETH: string;
  description: string;
  transactionHash?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

interface WalletFundingProps {
  walletAddress?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function WalletFunding({ walletAddress }: WalletFundingProps) {
  const queryClient = useQueryClient();
  const [showFundDialog, setShowFundDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Fetch wallet balance
  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery<WalletBalance>({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => {
      const response = await fetch("/api/wallet/balance", {
        method: "POST",
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Balance fetch failed:", errorData);
        throw new Error(errorData.message || "Failed to fetch balance");
      }
      const data = await response.json();
      console.log("💰 Balance API response:", data); // Debug log
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 3, // Retry failed requests
    retryDelay: 2000, // Wait 2 seconds between retries
  });

  // Fetch wallet history
  const { data: historyData, isLoading: historyLoading } = useQuery<{ transactions: WalletTransaction[] }>({
    queryKey: ["/api/wallet/history"],
    queryFn: async () => {
      const response = await fetch("/api/wallet/history", {
        method: "POST",
        headers: getCreatorAuthHeaders()
      });
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: showHistoryDialog,
  });

  // Add funds mutation
  const addFundsMutation = useMutation({
    mutationFn: async (paymentData: {
      amount: number;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      const response = await fetch("/api/wallet/add-fund", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(paymentData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add funds");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/history"] });
      setShowFundDialog(false);
      setFundAmount("");
      toast({
        title: "Funds Added Successfully!",
        description: "Your wallet has been funded and is ready for transactions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to add funds to wallet",
        variant: "destructive"
      });
    }
  });

  // Create Razorpay order
  const createOrderMutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          ...getCreatorAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          amount: amount, // Send amount in INR, backend will convert to paise
          currency: "INR",
          receipt: `wallet_fund_${Date.now()}`
        })
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
    onSuccess: (orderData) => {
      initiateRazorpayPayment(orderData);
    },
    onError: (error: Error) => {
      toast({
        title: "Order Creation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const initiateRazorpayPayment = (orderData: any) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_your_key_id",
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Rise Up Creators",
      description: "Wallet Funding",
      order_id: orderData.id,
      handler: function (response: any) {
        // Convert amount from paise to wei (for blockchain)
        // Using BigInt to handle large numbers safely
        const amountInINR = orderData.amount / 100; // Convert paise to INR
        const amountInWei = BigInt(amountInINR) * BigInt("1000000000000000000"); // Convert INR to wei (1 INR = 1e18 wei for demo)
        
        addFundsMutation.mutate({
          amount: Number(amountInWei),
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        });
      },
      prefill: {
        name: "Test User",
        email: "test@example.com",
        contact: "9999999999"
      },
      notes: {
        purpose: "wallet_funding",
        user_id: "test_user"
      },
      theme: {
        color: "#3B82F6"
      },
      method: {
        upi: true,
        card: true,
        netbanking: true,
        wallet: true,
        emi: false,
        paylater: false
      },
      modal: {
        ondismiss: function() {
          toast({
            title: "Payment Cancelled",
            description: "Payment was cancelled by user",
            variant: "destructive"
          });
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const handleFundWallet = () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive"
      });
      return;
    }

    if (amount < 10) {
      toast({
        title: "Minimum Amount",
        description: "Minimum funding amount is ₹10",
        variant: "destructive"
      });
      return;
    }

    createOrderMutation.mutate(amount);
  };

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      toast({
        title: "Copied!",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const formatBalance = (balance: string) => {
    try {
      const eth = parseFloat(balance);
      return eth.toFixed(6);
    } catch {
      return "0.000000";
    }
  };

  const formatBalanceINR = (balance: string) => {
    try {
      // Convert wei to INR (1 INR = 1e18 wei for demo)
      const wei = parseFloat(balance);
      const inr = wei / 1000000000000000000; // Convert wei to INR
      return inr.toFixed(2);
    } catch {
      return "0.00";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Wallet Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Address */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-blue-700 dark:text-blue-300 font-medium">Your Wallet Address</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={copyWalletAddress}
              className="h-8 px-2"
            >
              {copiedAddress ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <div className="font-mono text-sm bg-white dark:bg-gray-800 p-2 rounded border break-all">
            {walletAddress || "Loading..."}
          </div>
        </div>

        {/* Balance Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-green-600" />
              <Label className="text-green-700 dark:text-green-300 font-medium">Wallet Balance</Label>
            </div>
            {balanceLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : balanceError ? (
              <div className="space-y-1">
                <div className="text-lg font-medium text-orange-600 dark:text-orange-400">
                  Balance Unavailable
                </div>
                <div className="text-xs text-orange-500">
                  Service temporarily down. Try refreshing.
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                  ₹{formatBalanceINR(balanceData?.balance || "0")}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  {formatBalance(balanceData?.balanceETH || "0")} ETH
                </div>
                {balanceData?.note && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400">
                    {balanceData.note}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Dialog open={showFundDialog} onOpenChange={setShowFundDialog}>
              <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Funds
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Add Funds to Wallet
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> Funds will be added to your blockchain wallet for NFT transactions, auctions, and other blockchain operations.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Amount (INR)</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        className="pl-10"
                        min="10"
                        step="1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimum amount: ₹10
                    </p>
                  </div>

                  <Button
                    onClick={handleFundWallet}
                    disabled={createOrderMutation.isPending || addFundsMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {(createOrderMutation.isPending || addFundsMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay with Razorpay
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" size="lg">
                  <History className="w-4 h-4 mr-2" />
                  Transaction History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Transaction History
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : historyData?.transactions && historyData.transactions.length > 0 ? (
                    <div className="space-y-3">
                      {historyData.transactions.map((transaction) => (
                        <div
                          key={transaction._id}
                          className="border rounded-lg p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={transaction.type === "credit" ? "default" : "secondary"}
                                className={
                                  transaction.type === "credit"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                }
                              >
                                {transaction.type === "credit" ? "+" : "-"}{formatBalance(transaction.amountETH)} ETH
                              </Badge>
                              <Badge
                                variant={
                                  transaction.status === "completed"
                                    ? "default"
                                    : transaction.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {transaction.status}
                              </Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatDate(transaction.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{transaction.description}</p>
                          {transaction.razorpayPaymentId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              Payment ID: {transaction.razorpayPaymentId}
                            </p>
                          )}
                          {transaction.transactionHash && (
                            <p className="text-xs text-muted-foreground font-mono">
                              Tx Hash: {transaction.transactionHash.slice(0, 10)}...{transaction.transactionHash.slice(-8)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No transactions found</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Info */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Add funds to your wallet to create NFT collections, mint NFTs, participate in auctions, and perform other blockchain transactions. Balance is displayed in INR for convenience.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}