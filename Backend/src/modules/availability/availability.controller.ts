import { Request, Response, NextFunction } from 'express';
import { availabilityService } from './availability.service';
import * as log from '../../utils/logger';

export class AvailabilityController {
  async stream(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, date, serviceIds, employeeId } = req.query;

      if (!tenantId || !date) {
        return res.status(400).json({
          error: 'Missing required parameters',
          message: 'tenantId and date are required'
        });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const serviceIdsArray = Array.isArray(serviceIds)
        ? serviceIds as string[]
        : serviceIds
          ? (serviceIds as string).split(',')
          : [];

      const calculateSlots = async () => {
        try {
          return await availabilityService.getAvailability(
            tenantId as string,
            date as string,
            serviceIdsArray,
            employeeId as string
          );
        } catch (error: any) {
          if (error.message === 'TENANT_NOT_FOUND') {
            return null;
          }
          throw error;
        }
      };

      const initialSlots = await calculateSlots();
      if (initialSlots === null) {
        res.write(`data: ${JSON.stringify({ error: 'Tenant not found' })}\n\n`);
        res.end();
        return;
      }
      
      res.write(`data: ${JSON.stringify({ slots: initialSlots, timestamp: new Date().toISOString() })}\n\n`);

      const pollInterval = setInterval(async () => {
        try {
          const slots = await calculateSlots();
          if (slots !== null) {
            res.write(`data: ${JSON.stringify({ slots, timestamp: new Date().toISOString() })}\n\n`);
          }
        } catch (error) {
          log.error('[SSE] Error calculating slots:', error);
          res.write(`data: ${JSON.stringify({ error: 'Failed to calculate slots' })}\n\n`);
        }
      }, 30000);

      req.on('close', () => {
        clearInterval(pollInterval);
        res.end();
      });

      const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
      });

    } catch (error) {
      log.error('[SSE] Error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.end();
    }
  }
}

export const availabilityController = new AvailabilityController();
