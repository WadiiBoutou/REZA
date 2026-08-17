import express from 'express';
import { appointmentController } from './appointment.controller';

const router = express.Router();

router.get('/availability-days', appointmentController.getDayAvailability);
router.post('/plan', appointmentController.planAppointment);
router.post('/client-diagnostics', appointmentController.clientDiagnostics);
router.post('/:id/validate-move', appointmentController.validateMove);
router.get('/', appointmentController.getAppointments);
router.get('/:id', appointmentController.getAppointmentById);
router.post('/', appointmentController.createAppointment);
router.put('/:id', appointmentController.updateAppointment);
router.delete('/:id', appointmentController.deleteAppointment);

export default router;
