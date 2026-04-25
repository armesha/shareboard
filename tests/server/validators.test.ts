import { describe, it, expect } from 'vitest';
import {
  isValidCursorPosition,
  isValidUserColor,
  isValidAnimalKey,
  isValidDrawingId,
  isValidShapeId,
  isValidShapeType,
  isValidColor,
  isValidBrushWidth,
  isValidPoints,
  isValidShapeData,
} from '../../server/validation/validators';
import { config } from '../../server/config';

describe('validators', () => {
  describe('isValidCursorPosition', () => {
    const { minPosition, maxPosition } = config.validation.cursor;

    it('accepts valid positions within bounds', () => {
      expect(isValidCursorPosition({ x: 0, y: 0 })).toBe(true);
      expect(isValidCursorPosition({ x: 100, y: 200 })).toBe(true);
      expect(isValidCursorPosition({ x: minPosition, y: minPosition })).toBe(true);
      expect(isValidCursorPosition({ x: maxPosition, y: maxPosition })).toBe(true);
      expect(isValidCursorPosition({ x: -100.5, y: 200.7 })).toBe(true);
    });

    it('rejects positions outside bounds', () => {
      expect(isValidCursorPosition({ x: minPosition - 1, y: 0 })).toBe(false);
      expect(isValidCursorPosition({ x: maxPosition + 1, y: 0 })).toBe(false);
      expect(isValidCursorPosition({ x: 0, y: minPosition - 1 })).toBe(false);
      expect(isValidCursorPosition({ x: 0, y: maxPosition + 1 })).toBe(false);
    });

    it('rejects non-finite numbers', () => {
      expect(isValidCursorPosition({ x: NaN, y: 0 })).toBe(false);
      expect(isValidCursorPosition({ x: Infinity, y: 0 })).toBe(false);
      expect(isValidCursorPosition({ x: 0, y: -Infinity })).toBe(false);
    });

    it('rejects invalid shapes', () => {
      expect(isValidCursorPosition(null)).toBe(false);
      expect(isValidCursorPosition(undefined)).toBe(false);
      expect(isValidCursorPosition('not-object')).toBe(false);
      expect(isValidCursorPosition(42)).toBe(false);
      expect(isValidCursorPosition({})).toBe(false);
      expect(isValidCursorPosition({ x: 0 })).toBe(false);
      expect(isValidCursorPosition({ y: 0 })).toBe(false);
      expect(isValidCursorPosition({ x: '10', y: 20 })).toBe(false);
    });
  });

  describe('isValidUserColor', () => {
    const max = config.validation.cursor.maxColorLength;

    it('accepts strings within length limit', () => {
      expect(isValidUserColor('red')).toBe(true);
      expect(isValidUserColor('#FF0000')).toBe(true);
      expect(isValidUserColor('a'.repeat(max))).toBe(true);
      expect(isValidUserColor('')).toBe(true);
    });

    it('rejects strings over limit', () => {
      expect(isValidUserColor('a'.repeat(max + 1))).toBe(false);
    });

    it('rejects non-strings', () => {
      expect(isValidUserColor(null)).toBe(false);
      expect(isValidUserColor(undefined)).toBe(false);
      expect(isValidUserColor(123)).toBe(false);
      expect(isValidUserColor({})).toBe(false);
    });
  });

  describe('isValidAnimalKey', () => {
    const max = config.validation.cursor.maxAnimalKeyLength;

    it('accepts strings within length limit', () => {
      expect(isValidAnimalKey('fox')).toBe(true);
      expect(isValidAnimalKey('a'.repeat(max))).toBe(true);
    });

    it('rejects strings over limit and non-strings', () => {
      expect(isValidAnimalKey('a'.repeat(max + 1))).toBe(false);
      expect(isValidAnimalKey(null)).toBe(false);
      expect(isValidAnimalKey(42)).toBe(false);
    });
  });

  describe('isValidDrawingId', () => {
    const max = config.validation.drawing.maxIdLength;

    it('accepts non-empty strings within limit', () => {
      expect(isValidDrawingId('abc')).toBe(true);
      expect(isValidDrawingId('drawing-uuid-123')).toBe(true);
      expect(isValidDrawingId('a'.repeat(max))).toBe(true);
    });

    it('rejects empty, too long, or non-strings', () => {
      expect(isValidDrawingId('')).toBe(false);
      expect(isValidDrawingId('a'.repeat(max + 1))).toBe(false);
      expect(isValidDrawingId(null)).toBe(false);
      expect(isValidDrawingId(undefined)).toBe(false);
      expect(isValidDrawingId(123)).toBe(false);
    });
  });

  describe('isValidShapeId', () => {
    const max = config.validation.drawing.maxShapeIdLength;

    it('accepts non-empty strings within limit', () => {
      expect(isValidShapeId('shape-1')).toBe(true);
      expect(isValidShapeId('a'.repeat(max))).toBe(true);
    });

    it('rejects empty, too long, or non-strings', () => {
      expect(isValidShapeId('')).toBe(false);
      expect(isValidShapeId('a'.repeat(max + 1))).toBe(false);
      expect(isValidShapeId(null)).toBe(false);
    });
  });

  describe('isValidShapeType', () => {
    const max = config.validation.drawing.maxShapeTypeLength;

    it('accepts valid type strings', () => {
      expect(isValidShapeType('rect')).toBe(true);
      expect(isValidShapeType('circle')).toBe(true);
      expect(isValidShapeType('a'.repeat(max))).toBe(true);
    });

    it('rejects empty, too long, or non-strings', () => {
      expect(isValidShapeType('')).toBe(false);
      expect(isValidShapeType('a'.repeat(max + 1))).toBe(false);
      expect(isValidShapeType(null)).toBe(false);
      expect(isValidShapeType(123)).toBe(false);
    });
  });

  describe('isValidColor', () => {
    it('accepts hex colors (3 and 6 digits)', () => {
      expect(isValidColor('#FFF')).toBe(true);
      expect(isValidColor('#fff')).toBe(true);
      expect(isValidColor('#FF0000')).toBe(true);
      expect(isValidColor('#abc123')).toBe(true);
    });

    it('accepts rgb/rgba functional notation', () => {
      expect(isValidColor('rgb(255, 0, 0)')).toBe(true);
      expect(isValidColor('rgba(255, 0, 0, 0.5)')).toBe(true);
      expect(isValidColor('rgb( 0,0,0 )')).toBe(true);
    });

    it('accepts named colors', () => {
      expect(isValidColor('red')).toBe(true);
      expect(isValidColor('transparent')).toBe(true);
      expect(isValidColor('white')).toBe(true);
    });

    it('rejects malformed values', () => {
      expect(isValidColor('#GG0000')).toBe(false);
      expect(isValidColor('#12')).toBe(false);
      expect(isValidColor('rgb(255, 0)')).toBe(false);
      expect(isValidColor('red; DROP TABLE')).toBe(false);
      expect(isValidColor('javascript:alert(1)')).toBe(false);
      expect(isValidColor('')).toBe(false);
      expect(isValidColor(null)).toBe(false);
      expect(isValidColor(123)).toBe(false);
    });
  });

  describe('isValidBrushWidth', () => {
    const { minBrushWidth, maxBrushWidth } = config.validation.drawing;

    it('accepts numbers within bounds', () => {
      expect(isValidBrushWidth(minBrushWidth)).toBe(true);
      expect(isValidBrushWidth(maxBrushWidth)).toBe(true);
      expect(isValidBrushWidth((minBrushWidth + maxBrushWidth) / 2)).toBe(true);
    });

    it('rejects numbers outside bounds', () => {
      expect(isValidBrushWidth(minBrushWidth - 1)).toBe(false);
      expect(isValidBrushWidth(maxBrushWidth + 1)).toBe(false);
      expect(isValidBrushWidth(-1)).toBe(false);
    });

    it('rejects non-finite and non-numbers', () => {
      expect(isValidBrushWidth(NaN)).toBe(false);
      expect(isValidBrushWidth(Infinity)).toBe(false);
      expect(isValidBrushWidth('5')).toBe(false);
      expect(isValidBrushWidth(null)).toBe(false);
      expect(isValidBrushWidth(undefined)).toBe(false);
    });
  });

  describe('isValidPoints', () => {
    const max = config.validation.drawing.maxPointsLength;

    it('accepts arrays of finite numbers', () => {
      expect(isValidPoints([0, 0, 10, 10])).toBe(true);
      expect(isValidPoints([])).toBe(true);
      expect(isValidPoints([1.5, 2.5, 3.5])).toBe(true);
    });

    it('accepts arrays of {x,y} Position objects', () => {
      expect(isValidPoints([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toBe(true);
    });

    it('rejects arrays over length limit', () => {
      expect(isValidPoints(new Array(max + 1).fill(0))).toBe(false);
    });

    it('rejects arrays with invalid elements', () => {
      expect(isValidPoints([NaN])).toBe(false);
      expect(isValidPoints([Infinity])).toBe(false);
      expect(isValidPoints([{ x: NaN, y: 0 }])).toBe(false);
      expect(isValidPoints([{ x: 0 }])).toBe(false);
      expect(isValidPoints(['bad'])).toBe(false);
      expect(isValidPoints([null])).toBe(false);
    });

    it('rejects non-arrays', () => {
      expect(isValidPoints('not-array')).toBe(false);
      expect(isValidPoints(null)).toBe(false);
      expect(isValidPoints({ 0: 1, length: 1 })).toBe(false);
    });
  });

  describe('isValidShapeData', () => {
    it('accepts objects with valid numeric props', () => {
      expect(isValidShapeData({})).toBe(true);
      expect(isValidShapeData({ left: 10, top: 20 })).toBe(true);
      expect(isValidShapeData({ width: 100, height: 50, angle: 45 })).toBe(true);
      expect(isValidShapeData({ scaleX: 1.5, scaleY: 2 })).toBe(true);
      expect(isValidShapeData({ x1: 0, y1: 0, x2: 100, y2: 100 })).toBe(true);
    });

    it('accepts objects with unknown props (only validates the known numeric ones)', () => {
      expect(isValidShapeData({ customField: 'anything', left: 10 })).toBe(true);
    });

    it('rejects objects with invalid numeric props', () => {
      expect(isValidShapeData({ left: 'not-a-number' })).toBe(false);
      expect(isValidShapeData({ width: NaN })).toBe(false);
      expect(isValidShapeData({ height: Infinity })).toBe(false);
      expect(isValidShapeData({ angle: -Infinity })).toBe(false);
      expect(isValidShapeData({ x1: null })).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(isValidShapeData(null)).toBe(false);
      expect(isValidShapeData(undefined)).toBe(false);
      expect(isValidShapeData('string')).toBe(false);
      expect(isValidShapeData(42)).toBe(false);
    });
  });
});
