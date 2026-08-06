import { Request, Response, NextFunction } from 'express';
import { statsService } from './stats.service';

export class StatsController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const result = await statsService.getOverview(req.tenantId!, startDate as string, endDate as string);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const result = await statsService.getAppointmentStats(req.tenantId!, startDate as string, endDate as string);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRevenueStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query;
      const result = await statsService.getRevenueStats(req.tenantId!, startDate as string, endDate as string);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getDashboardStats(
        req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAutresStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getAutresStats(
        req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPrestationsStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getPrestationsStats(
        req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getCollaborateursStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year, categoryId, serviceId } = req.query;
      const result = await statsService.getCollaborateursStats(
        req.salonIds && req.salonIds.length > 0 ? req.salonIds : req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string,
        categoryId as string,
        serviceId as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getDailyRdvStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getDailyRdvStats(
        req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOccupancyOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const { month, year, employeeId } = req.query;
      const result = await statsService.getOccupancyOverview(
        req.tenantId!,
        month as string,
        year as string,
        employeeId as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOccupancyCollaborateurs(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year, categoryId, serviceId } = req.query;
      const result = await statsService.getOccupancyCollaborateurs(
        req.salonIds && req.salonIds.length > 0 ? req.salonIds : req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string,
        categoryId as string,
        serviceId as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOccupancyPrestations(req: Request, res: Response, next: NextFunction) {
    try {
      const { month, year, employeeId } = req.query;
      const result = await statsService.getOccupancyPrestations(
        req.tenantId!,
        month as string,
        year as string,
        employeeId as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTopClients(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getTopClients(
        req.salonIds && req.salonIds.length > 0 ? req.salonIds : req.tenantId!,
        limit ? parseInt(limit as string, 10) : 100,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getNewClientsStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getNewClientsStats(
        req.salonIds && req.salonIds.length > 0 ? req.salonIds : req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getClientFrequencyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, startDate, endDate, month, year } = req.query;
      const result = await statsService.getClientFrequencyStats(
        req.salonIds && req.salonIds.length > 0 ? req.salonIds : req.tenantId!,
        period as string,
        startDate as string,
        endDate as string,
        month as string,
        year as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const statsController = new StatsController();
