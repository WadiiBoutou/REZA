/**
 * Cloudinary image upload helper.
 *
 * Production (Render): images are uploaded to Cloudinary and the returned
 * secure URL is stored in the DB — never the local filesystem, which is
 * ephemeral on Render and would be wiped on every redeploy/restart.
 *
 * Configuration (env vars, required in production):
 *   CLOUDINARY_CLOUD_NAME  → the cloud name ALONE, e.g. dqceikk6h
 *                            (NOT the full cloudinary://... URL)
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Values are trimmed to guard against a stray trailing newline/space (common
 * when pasting into the Render dashboard or a .env file), which makes
 * Cloudinary return an HTML 404 page instead of a JSON error.
 *
 * Dev fallback: when Cloudinary is not configured, the buffer is written to
 * the local public/uploads folder (existing behaviour) so local development
 * keeps working without credentials. In production, a missing configuration
 * is treated as an error rather than silently falling back to ephemeral disk.
 */
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

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
      // Never print env values here: the raw CLOUDINARY_CLOUD_NAME may contain
      // the API key and secret if a full cloudinary:// URL was pasted in.
      const status = uploadError?.http_code;
      const message = uploadError?.message || '';
      // 404 / HTML page → the cloud name is wrong or the upload URL is malformed.
      if (status === 404 || /invalid JSON response|Page not found|DOCTYPE/i.test(message)) {
        throw new Error(
          `L'upload d'image a échoué : Cloudinary a répondu 404. ` +
          `Vérifiez que CLOUDINARY_CLOUD_NAME sur Render contient le nom de cloud SEUL ` +
          `(ex. dqceikk6h), sans le préfixe "cloudinary://…" et sans clés.`
        );
      }
      // 401 / 403 → Cloudinary received the request but rejected the credentials.
      if (status === 401 || status === 403) {
        throw new Error(
          `L'upload d'image a échoué : Cloudinary a refusé l'authentification (${status}). ` +
          `Les identifiants CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET sur Render ne ` +
          `correspondent pas au compte du cloud « ${CLOUDINARY_ENV.cloud_name || '(vide)'} ». ` +
          `Vérifiez/régénérez les clés dans Cloudinary → Settings → API Keys et mettez-les à jour sur Render.`
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
  // The static server (server.ts) serves from <BackendRoot>/public/uploads:
  //   dev  → path.resolve(__dirname, '..', 'public', 'uploads')  (src → Backend)
  //   prod → path.resolve(__dirname, '..', 'public', 'uploads')  (dist → Backend)
  // We must write to THAT SAME folder — a naive 3 × '..' from src/utils lands
  // on the repo root (REZA/public/uploads), which the server never serves (404).
  const isDist = __dirname.includes(`${path.sep}dist${path.sep}`);
  // dev:  src/utils      → 2 × '..' → Backend
  // prod: dist/src/utils → 3 × '..' → Backend
  const projectRoot = isDist
    ? path.resolve(__dirname, '..', '..', '..')
    : path.resolve(__dirname, '..', '..');
  const uploadsDir = path.join(projectRoot, 'public', 'uploads');
  const targetDir = path.join(uploadsDir, folder);
  fs.mkdirSync(targetDir, { recursive: true });
  const ext = (path.extname(originalname) || `.${mimetype.split('/')[1] || 'jpg'}`).toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(targetDir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}
