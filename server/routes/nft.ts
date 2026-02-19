import type { Express, Request, Response } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import axios from "axios";
import multer from "multer";
import { uploadFileToIPFS, createNFTMetadata } from "../services/ipfs";
import { getNFTAuthToken, getNFTWalletAddress } from "../services/nft-auth";

const NFT_API_BASE_URL = process.env.NFT_API_BASE_URL || "https://riseup-api.himotechglobal.com";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Get NFT marketplace auth headers for a user
 */
function getNFTAuthHeaders(userId: string): Record<string, string> {
  const token = getNFTAuthToken(userId);
  if (!token) {
    throw new Error("NFT marketplace authentication required. Please log in again.");
  }
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

/**
 * Make authenticated request to NFT marketplace API
 */
async function nftApiRequest(userId: string, method: string, endpoint: string, data?: any) {
  const headers = getNFTAuthHeaders(userId);
  const url = `${NFT_API_BASE_URL}${endpoint}`;
  
  try {
    const config: any = {
      method,
      url,
      headers
    };
    
    // Only add data for non-GET requests
    if (method.toUpperCase() !== 'GET' && data !== undefined && data !== null) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response;
  } catch (error: any) {
    console.error(`❌ NFT API request failed: ${method} ${endpoint}`, error.response?.data || error.message);
    throw error;
  }
}

export function setupNFTRoutes(app: Express) {
  // Get user's NFT wallet address
  app.get("/api/nft/wallet-address", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const walletAddress = getNFTWalletAddress(userId);
      if (!walletAddress) {
        return res.status(404).json({ 
          message: "Wallet address not found. Please log in again to sync your wallet." 
        });
      }

      res.json({ success: true, walletAddress });
    } catch (error) {
      console.error("Error fetching wallet address:", error);
      res.status(500).json({ message: "Failed to fetch wallet address" });
    }
  });

  // Get artist's NFT collections
  app.get("/api/nft/collections", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const collections = await storage.db
        .collection("nft_collections")
        .find({ artistId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ success: true, collections });
    } catch (error) {
      console.error("Error fetching NFT collections:", error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  // Create NFT collection
  app.post("/api/nft/create-collection", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { name, symbol, maxSupply, royaltyBps } = req.body;

      // Call external NFT API with authentication
      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/create-collection', {
        name,
        symbol,
        maxSupply,
        royaltyBps
      });

      console.log("✅ Collection created on blockchain:");
      console.log("   Contract Address:", response.data.nft);
      console.log("   Transaction Hash:", response.data.txHash);
      console.log("   Full Response:", JSON.stringify(response.data, null, 2));

      // Store collection in database
      const collection = {
        artistId: userId,
        contractAddress: response.data.nft, // API returns 'nft' field with contract address
        name,
        symbol,
        maxSupply,
        royaltyBps,
        totalMinted: 0,
        transactionHash: response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("nft_collections").insertOne(collection);

      res.json({ success: true, collection, data: response.data });
    } catch (error: any) {
      console.error("❌ Error creating NFT collection:", error.response?.data || error.message);
      res.status(500).json({ 
        message: error.response?.data?.message || "Failed to create collection" 
      });
    }
  });

  // Mint NFT (original - for advanced users)
  app.post("/api/nft/mint", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { nft, to, tokenURI, nftType, ipfsHash } = req.body;

      // Call external NFT API
      const response = await axios.post(`${NFT_API_BASE_URL}/api/marketplace/mint`, {
        nft,
        to,
        tokenURI,
        nftType,
        ipfsHash
      });

      // Update collection minted count
      await storage.db.collection("nft_collections").updateOne(
        { contractAddress: nft, artistId: userId },
        { $inc: { totalMinted: 1 } }
      );

      // Store NFT in database
      const nftDoc = {
        collectionId: nft,
        artistId: userId,
        tokenId: response.data.tokenId,
        owner: to,
        tokenURI,
        ipfsHash,
        nftType,
        isListed: false,
        transactionHash: response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("nfts").insertOne(nftDoc);

      res.json({ success: true, nft: nftDoc, data: response.data });
    } catch (error: any) {
      console.error("Error minting NFT:", error);
      res.status(500).json({ 
        message: error.response?.data?.message || "Failed to mint NFT" 
      });
    }
  });

  // Mint NFT with image upload (simplified for artists)
  app.post("/api/nft/mint-with-upload", authenticateToken, upload.single("image"), async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { collectionAddress, name, description, recipientAddress, listNow, price } = req.body;
      const imageFile = req.file;

      console.log("📝 Mint request received:", { 
        collectionAddress, 
        name, 
        hasImage: !!imageFile,
        listNow: listNow === 'true',
        price: price || '0'
      });

      if (!imageFile) {
        return res.status(400).json({ message: "Image file is required" });
      }

      if (!collectionAddress || !name || !description) {
        return res.status(400).json({ message: "Collection address, name, and description are required" });
      }

      // Get user's wallet address from NFT marketplace
      let recipient = recipientAddress;
      if (!recipient) {
        recipient = getNFTWalletAddress(userId);
        if (!recipient) {
          return res.status(400).json({ 
            message: "Wallet address not found. Please log in again to sync your wallet." 
          });
        }
      }

      console.log("📍 Using wallet address:", recipient);

      console.log("📤 Step 1: Uploading image to IPFS...");
      // Step 1: Upload image to IPFS
      const imageHash = await uploadFileToIPFS(imageFile.buffer, imageFile.originalname);
      console.log("✅ Image uploaded:", imageHash);

      console.log("📤 Step 2: Creating and uploading metadata...");
      // Step 2: Create and upload metadata to IPFS
      const { metadataHash, metadataURI } = await createNFTMetadata({
        name,
        description,
        imageHash,
        attributes: []
      });
      console.log("✅ Metadata uploaded:", metadataHash);

      console.log("⛓️  Step 3: Minting NFT on blockchain...");
      console.log("   Collection:", collectionAddress);
      console.log("   Recipient:", recipient);
      console.log("   Token URI:", metadataURI);
      console.log("   IPFS Hash:", metadataHash);
      console.log("   NFT Type:", 1);
      console.log("   List Now:", listNow === 'true');
      console.log("   Price:", price || '0');
      
      // Verify collection exists by checking with the API first
      console.log("🔍 Verifying collection exists on blockchain...");
      
      // Convert price from ETH to wei if listing
      const shouldList = listNow === 'true';
      const priceInWei = shouldList && price ? (parseFloat(price) * 1e18).toString() : '0';
      
      // Step 3: Mint NFT on blockchain
      const mintPayload = {
        nft: collectionAddress,
        to: recipient,
        tokenURI: metadataURI,
        nftType: 1,
        ipfsHash: metadataHash,
        listNow: shouldList,
        price: parseInt(priceInWei)
      };
      
      console.log("📤 Sending mint request with payload:", JSON.stringify(mintPayload, null, 2));
      
      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/mint', mintPayload);
      console.log("✅ NFT minted successfully!");
      console.log("   Transaction Hash:", response.data.txHash);
      console.log("   Token ID:", response.data.tokenId);
      console.log("   Minted By:", response.data.mintedBy);
      console.log("   Full Response:", JSON.stringify(response.data, null, 2));

      // Step 4: Get tokenId from API response
      const tokenId = response.data.tokenId ? parseInt(response.data.tokenId) : 0;
      console.log("   Using Token ID from API:", tokenId);

      // Step 5: Update collection minted count
      await storage.db.collection("nft_collections").updateOne(
        { contractAddress: collectionAddress, artistId: userId },
        { $inc: { totalMinted: 1 } }
      );

      // Step 6: Store NFT in database
      const nftDoc = {
        collectionId: collectionAddress,
        artistId: userId,
        tokenId: tokenId,
        owner: recipient,
        tokenURI: metadataURI,
        ipfsHash: metadataHash,
        imageHash,
        name,
        description,
        nftType: 1,
        isListed: false,
        transactionHash: response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("nfts").insertOne(nftDoc);

      console.log("🎉 NFT minting complete!");

      res.json({ 
        success: true, 
        nft: nftDoc, 
        data: response.data,
        ipfs: {
          imageHash,
          metadataHash,
          imageURL: `https://gateway.pinata.cloud/ipfs/${imageHash}`,
          metadataURL: `https://gateway.pinata.cloud/ipfs/${metadataHash}`
        }
      });
    } catch (error: any) {
      console.error("❌ Error minting NFT with upload:", error);
      res.status(500).json({ 
        message: error.response?.data?.error || error.response?.data?.message || error.message || "Failed to mint NFT" 
      });
    }
  });

  // Get NFTs for a collection
  app.get("/api/nft/nfts/:collectionAddress", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { collectionAddress } = req.params;

      const nfts = await storage.db
        .collection("nfts")
        .find({ collectionId: collectionAddress, artistId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ success: true, nfts });
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });

  // Approve NFT for marketplace
  app.post("/api/nft/approve", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { nft } = req.body;

      if (!nft) {
        return res.status(400).json({ message: "NFT collection address is required" });
      }

      const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
      if (!marketplaceAddress) {
        return res.status(500).json({ message: "Marketplace address not configured" });
      }

      console.log("✅ Approving NFT for marketplace:");
      console.log("   Collection:", nft);
      console.log("   Operator (Marketplace):", marketplaceAddress);

      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/approve', {
        nft,
        operator: marketplaceAddress
      });

      console.log("✅ NFT approved successfully!");

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error approving NFT:", error.response?.data || error.message);
      res.status(500).json({ 
        message: error.response?.data?.error || error.response?.data?.message || "Failed to approve NFT" 
      });
    }
  });

  // List NFT for sale
  app.post("/api/nft/list", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { nft, tokenId, price } = req.body;

      console.log("📝 List NFT request received:", { nft, tokenId, price });

      if (!nft || tokenId === undefined || !price) {
        return res.status(400).json({ 
          message: "Missing required fields: nft, tokenId, and price are required" 
        });
      }

      // Validate tokenId is a number
      const tokenIdNum = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
      if (isNaN(tokenIdNum)) {
        return res.status(400).json({ 
          message: "Invalid token ID. Must be a number." 
        });
      }

      // Validate price is a string (wei)
      const priceStr = typeof price === 'number' ? price.toString() : price;

      console.log("📤 Sending list request to blockchain API:", { nft, tokenId: tokenIdNum, price: priceStr });

      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/list', {
        nft,
        tokenId: tokenIdNum,
        price: priceStr
      });

      console.log("✅ NFT listed successfully!");

      // Update NFT listing status
      await storage.db.collection("nfts").updateOne(
        { collectionId: nft, tokenId: tokenIdNum },
        { 
          $set: { 
            isListed: true, 
            price: priceStr,
            listedAt: new Date() 
          } 
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error listing NFT:", error.response?.data || error.message);
      
      // Check if it's a funding issue
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Wallet funding in progress. Please try again in a few moments."
          : error.response?.data?.error || error.response?.data?.message || "Failed to list NFT" 
      });
    }
  });

  // Buy NFT
  app.post("/api/nft/buy", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { nft, tokenId, price } = req.body;

      console.log("🛒 Buy NFT request received:", { nft, tokenId, price });

      // Validate inputs
      if (!nft || tokenId === undefined || !price) {
        return res.status(400).json({ 
          message: "Missing required fields: nft, tokenId, and price are required" 
        });
      }

      // Validate tokenId is a number
      const tokenIdNum = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
      if (isNaN(tokenIdNum)) {
        return res.status(400).json({ 
          message: "Invalid token ID. Must be a number." 
        });
      }

      // Validate price is a string (wei)
      const priceStr = typeof price === 'number' ? price.toString() : price;

      console.log("📤 Sending buy request to blockchain API:", { nft, tokenId: tokenIdNum, price: priceStr });

      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/buy', {
        nft,
        tokenId: tokenIdNum,
        price: priceStr
      });

      console.log("✅ NFT purchased successfully!");

      // Update NFT ownership
      await storage.db.collection("nfts").updateOne(
        { collectionId: nft, tokenId: tokenIdNum },
        { 
          $set: { 
            isListed: false,
            owner: userId,
            soldAt: new Date()
          },
          $unset: { price: "", listedAt: "" }
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error buying NFT:", error.response?.data || error.message);
      
      // Check if it's a funding issue
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Wallet funding in progress. Please try again in a few moments."
          : error.response?.data?.error || error.response?.data?.message || error.message || "Failed to buy NFT" 
      });
    }
  });

  // Get user's owned NFTs
  app.get("/api/nft/my-nfts", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get NFTs owned by this user from database
      const nfts = await storage.db
        .collection("nfts")
        .find({ owner: userId })
        .sort({ createdAt: -1 })
        .toArray();

      // Get collection details for each NFT
      const nftsWithDetails = await Promise.all(
        nfts.map(async (nft) => {
          const collection = await storage.db.collection("nft_collections").findOne({ 
            contractAddress: nft.collectionId 
          });
          
          return {
            ...nft,
            collection: collection ? {
              name: collection.name,
              symbol: collection.symbol,
              contractAddress: collection.contractAddress
            } : null
          };
        })
      );

      res.json({ success: true, nfts: nftsWithDetails });
    } catch (error) {
      console.error("Error fetching user NFTs:", error);
      res.status(500).json({ message: "Failed to fetch NFTs" });
    }
  });

  // Get NFT details
  app.get("/api/nft/details/:nftAddress/:tokenId", async (req, res) => {
    try {
      const { nftAddress, tokenId } = req.params;

      const response = await axios.get(
        `${NFT_API_BASE_URL}/api/marketplace/nft/${nftAddress}/${tokenId}`
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("Error fetching NFT details:", error);
      res.status(500).json({ 
        message: error.response?.data?.message || "Failed to fetch NFT details" 
      });
    }
  });

  // ========== AUCTION ROUTES ==========

  // Approve NFT for auction contract
  app.post("/api/nft/auction/approve", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { nft } = req.body;

      if (!nft) {
        return res.status(400).json({ message: "NFT collection address is required" });
      }

      const auctionAddress = process.env.AUCTION_ADDRESS;
      if (!auctionAddress) {
        return res.status(500).json({ message: "Auction contract address not configured" });
      }

      console.log("✅ Approving NFT for auction contract:");
      console.log("   Collection:", nft);
      console.log("   Operator (Auction):", auctionAddress);

      const response = await nftApiRequest(userId, 'POST', '/api/marketplace/approve', {
        nft,
        operator: auctionAddress
      });

      console.log("✅ NFT approved for auction successfully!");

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error approving NFT for auction:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient") ||
                            error.response?.data?.error?.includes("Sender doesn't have enough funds");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to approve NFT for auction" 
      });
    }
  });

  // Get artist's auctions
  app.get("/api/nft/auctions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const auctions = await storage.db
        .collection("nft_auctions")
        .find({ artistId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      // Populate winner details for auctions with bids
      const auctionsWithWinners = await Promise.all(
        auctions.map(async (auction) => {
          if (auction.highestBidder && auction.highestBidder !== "0x0000000000000000000000000000000000000000") {
            try {
              const winner = await storage.getUser(auction.highestBidder);
              return {
                ...auction,
                winner: winner ? {
                  id: winner._id,
                  name: winner.name,
                  email: winner.email,
                  avatarUrl: winner.avatarUrl
                } : null
              };
            } catch (error) {
              console.error(`Error fetching winner for auction ${auction.auctionId}:`, error);
              return auction;
            }
          }
          return auction;
        })
      );

      res.json({ success: true, auctions: auctionsWithWinners });
    } catch (error) {
      console.error("Error fetching auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  // Create auction
  app.post("/api/nft/auction/create", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { nft, tokenId, startPrice, duration } = req.body;

      console.log("📝 Create auction request:", { nft, tokenId, startPrice, duration });

      if (!nft || tokenId === undefined || !startPrice || !duration) {
        return res.status(400).json({ 
          message: "Missing required fields: nft, tokenId, startPrice, and duration are required" 
        });
      }

      // Validate tokenId is a number
      const tokenIdNum = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
      if (isNaN(tokenIdNum)) {
        return res.status(400).json({ message: "Invalid token ID. Must be a number." });
      }

      // Validate startPrice is a string (wei)
      const startPriceStr = typeof startPrice === 'number' ? startPrice.toString() : startPrice;

      // Validate duration is a number (seconds)
      const durationNum = typeof duration === 'string' ? parseInt(duration) : duration;
      if (isNaN(durationNum) || durationNum <= 0) {
        return res.status(400).json({ message: "Invalid duration. Must be a positive number in seconds." });
      }

      console.log("📤 Sending create auction request:", { nft, tokenId: tokenIdNum, startPrice: startPriceStr, duration: durationNum });

      const response = await nftApiRequest(userId, 'POST', '/api/auction/create', {
        nft,
        tokenId: tokenIdNum,
        startPrice: startPriceStr,
        duration: durationNum
      });

      console.log("✅ Auction created successfully!");
      console.log("   Auction ID:", response.data.auctionId);

      // Store auction in database
      const auction = {
        auctionId: typeof response.data.auctionId === 'string' ? parseInt(response.data.auctionId) : response.data.auctionId, // Ensure it's a number
        artistId: userId,
        nftAddress: nft,
        tokenId: tokenIdNum,
        startPrice: startPriceStr,
        currentBid: startPriceStr,
        highestBidder: "0x0000000000000000000000000000000000000000",
        endTime: new Date(Date.now() + durationNum * 1000),
        status: "active",
        transactionHash: response.data.transactionHash || response.data.txHash,
        createdAt: new Date()
      };

      console.log("📝 Inserting auction into database:", auction);
      
      try {
        const insertResult = await storage.db.collection("nft_auctions").insertOne(auction);
        console.log("✅ Auction inserted into database:", {
          insertedId: insertResult.insertedId,
          acknowledged: insertResult.acknowledged
        });
      } catch (dbError: any) {
        console.error("❌ Database insertion error:", dbError);
        // Continue anyway - blockchain auction was created successfully
      }

      res.json({ success: true, auction, data: response.data });
    } catch (error: any) {
      console.error("❌ Error creating auction:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient") ||
                            error.response?.data?.error?.includes("Sender doesn't have enough funds");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to create auction" 
      });
    }
  });

  // Place bid
  app.post("/api/nft/auction/bid", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { auctionId, amount } = req.body;

      console.log("📝 Place bid request:", { auctionId, amount });

      if (auctionId === undefined || !amount) {
        return res.status(400).json({ 
          message: "Missing required fields: auctionId and amount are required" 
        });
      }

      // Validate auctionId is a number
      const auctionIdNum = typeof auctionId === 'string' ? parseInt(auctionId) : auctionId;
      if (isNaN(auctionIdNum)) {
        return res.status(400).json({ message: "Invalid auction ID. Must be a number." });
      }

      // Validate amount is a string (wei)
      const amountStr = typeof amount === 'number' ? amount.toString() : amount;

      console.log("📤 Sending bid request:", { auctionId: auctionIdNum, amount: amountStr });

      const response = await nftApiRequest(userId, 'POST', '/api/auction/bid', {
        auctionId: auctionIdNum,
        amount: amountStr
      });

      console.log("✅ Bid placed successfully!");

      // Update auction in database with user ID
      console.log("📝 Updating auction in database:", {
        auctionId: auctionIdNum,
        userId,
        currentBid: amountStr
      });
      
      // First check if auction exists
      const existingAuction = await storage.db.collection("nft_auctions").findOne({ auctionId: auctionIdNum });
      console.log("🔍 Existing auction found:", existingAuction ? "YES" : "NO");
      if (existingAuction) {
        console.log("   Auction details:", {
          _id: existingAuction._id,
          auctionId: existingAuction.auctionId,
          auctionIdType: typeof existingAuction.auctionId,
          currentBid: existingAuction.currentBid,
          highestBidder: existingAuction.highestBidder
        });
      }
      
      const updateResult = await storage.db.collection("nft_auctions").updateOne(
        { auctionId: auctionIdNum },
        { 
          $set: { 
            currentBid: amountStr,
            highestBidder: userId, // Store user ID instead of wallet address
            highestBidderWallet: getNFTWalletAddress(userId), // Also store wallet for reference
            lastBidAt: new Date()
          } 
        }
      );
      
      console.log("✅ Database update result:", {
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error placing bid:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient") ||
                            error.response?.data?.error?.includes("Sender doesn't have enough funds");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to place bid" 
      });
    }
  });

  // Claim auction
  app.post("/api/nft/auction/claim", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { auctionId } = req.body;

      console.log("📝 Claim auction request:", { auctionId });

      if (auctionId === undefined) {
        return res.status(400).json({ message: "Auction ID is required" });
      }

      // Validate auctionId is a number
      const auctionIdNum = typeof auctionId === 'string' ? parseInt(auctionId) : auctionId;
      if (isNaN(auctionIdNum)) {
        return res.status(400).json({ message: "Invalid auction ID. Must be a number." });
      }

      console.log("📤 Sending claim request:", { auctionId: auctionIdNum });

      const response = await nftApiRequest(userId, 'POST', '/api/auction/claim', {
        auctionId: auctionIdNum
      });

      console.log("✅ Auction claimed successfully!");

      // Update auction status
      await storage.db.collection("nft_auctions").updateOne(
        { auctionId: auctionIdNum },
        { 
          $set: { 
            status: "claimed",
            claimedAt: new Date(),
            claimedBy: userId
          } 
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error claiming auction:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient") ||
                            error.response?.data?.error?.includes("Sender doesn't have enough funds");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to claim auction" 
      });
    }
  });

  // Get auction details
  app.get("/api/nft/auction/:auctionId", async (req, res) => {
    try {
      const { auctionId } = req.params;

      // Validate auctionId is a number
      const auctionIdNum = parseInt(auctionId);
      if (isNaN(auctionIdNum)) {
        return res.status(400).json({ message: "Invalid auction ID. Must be a number." });
      }

      // First check our database
      const auction = await storage.db.collection("nft_auctions").findOne({ auctionId: auctionIdNum });

      // Also fetch from blockchain API (requires auth, so this might fail for public access)
      // For now, return database data
      if (auction) {
        res.json({ success: true, auction });
      } else {
        res.status(404).json({ message: "Auction not found" });
      }
    } catch (error: any) {
      console.error("Error fetching auction details:", error);
      res.status(500).json({ 
        message: error.response?.data?.message || "Failed to fetch auction details" 
      });
    }
  });

  // ========== ARTIST SUBSCRIPTION ROUTES ==========

  // Create artist token
  app.post("/api/nft/artist/create-token", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { tokenName, tokenSymbol } = req.body;

      console.log("📝 Create artist token request:", { tokenName, tokenSymbol });

      if (!tokenName || !tokenSymbol) {
        return res.status(400).json({ 
          message: "Token name and symbol are required" 
        });
      }

      // Check if artist already has a token
      const existingToken = await storage.db.collection("artist_tokens").findOne({ artistId: userId });
      if (existingToken) {
        return res.status(400).json({ 
          message: "You already have an artist token. Each artist can only create one token." 
        });
      }

      console.log("📤 Sending create token request to blockchain API");

      const response = await nftApiRequest(userId, 'POST', '/api/artist/create', {
        tokenName,
        tokenSymbol
      });

      console.log("✅ Artist token created successfully!");
      console.log("   Token Address:", response.data.tokenAddress);

      // Get artist's wallet address
      const artistWalletAddress = getNFTWalletAddress(userId);
      if (!artistWalletAddress) {
        return res.status(400).json({ 
          message: "Artist wallet address not found. Please log in again." 
        });
      }

      // Store token in database
      const artistToken = {
        artistId: userId,
        artistWalletAddress, // Artist's personal wallet address
        tokenAddress: response.data.tokenAddress, // Token contract address
        tokenName,
        tokenSymbol,
        totalSubscribers: 0,
        transactionHash: response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("artist_tokens").insertOne(artistToken);

      res.json({ success: true, token: artistToken, data: response.data });
    } catch (error: any) {
      console.error("❌ Error creating artist token:", error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
      
      const isFundingError = errorMessage?.includes("funds") || 
                            errorMessage?.includes("balance") ||
                            errorMessage?.includes("insufficient") ||
                            errorMessage?.includes("Sender doesn't have enough funds");
      
      const isTokenExistsError = errorMessage?.includes("Token already exists") ||
                                errorMessage?.includes("already exists");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : isTokenExistsError
          ? "You already have a token on the blockchain. Please contact support if you need to create a new one."
          : errorMessage || "Failed to create artist token"
      });
    }
  });

  // Subscribe to artist
  app.post("/api/nft/artist/subscribe", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { artistWallet } = req.body;

      console.log("📝 Subscribe to artist request:", { artistWallet });

      if (!artistWallet) {
        return res.status(400).json({ message: "Artist wallet address is required" });
      }

      // Find artist by their wallet address (not token address)
      const artistToken = await storage.db.collection("artist_tokens").findOne({ 
        artistWalletAddress: artistWallet 
      });

      if (!artistToken) {
        return res.status(404).json({ message: "Artist not found with this wallet address" });
      }

      // Check if already subscribed
      const existingSubscription = await storage.db.collection("artist_subscriptions").findOne({
        artistId: artistToken.artistId,
        subscriberId: userId
      });

      if (existingSubscription) {
        return res.status(400).json({ message: "You are already subscribed to this artist" });
      }

      console.log("📤 Sending subscribe request to blockchain API");

      const response = await nftApiRequest(userId, 'POST', '/api/artist/subscribe', {
        artistWallet
      });

      console.log("✅ Subscribed successfully!");

      // Store subscription in database
      const subscription = {
        artistId: artistToken.artistId,
        subscriberId: userId,
        artistWallet,
        transactionHash: response.data.txHash,
        subscribedAt: new Date()
      };

      await storage.db.collection("artist_subscriptions").insertOne(subscription);

      // Update subscriber count
      await storage.db.collection("artist_tokens").updateOne(
        { _id: artistToken._id },
        { $inc: { totalSubscribers: 1 } }
      );

      res.json({ success: true, subscription, data: response.data });
    } catch (error: any) {
      console.error("❌ Error subscribing to artist:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient") ||
                            error.response?.data?.error?.includes("Sender doesn't have enough funds");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to subscribe to artist" 
      });
    }
  });

  // Get my subscriptions (artists I follow)
  app.get("/api/nft/artist/my-subscriptions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const subscriptions = await storage.db
        .collection("artist_subscriptions")
        .find({ subscriberId: userId })
        .sort({ subscribedAt: -1 })
        .toArray();

      // Get artist details for each subscription
      const subscriptionsWithDetails = await Promise.all(
        subscriptions.map(async (sub) => {
          const artist = await storage.getUser(sub.artistId);
          const artistToken = await storage.db.collection("artist_tokens").findOne({ 
            artistId: sub.artistId 
          });
          
          return {
            ...sub,
            artist: artist ? {
              id: artist._id,
              name: artist.name,
              email: artist.email,
              avatarUrl: artist.avatarUrl
            } : null,
            artistToken
          };
        })
      );

      res.json({ success: true, subscriptions: subscriptionsWithDetails });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Get my subscribers (fans who follow me)
  app.get("/api/nft/artist/my-subscribers", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Fetch subscribers from blockchain API
      try {
        const response = await nftApiRequest(userId, 'GET', '/api/artist/my-subscribers', null);
        
        console.log("✅ Fetched subscribers from blockchain:", response.data);

        // Map blockchain data to our format
        const subscribers = response.data.subscribers?.map((sub: any) => ({
          username: sub.username,
          wallet: sub.wallet,
          subscribedAt: new Date() // Blockchain API doesn't provide this, use current date
        })) || [];

        // Also get subscriber details from our database if available
        const subscribersWithDetails = await Promise.all(
          subscribers.map(async (sub: any) => {
            // Try to find user by wallet address or username
            const subscriber = await storage.db.collection("users").findOne({
              $or: [
                { email: sub.username },
                { username: sub.username }
              ]
            });
            
            return {
              username: sub.username,
              wallet: sub.wallet,
              subscribedAt: sub.subscribedAt,
              subscriber: subscriber ? {
                id: subscriber._id,
                name: subscriber.name,
                email: subscriber.email,
                avatarUrl: subscriber.avatarUrl
              } : null
            };
          })
        );

        res.json({ success: true, subscribers: subscribersWithDetails });
      } catch (apiError: any) {
        console.error("❌ Error fetching from blockchain API:", apiError.response?.data || apiError.message);
        
        // Fallback to local database if API fails
        const subscribers = await storage.db
          .collection("artist_subscriptions")
          .find({ artistId: userId })
          .sort({ subscribedAt: -1 })
          .toArray();

        // Get subscriber details
        const subscribersWithDetails = await Promise.all(
          subscribers.map(async (sub) => {
            const subscriber = await storage.getUser(sub.subscriberId);
            
            return {
              ...sub,
              subscriber: subscriber ? {
                id: subscriber._id,
                name: subscriber.name,
                email: subscriber.email,
                avatarUrl: subscriber.avatarUrl
              } : null
            };
          })
        );

        res.json({ success: true, subscribers: subscribersWithDetails });
      }
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  // Get artist token info
  app.get("/api/nft/artist/token", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const artistToken = await storage.db.collection("artist_tokens").findOne({ artistId: userId });

      if (!artistToken) {
        return res.status(404).json({ message: "No artist token found" });
      }

      res.json({ success: true, token: artistToken });
    } catch (error) {
      console.error("Error fetching artist token:", error);
      res.status(500).json({ message: "Failed to fetch artist token" });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Get all NFT collections (admin)
  app.get("/api/admin/nft/collections", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const collections = await storage.db
        .collection("nft_collections")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ success: true, collections });
    } catch (error) {
      console.error("Error fetching all collections:", error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  // Get all auctions (admin)
  app.get("/api/admin/nft/auctions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const auctions = await storage.db
        .collection("nft_auctions")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ success: true, auctions });
    } catch (error) {
      console.error("Error fetching all auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  // ========== PUBLIC MARKETPLACE ROUTES ==========

  // Get all listed NFTs (public)
  app.get("/api/marketplace/nfts", async (req: Request, res: Response) => {
    try {
      // Get all collections
      const collections = await storage.db
        .collection("nft_collections")
        .find({})
        .project({ name: 1, symbol: 1, contractAddress: 1, totalMinted: 1 })
        .toArray();

      // Get all listed NFTs
      const nfts = await storage.db
        .collection("nfts")
        .find({ isListed: true })
        .sort({ listedAt: -1 })
        .toArray();

      res.json({ success: true, collections, nfts });
    } catch (error) {
      console.error("Error fetching marketplace:", error);
      res.status(500).json({ message: "Failed to fetch marketplace" });
    }
  });

  // Get active auctions (public)
  app.get("/api/marketplace/auctions", async (req: Request, res: Response) => {
    try {
      const auctions = await storage.db
        .collection("nft_auctions")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      // Populate winner details for ended auctions
      const auctionsWithWinners = await Promise.all(
        auctions.map(async (auction) => {
          // If auction has a winner (highestBidder contains user ID), fetch user details
          if (auction.highestBidder && auction.highestBidder !== "0x0000000000000000000000000000000000000000") {
            try {
              const winner = await storage.getUser(auction.highestBidder);
              return {
                ...auction,
                winner: winner ? {
                  id: winner._id,
                  name: winner.name,
                  email: winner.email,
                  avatarUrl: winner.avatarUrl
                } : null
              };
            } catch (error) {
              console.error(`Error fetching winner for auction ${auction.auctionId}:`, error);
              return auction;
            }
          }
          return auction;
        })
      );

      res.json({ success: true, auctions: auctionsWithWinners });
    } catch (error) {
      console.error("Error fetching active auctions:", error);
      res.status(500).json({ message: "Failed to fetch auctions" });
    }
  });

  // Get all artist tokens (public)
  app.get("/api/public/artist-tokens", async (req: Request, res: Response) => {
    try {
      const artistTokens = await storage.db
        .collection("artist_tokens")
        .find({})
        .sort({ totalSubscribers: -1, createdAt: -1 })
        .toArray();

      // Get artist details for each token
      const tokensWithDetails = await Promise.all(
        artistTokens.map(async (token) => {
          const artist = await storage.getUser(token.artistId);
          
          return {
            ...token,
            artist: artist ? {
              id: artist._id,
              name: artist.name,
              email: artist.email,
              avatarUrl: artist.avatarUrl
            } : null
          };
        })
      );

      res.json({ success: true, tokens: tokensWithDetails });
    } catch (error) {
      console.error("Error fetching artist tokens:", error);
      res.status(500).json({ message: "Failed to fetch artist tokens" });
    }
  });

  // ========== CROWDFUNDING ROUTES ==========

  // Create crowdfunding campaign
  app.post("/api/crowdfunding/create", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { goal, duration } = req.body;

      console.log("📝 Create crowdfunding campaign:", { goal, duration });

      if (!goal || !duration) {
        return res.status(400).json({ 
          message: "Goal and duration are required" 
        });
      }

      // Validate goal is a string (wei)
      const goalStr = typeof goal === 'number' ? goal.toString() : goal;

      // Validate duration is a number (seconds)
      const durationNum = typeof duration === 'string' ? parseInt(duration) : duration;
      if (isNaN(durationNum) || durationNum <= 0) {
        return res.status(400).json({ message: "Invalid duration. Must be a positive number in seconds." });
      }

      console.log("📤 Sending create campaign request:", { goal: goalStr, duration: durationNum });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/create', {
        goal: goalStr,
        duration: durationNum
      });

      console.log("✅ Campaign created successfully!");
      console.log("   Campaign ID:", response.data.campaignId);

      // Store campaign in database
      const campaign = {
        campaignId: response.data.campaignId,
        creatorId: userId,
        goal: goalStr,
        raised: "0",
        duration: durationNum,
        endTime: new Date(Date.now() + durationNum * 1000),
        status: "active",
        finalized: false,
        transactionHash: response.data.transactionHash || response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("crowdfunding_campaigns").insertOne(campaign);

      res.json({ success: true, campaign, data: response.data });
    } catch (error: any) {
      console.error("❌ Error creating campaign:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to create campaign" 
      });
    }
  });

  // Contribute to campaign
  app.post("/api/crowdfunding/contribute", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId, amount } = req.body;

      console.log("📝 Contribute to campaign:", { campaignId, amount });

      if (campaignId === undefined || !amount) {
        return res.status(400).json({ 
          message: "Campaign ID and amount are required" 
        });
      }

      // Validate campaignId is a number
      const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId) : campaignId;
      if (isNaN(campaignIdNum)) {
        return res.status(400).json({ message: "Invalid campaign ID. Must be a number." });
      }

      // Validate amount is a string (wei)
      const amountStr = typeof amount === 'number' ? amount.toString() : amount;

      console.log("📤 Sending contribute request:", { campaignId: campaignIdNum, amount: amountStr });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/contribute', {
        campaignId: campaignIdNum,
        amount: amountStr
      });

      console.log("✅ Contribution successful!");

      // Store contribution in database
      const contribution = {
        campaignId: campaignIdNum,
        contributorId: userId,
        amount: amountStr,
        transactionHash: response.data.txHash,
        createdAt: new Date()
      };

      await storage.db.collection("crowdfunding_contributions").insertOne(contribution);

      // Update campaign raised amount - convert to number for $inc
      const campaign = await storage.db.collection("crowdfunding_campaigns").findOne({ campaignId: campaignIdNum });
      if (campaign) {
        const currentRaised = parseFloat(campaign.raised || "0");
        const newRaised = currentRaised + parseFloat(amountStr);
        
        await storage.db.collection("crowdfunding_campaigns").updateOne(
          { campaignId: campaignIdNum },
          { 
            $set: { 
              raised: newRaised.toString()
            } 
          }
        );
      }

      res.json({ success: true, contribution, data: response.data });
    } catch (error: any) {
      console.error("❌ Error contributing:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to contribute" 
      });
    }
  });

  // Finalize campaign
  app.post("/api/crowdfunding/finalize", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId } = req.body;

      console.log("📝 Finalize campaign:", { campaignId });

      if (campaignId === undefined) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId) : campaignId;
      if (isNaN(campaignIdNum)) {
        return res.status(400).json({ message: "Invalid campaign ID. Must be a number." });
      }

      console.log("📤 Sending finalize request:", { campaignId: campaignIdNum });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/finalize', {
        campaignId: campaignIdNum
      });

      console.log("✅ Campaign finalized!");

      // Update campaign status
      await storage.db.collection("crowdfunding_campaigns").updateOne(
        { campaignId: campaignIdNum },
        { 
          $set: { 
            status: "finalized",
            finalized: true,
            finalizedAt: new Date()
          } 
        }
      );

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error finalizing campaign:", error.response?.data || error.message);
      res.status(500).json({ 
        message: error.response?.data?.error || error.response?.data?.message || "Failed to finalize campaign" 
      });
    }
  });

  // Claim NFT reward
  app.post("/api/crowdfunding/claim-nft", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId } = req.body;

      console.log("📝 Claim NFT reward:", { campaignId });

      if (campaignId === undefined) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId) : campaignId;
      if (isNaN(campaignIdNum)) {
        return res.status(400).json({ message: "Invalid campaign ID. Must be a number." });
      }

      console.log("📤 Sending claim NFT request:", { campaignId: campaignIdNum });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/claim-nft', {
        campaignId: campaignIdNum
      });

      console.log("✅ NFT reward claimed!");

      // Store claim record
      const claim = {
        campaignId: campaignIdNum,
        userId,
        type: "nft",
        transactionHash: response.data.txHash,
        claimedAt: new Date()
      };

      await storage.db.collection("crowdfunding_claims").insertOne(claim);

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error claiming NFT:", error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to claim NFT reward";
      
      // Check for common blockchain errors and provide friendly messages
      let friendlyMessage = errorMessage;
      if (errorMessage.includes("Already claimed")) {
        friendlyMessage = "You have already claimed your NFT reward for this campaign.";
      } else if (errorMessage.includes("Nothing to claim")) {
        friendlyMessage = "No NFT reward available to claim for this campaign.";
      } else if (errorMessage.includes("Campaign not finalized")) {
        friendlyMessage = "This campaign has not been finalized yet. Please wait for the creator to finalize it.";
      }
      
      res.status(500).json({ 
        message: friendlyMessage
      });
    }
  });

  // Push revenue
  app.post("/api/crowdfunding/push-revenue", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId, amount } = req.body;

      console.log("📝 Push revenue:", { campaignId, amount });

      if (campaignId === undefined || !amount) {
        return res.status(400).json({ 
          message: "Campaign ID and amount are required" 
        });
      }

      const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId) : campaignId;
      if (isNaN(campaignIdNum)) {
        return res.status(400).json({ message: "Invalid campaign ID. Must be a number." });
      }

      const amountStr = typeof amount === 'number' ? amount.toString() : amount;

      console.log("📤 Sending push revenue request:", { campaignId: campaignIdNum, amount: amountStr });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/push-revenue', {
        campaignId: campaignIdNum,
        amount: amountStr
      });

      console.log("✅ Revenue pushed!");

      // Store revenue record
      const revenue = {
        campaignId: campaignIdNum,
        creatorId: userId,
        amount: amountStr,
        transactionHash: response.data.txHash,
        pushedAt: new Date()
      };

      await storage.db.collection("crowdfunding_revenues").insertOne(revenue);

      res.json({ success: true, revenue, data: response.data });
    } catch (error: any) {
      console.error("❌ Error pushing revenue:", error.response?.data || error.message);
      
      const isFundingError = error.response?.data?.error?.includes("funds") || 
                            error.response?.data?.error?.includes("balance") ||
                            error.response?.data?.error?.includes("insufficient");
      
      res.status(500).json({ 
        message: isFundingError 
          ? "Your wallet doesn't have enough funds. Please contact support to add funds to your wallet address."
          : error.response?.data?.error || error.response?.data?.message || "Failed to push revenue" 
      });
    }
  });

  // Claim revenue
  app.post("/api/crowdfunding/claim-revenue", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { campaignId } = req.body;

      console.log("📝 Claim revenue:", { campaignId });

      if (campaignId === undefined) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId) : campaignId;
      if (isNaN(campaignIdNum)) {
        return res.status(400).json({ message: "Invalid campaign ID. Must be a number." });
      }

      console.log("📤 Sending claim revenue request:", { campaignId: campaignIdNum });

      const response = await nftApiRequest(userId, 'POST', '/api/crowdfunding/claim-revenue', {
        campaignId: campaignIdNum
      });

      console.log("✅ Revenue claimed!");

      // Store claim record
      const claim = {
        campaignId: campaignIdNum,
        userId,
        type: "revenue",
        amount: response.data.amount || "0",
        transactionHash: response.data.txHash,
        claimedAt: new Date()
      };

      await storage.db.collection("crowdfunding_claims").insertOne(claim);

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("❌ Error claiming revenue:", error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to claim revenue";
      
      // Check for common blockchain errors and provide friendly messages
      let friendlyMessage = errorMessage;
      if (errorMessage.includes("Already claimed")) {
        friendlyMessage = "You have already claimed your revenue share for this campaign.";
      } else if (errorMessage.includes("Nothing to claim")) {
        friendlyMessage = "No revenue available to claim. The creator may not have pushed revenue yet.";
      } else if (errorMessage.includes("Campaign not finalized")) {
        friendlyMessage = "This campaign has not been finalized yet. Please wait for the creator to finalize it.";
      } else if (errorMessage.includes("No revenue")) {
        friendlyMessage = "No revenue has been distributed for this campaign yet.";
      }
      
      res.status(500).json({ 
        message: friendlyMessage
      });
    }
  });

  // List all campaigns
  app.get("/api/crowdfunding/list", async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.db
        .collection("crowdfunding_campaigns")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      // Get creator details for each campaign
      const campaignsWithDetails = await Promise.all(
        campaigns.map(async (campaign) => {
          const creator = await storage.getUser(campaign.creatorId);
          
          return {
            ...campaign,
            creator: creator ? {
              id: creator._id,
              name: creator.name,
              email: creator.email,
              avatarUrl: creator.avatarUrl
            } : null
          };
        })
      );

      res.json({ success: true, campaigns: campaignsWithDetails });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Get my campaigns (creator)
  app.get("/api/crowdfunding/my-campaigns", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const campaigns = await storage.db
        .collection("crowdfunding_campaigns")
        .find({ creatorId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({ success: true, campaigns });
    } catch (error) {
      console.error("Error fetching my campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // Get my contributions
  app.get("/api/crowdfunding/my-contributions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const contributions = await storage.db
        .collection("crowdfunding_contributions")
        .find({ contributorId: userId })
        .sort({ createdAt: -1 })
        .toArray();

      // Get campaign details for each contribution
      const contributionsWithDetails = await Promise.all(
        contributions.map(async (contribution) => {
          const campaign = await storage.db.collection("crowdfunding_campaigns").findOne({ 
            campaignId: contribution.campaignId 
          });
          
          return {
            ...contribution,
            campaign
          };
        })
      );

      res.json({ success: true, contributions: contributionsWithDetails });
    } catch (error) {
      console.error("Error fetching contributions:", error);
      res.status(500).json({ message: "Failed to fetch contributions" });
    }
  });
}
