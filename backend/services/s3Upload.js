// backend/services/s3Upload.js
// Upload images to AWS S3 and return CloudFront CDN URL

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { randomUUID } from "crypto";
import path from "path";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;
const CDN_URL = process.env.CLOUDFRONT_URL || `https://${BUCKET}.s3.amazonaws.com`;

/**
 * Upload a product image buffer to S3
 * Automatically compresses to WebP for max performance
 * @param {Buffer} buffer - Raw image buffer
 * @param {string} filename - Optional filename hint
 * @param {string} folder - S3 folder (default: "products")
 * @returns {Promise<{url: string, key: string}>}
 */
export async function uploadProductImage(buffer, filename = null, folder = "products") {
  // Compress + convert to WebP
  const optimized = await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const key = `${folder}/${Date.now()}-${randomUUID()}.webp`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: optimized,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
    // No ACL needed if using CloudFront OAC
  }));

  const url = `${CDN_URL}/${key}`;
  return { url, key };
}

/**
 * Upload a banner image
 */
export async function uploadBannerImage(buffer, filename = null) {
  const optimized = await sharp(buffer)
    .resize(1920, 700, { fit: "cover" })
    .webp({ quality: 90 })
    .toBuffer();

  const key = `banners/${Date.now()}-${randomUUID()}.webp`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: optimized,
    ContentType: "image/webp",
    CacheControl: "public, max-age=86400",
  }));

  return { url: `${CDN_URL}/${key}`, key };
}

/**
 * Delete an image from S3
 * @param {string} key - S3 object key
 */
export async function deleteImage(key) {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    console.error("[S3] Delete error:", err.message);
    return false;
  }
}

/**
 * Extract S3 key from a CloudFront or S3 URL
 */
export function urlToKey(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}
