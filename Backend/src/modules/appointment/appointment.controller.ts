import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { appointmentService } from './appointment.service';
import { schedulingService } from './scheduling.service';
import { createAppointmentSchema, updateAppointmentSchema, planAppointmentSchema, clientDiagnosticsSchema, validateMoveSchema } from './appointment.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';

export class AppointmentController {
  async getAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, cancelledStartDate, cancelledEndDate, clientId, employeeId, serviceId, status, page = '1', limit = '50' } = req.query;
      
      const filters = {
        startDate: startDate as string,
        endDate: endDate as string,
        cancelledStartDate: cancelledStartDate as string,
        cancelledEndDate: cancelledEndDate as string,
        clientId: clientId as string,
        employeeId: employeeId as string,
        serviceId: serviceId as string,
        status: status as string
      };

      const result = await appointmentService.getAppointments(
        req.salonIds || [req.tenantId!],
        filters, 
        parseInt(page as string), 
        parseInt(limit as string)
      );

      res.json({
        appointments: result.appointments,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const appointment = await appointmentService.getAppointmentById(
        req.salonIds || [req.tenantId!],
        req.params.id
      );
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      res.json({ appointment });
    } catch (error) {
      next(error);
    }
  }

  async planAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = planAppointmentSchema.parse(req.body);
      const tenantId = data.tenantId || (req.salonIds || [req.tenantId!])[0];
      const plan = await schedulingService.planReservation({
        tenantId,
        serviceIds: data.serviceIds,
        date: data.date,
        startTime: data.startTime,
        clientId: data.clientId,
        assignments: data.assignments as { serviceId: string; employeeId: string | null }[] | undefined,
      });
      res.json(plan);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      next(error);
    }
  }

  async clientDiagnostics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = clientDiagnosticsSchema.parse(req.body);
      const tenantId = data.tenantId || (req.salonIds || [req.tenantId!])[0];
      const result = await schedulingService.clientDiagnostics({
        tenantId,
        date: data.date,
        startTime: data.startTime,
        estimatedDuration: data.estimatedDuration,
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      next(error);
    }
  }

  async createAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAppointmentSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as any).tenantId);

      const appointment = await appointmentService.createAppointment(tenantId, req.userId!, data, false);
      res.status(201).json({ appointment });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'CLIENT_NOT_FOUND') return res.status(404).json({ error: 'Client not found' });
      if (error.message === 'SERVICE_NOT_FOUND') return res.status(404).json({ error: 'Service not found' });
      if (error.message === 'EMPLOYEE_NOT_FOUND') return res.status(404).json({ error: 'Employee not found' });
      if (error.message === 'INVALID_EMPLOYEE') return res.status(404).json({ error: 'Invalid employee', message: 'The selected professional could not be assigned.' });
      if (error.message === 'VALIDATION_ERROR') {
        return res.status(error.details.status || 400).json({
          error: error.details.error,
          message: error.details.message
        });
      }
      next(error);
    }
  }

  async updateAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateAppointmentSchema.parse(req.body);
      const appointment = await appointmentService.updateAppointment(
        req.salonIds || [req.tenantId!],
        req.params.id,
        data,
        req.userId
      );
      res.json({ appointment });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'APPOINTMENT_NOT_FOUND') return res.status(404).json({ error: 'Appointment not found' });
      if (error.message === 'VALIDATION_ERROR') {
        return res.status(error.details.status || 400).json({
          error: error.details.error,
          message: error.details.message
        });
      }
      next(error);
    }
  }

  async validateMove(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validateMoveSchema.parse(req.body);
      const result = await appointmentService.validateMove(
        req.salonIds || [req.tenantId!],
        req.params.id,
        data
      );
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'APPOINTMENT_NOT_FOUND') return res.status(404).json({ error: 'Appointment not found' });
      if (error.message === 'INVALID_MOVE_DATA') return res.status(400).json({ error: 'Invalid move data', message: 'Le nouveau créneau est invalide.' });
      next(error);
    }
  }

  async deleteAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      await appointmentService.deleteAppointment(
        req.salonIds || [req.tenantId!],
        req.params.id,
        req.userId!
      );
      res.json({ message: 'Appointment cancelled successfully' });
    } catch (error: any) {
      if (error.message === 'APPOINTMENT_NOT_FOUND') return res.status(404).json({ error: 'Appointment not found' });
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
