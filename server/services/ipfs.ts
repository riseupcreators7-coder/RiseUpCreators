import axios from "axios";
import FormData from "form-data";

const PINATA_API_KEY = process.env.IPFS_API_KEY;
const PINATA_SECRET_KEY = process.env.IPFS_API_SECRET;

/**
 * Upload file to IPFS via Pinata
 */
export async function uploadFileToIPFS(fileBuffer: Buffer, fileName: string): Promise<string> {
  try {
    // Check if Pinata credentials are configured
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn("⚠️  Pinata credentials not configured, using mock hash");
      // Generate a mock IPFS hash for development
      const mockHash = `Qm${Buffer.from(fileName + Date.now()).toString('base64').substring(0, 44)}`;
      return mockHash;
    }

    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: fileName,
      contentType: "application/octet-stream"
    });

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    console.log("✅ File uploaded to IPFS:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error: any) {
    console.error("❌ Error uploading to IPFS:", error.response?.data || error.message);
    
    // If it's a scope error, provide helpful message
    if (error.response?.data?.error?.reason === 'NO_SCOPES_FOUND') {
      throw new Error("Pinata API key doesn't have required permissions. Please create a new key with 'pinFileToIPFS' and 'pinJSONToIPFS' scopes at https://app.pinata.cloud/developers/api-keys");
    }
    
    throw new Error(error.response?.data?.error?.details || error.response?.data?.error?.reason || "Failed to upload file to IPFS");
  }
}

/**
 * Upload JSON metadata to IPFS via Pinata
 */
export async function uploadMetadataToIPFS(metadata: any): Promise<string> {
  try {
    // Check if Pinata credentials are configured
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn("⚠️  Pinata credentials not configured, using mock hash");
      // Generate a mock IPFS hash for development
      const mockHash = `Qm${Buffer.from(JSON.stringify(metadata) + Date.now()).toString('base64').substring(0, 44)}`;
      return mockHash;
    }

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      {
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    console.log("✅ Metadata uploaded to IPFS:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error: any) {
    console.error("❌ Error uploading metadata to IPFS:", error.response?.data || error.message);
    
    // If it's a scope error, provide helpful message
    if (error.response?.data?.error?.reason === 'NO_SCOPES_FOUND') {
      throw new Error("Pinata API key doesn't have required permissions. Please create a new key with 'pinFileToIPFS' and 'pinJSONToIPFS' scopes at https://app.pinata.cloud/developers/api-keys");
    }
    
    throw new Error(error.response?.data?.error?.details || error.response?.data?.error?.reason || "Failed to upload metadata to IPFS");
  }
}

/**
 * Create NFT metadata and upload to IPFS
 */
export async function createNFTMetadata(params: {
  name: string;
  description: string;
  imageHash: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}): Promise<{ metadataHash: string; metadataURI: string }> {
  const metadata = {
    name: params.name,
    description: params.description,
    image: `ipfs://${params.imageHash}`,
    attributes: params.attributes || [],
  };

  const metadataHash = await uploadMetadataToIPFS(metadata);
  const metadataURI = `ipfs://${metadataHash}`;

  return { metadataHash, metadataURI };
}

/**
 * Get IPFS gateway URL
 */
export function getIPFSGatewayURL(hash: string): string {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}
