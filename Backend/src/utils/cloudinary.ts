/**
 * Cloudinary image upload helper.
 *
 * Production (Render): images are uploaded to Cloudinary and the returned
 * secure URL is stored in the DB — never the local filesystem, which is
 * ephemeral on Render and would be wiped on every redeploy/restart.
 *
 * Configuration (env vars, required in production) — two equivalent ways:
 *   1. CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *      (the value Cloudinary's dashboard shows) — recommended, single var.
 *   2. CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET
 *      (individual values, cloud name only — NOT the full URL).
 *
 * For robustness we also accept the full cloudinary:// URL in
 * CLOUDINARY_CLOUD_NAME itself (a common paste mistake) and parse it.
 * All values are trimmed: a stray trailing newline or space (common when
 * pasting into the Render dashboard or a .env file) makes Cloudinary return
 * an HTML 404 page instead of a JSON error, which the SDK then wraps in a
 * cryptic "Server return invalid JSON response" message.
 *
 * Dev fallback: when Cloudinary is not configured, the buffer is written to
 * the local public/uploads folder (existing behaviour) so local development
 * keeps working without credentials. In production, a missing configuration
 * is treated as an error rather than silently falling back to ephemeral disk.
 */
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

/**
 * Parse a Cloudinary connection URL of the form
 * `cloudinary://<api_key>:<api_secret>@<cloud_name>` (the value shown on the
 * Cloudinary dashboard). Returns {} when the string isn't in that format.
 */
function parseCloudinaryUrl(raw: string): {
  cloud_name?: string;
  api_key?: string;
  api_secret?: string;
} {
  const match = raw.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/]+)$/);
  if (!match) return {};
  return { api_key: match[1], api_secret: match[2], cloud_name: match[3] };
}

const urlFromEnv = parseCloudinaryUrl(process.env.CLOUDINARY_URL || '');
const urlFromCloudNameVar = parseCloudinaryUrl(process.env.CLOUDINARY_CLOUD_NAME || '');

const CLOUDINARY_ENV = {
  cloud_name:
    urlFromEnv.cloud_name ||
    urlFromCloudNameVar.cloud_name ||
    (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
  api_key:
    urlFromEnv.api_key ||
    urlFromCloudNameVar.api_key ||
    (process.env.CLOUDINARY_API_KEY || '').trim(),
  api_secret:
    urlFromEnv.api_secret ||
    urlFromCloudNameVar.api_secret ||
    (process.env.CLOUDINARY_API_SECRET || '').trim(),
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
      // Never print raw env values here: CLOUDINARY_URL / a full URL pasted
      // into CLOUDINARY_CLOUD_NAME contains the API key and secret.
      const status = uploadError?.http_code;
      if (status === 404 || /invalid JSON response|Page not found|DOCTYPE/i.test(uploadError?.message || '')) {
        throw new Error(
          `L'upload d'image a échoué : Cloudinary a répondu ${status || '404'}. ` +
          `Vérifiez votre configuration Cloudinary (cloud résolu : ${CLOUDINARY_ENV.cloud_name || '(vide)'}). ` +
          `Utilisez soit CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name> ` +
          `(la valeur affichée sur votre tableau de bord Cloudinary), ` +
          `soit CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET avec le nom de cloud seul.`
        );
      }
      throw uploadError;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Cloudinary is not configured (CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET manquants) — refusing to store uploads on ephemeral local disk in production.'
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
