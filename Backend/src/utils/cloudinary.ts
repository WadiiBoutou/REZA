/**
 * Cloudinary image upload helper.
 *
 * Production (Render): images are uploaded to Cloudinary and the returned
 * secure URL is stored in the DB — never the local filesystem, which is
 * ephemeral on Render and would be wiped on every redeploy/restart.
 *
 * Configuration (env vars, required in production):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Dev fallback: when Cloudinary is not configured, the buffer is written to
 * the local public/uploads folder (existing behaviour) so local development
 * keeps working without credentials. In production, a missing configuration
 * is treated as an error rather than silently falling back to ephemeral disk.
 */
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Trim every Cloudinary env value: a stray trailing newline or space (common
// when pasting into the Render dashboard or a .env file) makes Cloudinary
// return an HTML 404 page instead of a JSON error, which the SDK then wraps
// in a cryptic "Server return invalid JSON response" message.
const CLOUDINARY_ENV = {
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key: (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
};

cloudinary.config(CLOUDINARY_ENV);

export function cloudinaryConfigured(): boolean {
  return Boolean(
    CLOUDINARY_ENV.cloud_name &&
    CLOUDINARY_ENV.api_key &&
    CLOUDINARY_ENV.api_secret
  );
}

export interface UploadImageInput {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

/**
 * Upload an image file and return its public URL.
 * - Cloudinary configured → upload and return the secure URL.
 * - Not configured:
 *     dev    → write to local public/uploads/<folder> (existing behaviour)
 *     prod   → throw, so ephemeral local storage is never used in production.
 */
export async function uploadImage(input: UploadImageInput, folder: string): Promise<string> {
  const { buffer, originalname = 'image', mimetype = 'image/jpeg' } = input;

  if (cloudinaryConfigured()) {
    const ext = (mimetype.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const publicId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: publicId,
        resource_type: 'image',
        format: ext === 'svg' ? undefined : ext, // svg handled as raw by default
      });
      return result.secure_url;
    } catch (uploadError: any) {
      // The Cloudinary SDK wraps non-JSON responses (e.g. an HTML 404 page when
      // the cloud name is misconfigured) in a cryptic "Server return invalid
      // JSON response" message — surface a clear, actionable error instead.
      const status = uploadError?.http_code;
      if (status === 404 || /invalid JSON response|Page not found|DOCTYPE/i.test(uploadError?.message || '')) {
        throw new Error(
          `L'upload d'image a échoué : Cloudinary a répondu ${status || '404'}. ` +
          `Vérifiez que CLOUDINARY_CLOUD_NAME (${CLOUDINARY_ENV.cloud_name || '(vide)'}) est un nom de cloud valide sur votre compte Cloudinary.`
        );
      }
      throw uploadError;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Cloudinary is not configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing) — refusing to store uploads on ephemeral local disk in production.'
    );
  }

  // Dev fallback: keep the existing local-disk behaviour.
  // __dirname is src/utils (tsx dev) or dist/src/utils (compiled); 3 × '..'
  // reaches the project root in both cases, matching the server.ts convention.
  const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'public', 'uploads');
  const targetDir = path.join(uploadsDir, folder);
  fs.mkdirSync(targetDir, { recursive: true });
  const ext = (path.extname(originalname) || `.${mimetype.split('/')[1] || 'jpg'}`).toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(targetDir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}
