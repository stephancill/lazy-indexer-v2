import { describe, it, expect } from 'vitest';
import {
  validateFid,
  validatePagination,
  validateSortOrder,
  validateDate,
  validateQueueName,
  validateTargetBody,
  validateClientTargetBody,
  validateTargetUpdateBody,
} from './validation.js';

describe('Validation Functions', () => {
  describe('validateFid', () => {
    it('should return valid FID for positive integers', () => {
      expect(validateFid('123')).toBe(123);
      expect(validateFid('1')).toBe(1);
      expect(validateFid('999999')).toBe(999999);
    });

    it('should return null for invalid FIDs', () => {
      expect(validateFid('0')).toBe(null);
      expect(validateFid('-1')).toBe(null);
      expect(validateFid('abc')).toBe(null);
      expect(validateFid('')).toBe(null);
      expect(validateFid('12.5')).toBe(null);
    });

    it('should handle numeric inputs', () => {
      expect(validateFid(123)).toBe(123);
      expect(validateFid(0)).toBe(null);
      expect(validateFid(-5)).toBe(null);
    });
  });

  describe('validatePagination', () => {
    it('should return default values for missing parameters', () => {
      const result = validatePagination();
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should parse valid pagination parameters', () => {
      const result = validatePagination('25', '10');
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(10);
    });

    it('should enforce maximum limit', () => {
      const result = validatePagination('200', '0');
      expect(result.limit).toBe(100); // Should be capped at 100
      expect(result.offset).toBe(0);
    });

    it('should enforce minimum offset', () => {
      const result = validatePagination('50', '-10');
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0); // Should be at least 0
    });

    it('should handle invalid string inputs', () => {
      const result = validatePagination('abc', 'def');
      expect(result.limit).toBe(50); // Default
      expect(result.offset).toBe(0); // Default
    });
  });

  describe('validateSortOrder', () => {
    it('should return asc for asc input', () => {
      expect(validateSortOrder('asc')).toBe('asc');
    });

    it('should return desc for any other input', () => {
      expect(validateSortOrder('desc')).toBe('desc');
      expect(validateSortOrder('')).toBe('desc');
      expect(validateSortOrder('invalid')).toBe('desc');
      expect(validateSortOrder()).toBe('desc');
    });
  });

  describe('validateDate', () => {
    it('should return valid Date objects for valid date strings', () => {
      const result = validateDate('2024-01-01');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid date strings', () => {
      expect(validateDate('invalid-date')).toBe(null);
      expect(validateDate('')).toBe(null);
      expect(validateDate('2024-13-01')).toBe(null); // Invalid month
    });

    it('should return null for undefined input', () => {
      expect(validateDate()).toBe(null);
    });

    it('should handle ISO date strings', () => {
      const isoDate = '2024-07-04T12:00:00.000Z';
      const result = validateDate(isoDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoDate);
    });
  });

  describe('validateQueueName', () => {
    it('should return valid queue names', () => {
      expect(validateQueueName('backfill')).toBe('backfill');
      expect(validateQueueName('realtime')).toBe('realtime');
      expect(validateQueueName('process-event')).toBe('process-event');
    });

    it('should return null for invalid queue names', () => {
      expect(validateQueueName('invalid')).toBe(null);
      expect(validateQueueName('')).toBe(null);
      expect(validateQueueName()).toBe(null);
      expect(validateQueueName('BACKFILL')).toBe(null); // Case sensitive
    });
  });

  describe('validateTargetBody', () => {
    it('should validate valid target body', () => {
      const result = validateTargetBody({ fid: 123, isRoot: true });
      expect(result).toEqual({ fid: 123, isRoot: true });
    });

    it('should default isRoot to false', () => {
      const result = validateTargetBody({ fid: 123 });
      expect(result).toEqual({ fid: 123, isRoot: false });
    });

    it('should handle string FID', () => {
      const result = validateTargetBody({ fid: '123', isRoot: false });
      expect(result).toEqual({ fid: 123, isRoot: false });
    });

    it('should return error for missing body', () => {
      expect(validateTargetBody(null)).toBe('Request body is required');
      expect(validateTargetBody()).toBe('Request body is required');
      expect(validateTargetBody('string')).toBe('Request body is required');
    });

    it('should return error for invalid FID', () => {
      expect(validateTargetBody({})).toBe('Valid FID is required');
      expect(validateTargetBody({ fid: 0 })).toBe('Valid FID is required');
      expect(validateTargetBody({ fid: -1 })).toBe('Valid FID is required');
      expect(validateTargetBody({ fid: 'abc' })).toBe('Valid FID is required');
    });

    it('should handle various isRoot values', () => {
      expect(validateTargetBody({ fid: 123, isRoot: true })).toEqual({ fid: 123, isRoot: true });
      expect(validateTargetBody({ fid: 123, isRoot: false })).toEqual({ fid: 123, isRoot: false });
      expect(validateTargetBody({ fid: 123, isRoot: 'true' })).toEqual({ fid: 123, isRoot: false }); // Only true boolean
      expect(validateTargetBody({ fid: 123, isRoot: 1 })).toEqual({ fid: 123, isRoot: false }); // Only true boolean
    });
  });

  describe('validateClientTargetBody', () => {
    it('should validate valid client target body', () => {
      const result = validateClientTargetBody({ clientFid: 456 });
      expect(result).toEqual({ clientFid: 456 });
    });

    it('should handle string clientFid', () => {
      const result = validateClientTargetBody({ clientFid: '456' });
      expect(result).toEqual({ clientFid: 456 });
    });

    it('should return error for missing body', () => {
      expect(validateClientTargetBody(null)).toBe('Request body is required');
      expect(validateClientTargetBody()).toBe('Request body is required');
    });

    it('should return error for invalid clientFid', () => {
      expect(validateClientTargetBody({})).toBe('Valid client FID is required');
      expect(validateClientTargetBody({ clientFid: 0 })).toBe('Valid client FID is required');
      expect(validateClientTargetBody({ clientFid: -1 })).toBe('Valid client FID is required');
      expect(validateClientTargetBody({ clientFid: 'abc' })).toBe('Valid client FID is required');
    });
  });

  describe('validateTargetUpdateBody', () => {
    it('should validate valid update body', () => {
      const result = validateTargetUpdateBody({ isRoot: true });
      expect(result).toEqual({ isRoot: true });
    });

    it('should handle undefined isRoot', () => {
      const result = validateTargetUpdateBody({});
      expect(result).toEqual({ isRoot: undefined });
    });

    it('should return error for missing body', () => {
      expect(validateTargetUpdateBody(null)).toBe('Request body is required');
      expect(validateTargetUpdateBody()).toBe('Request body is required');
    });

    it('should return error for non-boolean isRoot', () => {
      expect(validateTargetUpdateBody({ isRoot: 'true' })).toBe('isRoot must be a boolean value');
      expect(validateTargetUpdateBody({ isRoot: 1 })).toBe('isRoot must be a boolean value');
      expect(validateTargetUpdateBody({ isRoot: 'false' })).toBe('isRoot must be a boolean value');
    });

    it('should allow boolean false', () => {
      const result = validateTargetUpdateBody({ isRoot: false });
      expect(result).toEqual({ isRoot: false });
    });
  });
});

describe('Edge Cases and Security', () => {
  describe('Input Sanitization', () => {
    it('should handle extremely large numbers', () => {
      expect(validateFid('999999999999999999999')).toBe(null);
      expect(validateFid(Number.MAX_SAFE_INTEGER + 1)).toBe(null);
    });

    it('should handle SQL injection attempts in FID', () => {
      expect(validateFid("1'; DROP TABLE users; --")).toBe(null);
      expect(validateFid("1 OR 1=1")).toBe(null);
    });

    it('should handle script injection attempts', () => {
      expect(validateQueueName('<script>alert("xss")</script>')).toBe(null);
      expect(validateQueueName('javascript:alert(1)')).toBe(null);
    });

    it('should handle Unicode and special characters', () => {
      expect(validateFid('1️⃣')).toBe(null);
      expect(validateFid('½')).toBe(null);
      expect(validateQueueName('backfill\u0000')).toBe(null);
    });
  });

  describe('Type Safety', () => {
    it('should handle null and undefined safely', () => {
      expect(validateFid(null)).toBe(null);
      expect(validateFid(undefined)).toBe(null);
      expect(validateQueueName(null)).toBe(null);
      expect(validateQueueName(undefined)).toBe(null);
    });

    it('should handle objects and arrays', () => {
      expect(validateFid({})).toBe(null);
      expect(validateFid([])).toBe(null);
      expect(validateQueueName({})).toBe(null);
      expect(validateQueueName([])).toBe(null);
    });

    it('should handle functions', () => {
      expect(validateFid(() => {})).toBe(null);
      expect(validateQueueName(() => {})).toBe(null);
    });
  });

  describe('Performance', () => {
    it('should handle large valid inputs efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateFid(i.toString());
      }
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle large invalid inputs efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateFid('invalid' + i);
      }
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});