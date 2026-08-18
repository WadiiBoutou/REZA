/**
 * Default salon schedule applied the moment a salon is created.
 * Employees have no individual breaks — everyone follows the salon's pause,
 * which defaults to 12:00–13:00 on open days (matches the Pro dashboard's
 * "Ajouter une pause à tous les jours ouverts" concept).
 */
export const DEFAULT_BUSINESS_HOURS = {
  onlineBooking: 'open',
  schedules: [
    { day: 'Lundi', dayShort: 'Lu', isOpen: false, openTime: '10:00', closeTime: '20:00', breaks: [] },
    { day: 'Mardi', dayShort: 'Ma', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Mercredi', dayShort: 'Me', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Jeudi', dayShort: 'Je', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Vendredi', dayShort: 'Ve', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Samedi', dayShort: 'Sa', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Dimanche', dayShort: 'Di', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
  ],
  agendaStart: '08:00',
  agendaEnd: '23:55',
  bookingDelay: { value: '1', unit: 'jours', allowLastMoment: false },
  cancellationDelay: { value: '1', unit: 'jours', allowLastMoment: false },
  advanceBooking: { value: '1', unit: 'mois' },
  blockedDates: [],
  exceptionalSchedules: [],
};
