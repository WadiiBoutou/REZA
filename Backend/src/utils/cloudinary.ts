/**
 * Cloudinary image upload helper.
 *
 * ALL image uploads go through Cloudinary — the returned secure URL is stored
 * in the DB, never the local filesystem (ephemeral on Render, and unavailable
 * to other environments). There is no local-disk fallback: if Cloudinary is
 * not configured, uploads fail loudly instead of silently writing to disk.
 *
 * Configuration (env vars):
 *   CLOUDINARY_CLOUD_NAME  → the cloud name ALONE, e.g. dqceikk6h
 *                            (NOT the full cloudinary://... URL)
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Values are trimmed to guard against a stray trailing newline/space (common
 * when pasting into the Render dashboard or a .env file), which makes
 * Cloudinary return an HTML 404 page instead of a JSON error.
 */
import { v2 as cloudinary } from 'cloudinary';

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
 * Upload an image buffer to Cloudinary and return its secure public URL.
 * Throws when Cloudinary is not configured — uploads never touch local disk.
 */
export async function uploadImage(input: UploadImageInput, folder: string): Promise<string> {
  if (!cloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing) — ' +
      'refusing to store uploads on local disk. Set the Cloudinary env vars.'
    );
  }

  const { buffer, mimetype = 'image/jpeg' } = input;
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
    // Never print env values here: the raw CLOUDINARY_CLOUD_NAME may contain
    // the API key and secret if a full cloudinary:// URL was pasted in.
    const status = uploadError?.http_code;
    const message = uploadError?.message || '';
    // 404 / HTML page → the cloud name is wrong or the upload URL is malformed.
    if (status === 404 || /invalid JSON response|Page not found|DOCTYPE/i.test(message)) {
      throw new Error(
        `L'upload d'image a échoué : Cloudinary a répondu 404. ` +
        `Vérifiez que CLOUDINARY_CLOUD_NAME contient le nom de cloud SEUL ` +
        `(ex. dqceikk6h), sans le préfixe "cloudinary://…" et sans clés.`
      );
    }
    // 401 / 403 → Cloudinary received the request but rejected the credentials.
    if (status === 401 || status === 403) {
      throw new Error(
        `L'upload d'image a échoué : Cloudinary a refusé l'authentification (${status}). ` +
        `Les identifiants CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ne ` +
        `correspondent pas au compte du cloud « ${CLOUDINARY_ENV.cloud_name || '(vide)'} ». ` +
        `Vérifiez/régénérez les clés dans Cloudinary → Settings → API Keys.`
      );
    }
    throw uploadError;
  }
}
