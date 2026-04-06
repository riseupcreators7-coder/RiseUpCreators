import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { Wallet, Loader2, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function WalletConnectButton() {
  const { address, isConnected, isConnecting, chainId, connect, disconnect } = useWallet();

  const getChainName = (chainId: number | null) => {
    switch (chainId) {
      case 1: return "Ethereum";
      case 137: return "Polygon";
      case 80001: return "Mumbai Testnet";
      case 5: return "Goerli Testnet";
      default: return "Unknown Network";
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Button
        onClick={connect}
        disabled={isConnecting}
        variant="outline"
        className="gap-2"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </>
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wallet className="w-4 h-4" />
          {formatAddress(address!)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Wallet Info</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-muted-foreground">Address:</span>
            <span className="font-mono">{formatAddress(address!)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network:</span>
            <span>{getChainName(chainId)}</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="text-red-600">
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
