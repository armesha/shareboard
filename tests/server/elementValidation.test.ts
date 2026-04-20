import { describe, it, expect } from 'vitest';
import {
  isValidWorkspaceId,
  isValidElementData,
  isValidElement,
  WORKSPACE_ID_REGEX,
  ELEMENT_TYPES
} from '../../server/handlers/elementValidation';

describe('elementValidation', () => {
  describe('isValidWorkspaceId', () => {
    it('should accept valid workspace IDs', () => {
      expect(isValidWorkspaceId('abc123')).toBe(true);
      expect(isValidWorkspaceId('test-workspace')).toBe(true);
      expect(isValidWorkspaceId('my_workspace_01')).toBe(true);
      expect(isValidWorkspaceId('A')).toBe(true);
      expect(isValidWorkspaceId('a'.repeat(32))).toBe(true);
    });

    it('should reject invalid workspace IDs', () => {
      expect(isValidWorkspaceId('')).toBe(false);
      expect(isValidWorkspaceId('a'.repeat(33))).toBe(false);
      expect(isValidWorkspaceId('workspace with spaces')).toBe(false);
      expect(isValidWorkspaceId('workspace@special')).toBe(false);
      expect(isValidWorkspaceId(null)).toBe(false);
      expect(isValidWorkspaceId(undefined)).toBe(false);
      expect(isValidWorkspaceId(123)).toBe(false);
      expect(isValidWorkspaceId({})).toBe(false);
    });
  });

  describe('isValidElementData', () => {
    it('should accept valid element data', () => {
      expect(isValidElementData({})).toBe(true);
      expect(isValidElementData({ left: 100, top: 200 })).toBe(true);
      expect(isValidElementData({ width: 50, height: 50, angle: 45 })).toBe(true);
      expect(isValidElementData({ scaleX: 1.5, scaleY: 2 })).toBe(true);
      expect(isValidElementData({ x1: 0, y1: 0, x2: 100, y2: 100 })).toBe(true);
      expect(isValidElementData({ text: 'Hello' })).toBe(true);
      expect(isValidElementData({ strokeWidth: 2, fontSize: 14 })).toBe(true);
    });

    it('should reject invalid numeric values', () => {
      expect(isValidElementData({ left: 'not a number' })).toBe(false);
      expect(isValidElementData({ width: NaN })).toBe(false);
      expect(isValidElementData({ height: Infinity })).toBe(false);
      expect(isValidElementData({ angle: -Infinity })).toBe(false);
    });

    it('should reject invalid text values', () => {
      expect(isValidElementData({ text: 123 })).toBe(false);
      expect(isValidElementData({ text: 'a'.repeat(100001) })).toBe(false);
    });

    it('should reject invalid src values', () => {
      expect(isValidElementData({ src: 123 })).toBe(false);
      expect(isValidElementData({ src: 'a'.repeat(10000001) })).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidElementData(null)).toBe(false);
      expect(isValidElementData(undefined)).toBe(false);
      expect(isValidElementData('string')).toBe(false);
      expect(isValidElementData(123)).toBe(false);
    });
  });

  describe('isValidElement', () => {
    it('should accept valid elements', () => {
      expect(isValidElement({ id: 'abc123', type: 'rect', data: {} })).toBe(true);
      expect(isValidElement({ id: 'el-1', type: 'circle', data: { left: 100, top: 200 } })).toBe(true);
      expect(isValidElement({ id: 'path-id', type: 'path', data: { strokeWidth: 2 } })).toBe(true);
      expect(isValidElement({ id: 'txt', type: 'text', data: { text: 'Hello' } })).toBe(true);
      expect(isValidElement({ id: 'd1', type: 'diagram', data: { src: 'data:image/png;base64,abc' } })).toBe(true);
    });

    it('should accept all valid element types', () => {
      const validTypes = ['rect', 'circle', 'ellipse', 'triangle', 'line', 'arrow', 'path',
        'text', 'diagram', 'polygon', 'star', 'diamond', 'pentagon', 'hexagon', 'octagon', 'cross'];
      validTypes.forEach(type => {
        expect(isValidElement({ id: 'test', type, data: {} })).toBe(true);
      });
    });

    it('should reject elements with invalid id', () => {
      expect(isValidElement({ id: '', type: 'rect', data: {} })).toBe(false);
      expect(isValidElement({ id: 'a'.repeat(129), type: 'rect', data: {} })).toBe(false);
      expect(isValidElement({ id: 123, type: 'rect', data: {} })).toBe(false);
      expect(isValidElement({ type: 'rect', data: {} })).toBe(false);
    });

    it('should reject elements with invalid type', () => {
      expect(isValidElement({ id: 'test', type: 'invalid', data: {} })).toBe(false);
      expect(isValidElement({ id: 'test', type: '', data: {} })).toBe(false);
      expect(isValidElement({ id: 'test', data: {} })).toBe(false);
    });

    it('should reject elements with invalid data', () => {
      expect(isValidElement({ id: 'test', type: 'rect', data: null })).toBe(false);
      expect(isValidElement({ id: 'test', type: 'rect', data: { left: 'invalid' } })).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidElement(null)).toBe(false);
      expect(isValidElement(undefined)).toBe(false);
      expect(isValidElement('string')).toBe(false);
    });
  });

  describe('constants', () => {
    it('should export valid WORKSPACE_ID_REGEX', () => {
      expect(WORKSPACE_ID_REGEX).toBeInstanceOf(RegExp);
      expect(WORKSPACE_ID_REGEX.test('valid-id')).toBe(true);
    });

    it('should export ELEMENT_TYPES set with all valid types', () => {
      expect(ELEMENT_TYPES).toBeInstanceOf(Set);
      expect(ELEMENT_TYPES.size).toBeGreaterThan(0);
      expect(ELEMENT_TYPES.has('rect')).toBe(true);
      expect(ELEMENT_TYPES.has('circle')).toBe(true);
    });
  });
});
