import express from 'express';
import { statsController } from './stats.controller';

const router = express.Router();

/**
 * GET /api/stats/overview
 * Get overview statistics
 */
router.get('/overview', (req, res, next) => statsController.getOverview(req, res, next));

/**
 * GET /api/stats/appointments
 * Get appointment statistics
 */
router.get('/appointments', (req, res, next) => statsController.getAppointmentStats(req, res, next));

/**
 * GET /api/stats/revenue
 * Get revenue statistics
 */
router.get('/revenue', (req, res, next) => statsController.getRevenueStats(req, res, next));

/**
 * GET /api/stats/dashboard
 * Get comprehensive dashboard statistics
 */
router.get('/dashboard', (req, res, next) => statsController.getDashboardStats(req, res, next));

/**
 * GET /api/stats/autres
 * Get detailed statistics for autres (other indicators) page
 */
router.get('/autres', (req, res, next) => statsController.getAutresStats(req, res, next));

/**
 * GET /api/stats/prestations
 * Get service statistics for Prestations page
 */
router.get('/prestations', (req, res, next) => statsController.getPrestationsStats(req, res, next));

/**
 * GET /api/stats/collaborateurs
 * Get collaborator/employee statistics
 */
router.get('/collaborateurs', (req, res, next) => statsController.getCollaborateursStats(req, res, next));

/**
 * GET /api/stats/rdv
 * Get daily appointment statistics for RDV page
 */
router.get('/rdv', (req, res, next) => statsController.getDailyRdvStats(req, res, next));

/**

/**
 * GET /api/stats/occupation/vue-ensemble
 * Get occupancy heatmap data for overview page
 */
router.get('/occupation/vue-ensemble', (req, res, next) => statsController.getOccupancyOverview(req, res, next));

/**
 * GET /api/stats/occupation/collaborateurs
 * Get occupation rates per collaborator
 */
router.get('/occupation/collaborateurs', (req, res, next) => statsController.getOccupancyCollaborateurs(req, res, next));

/**
 * GET /api/stats/occupation/prestations
 * Get occupation rates per service
 */
router.get('/occupation/prestations', (req, res, next) => statsController.getOccupancyPrestations(req, res, next));

router.get('/clients/top', (req, res, next) => statsController.getTopClients(req, res, next));
router.get('/clients/new', (req, res, next) => statsController.getNewClientsStats(req, res, next));
router.get('/clients/frequency', (req, res, next) => statsController.getClientFrequencyStats(req, res, next));

export default router;
