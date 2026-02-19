import axios from "axios";

const NFT_API_BASE_URL = process.env.NFT_API_BASE_URL || "https://riseup-api.himotechglobal.com";

interface NFTAuthResponse {
  success: boolean;
  username: string;
  address: string;
  accessToken: string;
}

interface NFTUserData {
  accessToken: string;
  walletAddress: string;
}

/**
 * Register user with NFT marketplace API
 */
export async function registerNFTUser(username: string, password: string): Promise<NFTAuthResponse> {
  try {
    console.log("📝 Registering user with NFT marketplace:", username);
    
    const response = await axios.post(`${NFT_API_BASE_URL}/api/users/register`, {
      username,
      password
    });

    console.log("✅ NFT marketplace registration successful");
    console.log("   Wallet Address:", response.data.address);
    return response.data;
  } catch (error: any) {
    console.error("❌ NFT marketplace registration failed:", error.response?.data || error.message);
    
    // If user already exists, try to login instead
    if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
      console.log("ℹ️ User exists, attempting login instead...");
      return loginNFTUser(username, password);
    }
    
    throw new Error(error.response?.data?.message || "Failed to register with NFT marketplace");
  }
}

/**
 * Login user with NFT marketplace API
 */
export async function loginNFTUser(username: string, password: string): Promise<NFTAuthResponse> {
  try {
    console.log("🔐 Logging in to NFT marketplace:", username);
    
    const response = await axios.post(`${NFT_API_BASE_URL}/api/users/login`, {
      username,
      password
    });

    console.log("✅ NFT marketplace login successful");
    console.log("   Wallet Address:", response.data.address);
    return response.data;
  } catch (error: any) {
    console.error("❌ NFT marketplace login failed:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Failed to login to NFT marketplace");
  }
}

/**
 * Get NFT marketplace token from storage
 */
export function getNFTAuthToken(userId: string): string | null {
  const userData = nftTokenStore.get(userId);
  return userData?.accessToken || null;
}

/**
 * Get NFT marketplace wallet address from storage
 */
export function getNFTWalletAddress(userId: string): string | null {
  const userData = nftTokenStore.get(userId);
  return userData?.walletAddress || null;
}

/**
 * Store NFT marketplace token and wallet address
 */
export function setNFTAuthToken(userId: string, token: string, walletAddress?: string): void {
  const existing = nftTokenStore.get(userId);
  nftTokenStore.set(userId, {
    accessToken: token,
    walletAddress: walletAddress || existing?.walletAddress || ""
  });
}

/**
 * Clear NFT marketplace token
 */
export function clearNFTAuthToken(userId: string): void {
  nftTokenStore.delete(userId);
}

// In-memory token store (should be replaced with database in production)
const nftTokenStore = new Map<string, NFTUserData>();
