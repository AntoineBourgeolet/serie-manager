import { describe, it, expect } from 'vitest';
import { isValidStatus, validateSeries } from '../utils/validation';
import type { Series } from '../types';

describe('isValidStatus', () => {
  it('accepts valid statuses', () => {
    expect(isValidStatus('watchlist')).toBe(true);
    expect(isValidStatus('watching')).toBe(true);
    expect(isValidStatus('completed')).toBe(true);
  });

  it('rejects invalid statuses', () => {
    expect(isValidStatus('unknown')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('WATCHING')).toBe(false);
    expect(isValidStatus('done')).toBe(false);
  });
});

describe('validateSeries', () => {
  const validSeries: Partial<Series> = {
    name: 'Breaking Bad',
    status: 'watching',
    rating: 9.5,
  };

  it('passes for a valid series', () => {
    expect(() => validateSeries(validSeries)).not.toThrow();
  });

  it('throws when name is missing', () => {
    expect(() => validateSeries({ ...validSeries, name: '' })).toThrow(
      'Le nom de la série est requis.'
    );
  });

  it('throws when name is only whitespace', () => {
    expect(() => validateSeries({ ...validSeries, name: '   ' })).toThrow(
      'Le nom de la série est requis.'
    );
  });

  it('throws when rating is negative', () => {
    expect(() => validateSeries({ ...validSeries, rating: -1 })).toThrow(
      'La note doit être comprise entre 0 et 10.'
    );
  });

  it('throws when rating exceeds 10', () => {
    expect(() => validateSeries({ ...validSeries, rating: 11 })).toThrow(
      'La note doit être comprise entre 0 et 10.'
    );
  });

  it('accepts rating of exactly 0 and 10', () => {
    expect(() => validateSeries({ ...validSeries, rating: 0 })).not.toThrow();
    expect(() => validateSeries({ ...validSeries, rating: 10 })).not.toThrow();
  });

  it('accepts null rating', () => {
    expect(() => validateSeries({ ...validSeries, rating: null })).not.toThrow();
  });

  it('throws for invalid status', () => {
    expect(() =>
      validateSeries({ ...validSeries, status: 'invalid' as Series['status'] })
    ).toThrow('Statut invalide.');
  });
});
