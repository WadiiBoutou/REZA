import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { employeeService } from './employee.service';
import { createEmployeeSchema, updateEmployeeSchema } from './employee.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';
import { uploadImage } from '../../utils/cloudinary';

export class EmployeeController {
  async getEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const { active, search } = req.query;
      const employees = await employeeService.getEmployees(
        req.salonIds || [req.tenantId!],
        active as string,
        search as string
      );
      res.json({ employees });
    } catch (error) {
      next(error);
    }
  }

  async getEmployeeById(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await employeeService.getEmployeeById(req.tenantId!, req.params.id);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      res.json({ employee });
    } catch (error) {
      next(error);
    }
  }

  async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createEmployeeSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as { tenantId?: string }).tenantId);
      const employee = await employeeService.createEmployee(tenantId, data);
      res.status(201).json({ employee });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      next(error);
    }
  }

  async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateEmployeeSchema.parse(req.body);
      const employee = await employeeService.updateEmployee(req.tenantId!, req.params.id, data);
      res.json({ employee });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'EMPLOYEE_NOT_FOUND') {
        return res.status(404).json({ error: 'Employee not found' });
      }
      next(error);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Veuillez sélectionner une image'
        });
      }

      const avatar = await uploadImage(req.file, 'avatars');
      res.json({ avatar });
    } catch (error) {
      next(error);
    }
  }

  async deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      await employeeService.deleteEmployee(req.tenantId!, req.params.id);
      res.json({ message: 'Employee deleted successfully' });
    } catch (error: any) {
      if (error.message === 'EMPLOYEE_NOT_FOUND') {
        return res.status(404).json({ error: 'Employee not found' });
      }
      if (error.message.startsWith('HAS_FUTURE_APPOINTMENTS')) {
        const count = error.message.split(':')[1];
        return res.status(409).json({
          error: 'Cannot delete employee',
          message: `This employee has ${count} future appointment(s). Please reassign or cancel them first.`
        });
      }
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
