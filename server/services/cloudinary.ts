
import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

// Function to configure Cloudinary - called after env vars are loaded
export const configureCloudinary = () => {
  if (isConfigured) return;
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Verify configuration
  const config = cloudinary.config();
  if (config.cloud_name && config.api_key && config.api_secret) {
    isConfigured = true;
    console.log(`Cloudinary connected to: ${config.cloud_name}`);
  } else {
    console.log(`Cloudinary configuration incomplete`);
    
  }
};

export const uploadAudio = async (buffer: Buffer, publicId: string, folder = "ruc/audio") => {
  // Ensure Cloudinary is configured
  configureCloudinary();
  
  // Check if Cloudinary is properly configured
  if (!process.env.CLOUDINARY_API_KEY) {
    throw new Error("Cloudinary not configured - missing API key");
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Upload timeout'));
    }, 60000); // 60 second timeout

    cloudinary.uploader.upload_stream(
      {
        resource_type: "video", // Use 'video' for audio files
        public_id: publicId,
        folder: folder,
        format: "mp3",
        timeout: 60000
      },
      (error, result) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

export const uploadImage = async (buffer: Buffer, publicId: string, folder = "ruc/images") => {
  // Ensure Cloudinary is configured
  configureCloudinary();
  
  // Check if Cloudinary is properly configured
  if (!process.env.CLOUDINARY_API_KEY) {
    throw new Error("Cloudinary not configured - missing API key");
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Upload timeout'));
    }, 30000); // 30 second timeout

    cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
        folder: folder,
        transformation: [
          { width: 1000, height: 1000, crop: "limit" },
          { quality: "auto" }
        ],
        timeout: 30000
      },
      (error, result) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

export const deleteFile = async (publicId: string, resourceType = "image") => {
  configureCloudinary();
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    
    throw error;
  }
};

export const generateSignedUrl = (publicId: string, options = {}) => {
  configureCloudinary();
  return cloudinary.url(publicId, {
    sign_url: true,
    ...options
  });
};

export default cloudinary;

