import { uploadImage } from './cloudinary';

/**
 * Convert a base64 `data:` avatar into a stored, uploadable URL before saving.
 * - Always uploads to Cloudinary (see utils/cloudinary.ts — no local storage).
 *
 * Absolute URLs pass through unchanged.
 *
 * Why: web clients used to send the raw base64 image as the `avatar` field,
 * which bloated the DB with multi-MB strings and produced `data:` URLs that
 * only render reliably in the same browser that created them. Normalizing at
 * write time routes every avatar through the same upload flow the mobile app
 * uses, so stored avatars are real URLs that work on every surface.
 */
export async function normalizeAvatarValue(
  avatar?: string | null
): Promise<string | null | undefined> {
  if (!avatar || typeof avatar !== 'string') return avatar;
  if (!avatar.startsWith('data:')) return avatar;

  const comma = avatar.indexOf(',');
  if (comma === -1) return avatar;

  const meta = avatar.slice(5, comma); // e.g. "image/png;base64"
  const mime = meta.split(';')[0] || 'image/png';
  const ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const b64 = avatar.slice(comma + 1);
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0) return null;

  return uploadImage(
    { buffer, mimetype: mime, originalname: `avatar.${ext}` },
    'avatars'
  );
}
