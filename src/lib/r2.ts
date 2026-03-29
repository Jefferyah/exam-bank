import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "exam-bank";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Allowed image types
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// Allowed file types (non-image)
export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_PER_TAG = 20;

export function validateImage(
  size: number,
  mimeType: string
): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return `不支援的圖片類型：${mimeType}`;
  }
  if (size > MAX_IMAGE_SIZE) {
    return `圖片大小超過 5MB 限制`;
  }
  return null;
}

export function validateFile(
  size: number,
  mimeType: string
): string | null {
  if (!ALLOWED_FILE_TYPES.includes(mimeType)) {
    return `不支援的檔案類型：${mimeType}`;
  }
  if (size > MAX_FILE_SIZE) {
    return `檔案大小超過 20MB 限制`;
  }
  return null;
}

export function isImageMimeType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export async function getFromR2(
  key: string
): Promise<{ body: Uint8Array; contentType: string }> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
  // AWS SDK v3 Body is a SdkStreamMixin — convert to Uint8Array for NextResponse
  const bytes = await response.Body!.transformToByteArray();
  return {
    body: bytes,
    contentType: response.ContentType || "application/octet-stream",
  };
}
