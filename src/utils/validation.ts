import DOMPurify from 'dompurify';
import type { Series, SeriesStatus } from '../types';
import { VALID_STATUSES } from '../config/constants';

export function sanitize(str: string): string {
  return DOMPurify.sanitize(str);
}

export function isValidStatus(s: string): s is SeriesStatus {
  return (VALID_STATUSES as readonly string[]).includes(s);
}

export function validateSeries(s: Partial<Series>): void {
  if (!s.name?.trim()) throw new Error('Le nom de la série est requis.');
  if (s.rating != null && (s.rating < 0 || s.rating > 10))
    throw new Error('La note doit être comprise entre 0 et 10.');
  if (s.status != null && !isValidStatus(s.status)) throw new Error('Statut invalide.');
}
