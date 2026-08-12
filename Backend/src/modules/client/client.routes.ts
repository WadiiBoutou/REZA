import express from 'express';
import multer from 'multer';
import { clientController } from './client.controller';

const router = express.Router();

// Avatars are uploaded to Cloudinary (secure URL stored in DB). Multer only
// buffers the file in memory — nothing is written to local disk.
const avatarStorage = multer.memoryStorage();

const avatarFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Seules les images sont autorisées'));
  }
};

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /api/clients/upload-avatar
 * Upload a client avatar image (Cloudinary). Returns the URL to store in
 * client.avatar when creating/updating the client.
 */
router.post('/upload-avatar', (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === 'LIMIT_FILE_SIZE' ? 'L\'image est trop volumineuse (max 5 Mo)' : err.message)
        : (err.message || 'Erreur lors de l\'upload de l\'image');
      return res.status(400).json({ error: 'Upload error', message });
    }
    next();
  });
}, clientController.uploadAvatar);

router.get('/', clientController.getClients);
router.get('/duplicates', clientController.detectDuplicates);
router.post('/merge', clientController.mergeClients);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

export default router;
