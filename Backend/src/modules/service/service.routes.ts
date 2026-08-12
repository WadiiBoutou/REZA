import express from 'express';
import { serviceController } from './service.controller';

const router = express.Router();

router.get('/', serviceController.getServices);
// Literal route must be registered BEFORE '/:id' so it isn't shadowed.
router.put('/categories', serviceController.setCategories);
router.get('/:id', serviceController.getServiceById);
router.post('/', serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

export default router;
