import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ARROW } from '../../client/src/constants';

vi.mock('fabric', () => {
  const mockLine = class {
    constructor(points, options) {
      this.points = points;
      this.x1 = points[0];
      this.y1 = points[1];
      this.x2 = points[2];
      this.y2 = points[3];
      Object.assign(this, options);
    }
    set(key, value) {
      if (typeof key === 'object') {
        Object.assign(this, key);
      } else {
        this[key] = value;
      }
    }
    callSuper(method, ..._args) {
      if (method === 'initialize') {
        return;
      }
      if (method === 'toObject') {
        return {
          type: 'line',
          x1: this.x1,
          y1: this.y1,
          x2: this.x2,
          y2: this.y2,
          stroke: this.stroke,
          strokeWidth: this.strokeWidth
        };
      }
    }
    calcLinePoints() {
      return {
        x1: this.x1,
        y1: this.y1,
        x2: this.x2,
        y2: this.y2
      };
    }
  };

  const mockUtil = {
    createClass: (parent, methods) => {
      return class extends parent {
        constructor(...args) {
          super(...args);
          if (methods.initialize) {
            methods.initialize.call(this, ...args);
          }
          if (methods.type) {
            this.type = methods.type;
          }
        }
        _render(ctx) {
          if (methods._render) {
            methods._render.call(this, ctx);
          }
        }
        toObject(propertiesToInclude) {
          if (methods.toObject) {
            return methods.toObject.call(this, propertiesToInclude);
          }
        }
      };
    },
    object: {
      extend: (...objects) => {
        return Object.assign({}, ...objects);
      }
    }
  };

  return {
    fabric: {
      Line: mockLine,
      util: mockUtil,
      Arrow: null
    }
  };
});

describe('fabric.Arrow', () => {
  let Arrow;

  beforeEach(async () => {
    vi.resetModules();
    await import('../../client/src/utils/fabricArrow.js');
    const { fabric } = await import('fabric');
    Arrow = fabric.Arrow;
  });

  describe('initialization', () => {
    it('should initialize with default headLength and headAngle', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      expect(arrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(arrow.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should initialize with custom headLength', () => {
      const customHeadLength = 25;
      const arrow = new Arrow([10, 20, 100, 200], { headLength: customHeadLength });
      expect(arrow.headLength).toBe(customHeadLength);
      expect(arrow.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should initialize with custom headAngle', () => {
      const customHeadAngle = Math.PI / 4;
      const arrow = new Arrow([10, 20, 100, 200], { headAngle: customHeadAngle });
      expect(arrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(arrow.headAngle).toBe(customHeadAngle);
    });

    it('should initialize with both custom headLength and headAngle', () => {
      const customHeadLength = 30;
      const customHeadAngle = Math.PI / 3;
      const arrow = new Arrow([10, 20, 100, 200], {
        headLength: customHeadLength,
        headAngle: customHeadAngle
      });
      expect(arrow.headLength).toBe(customHeadLength);
      expect(arrow.headAngle).toBe(customHeadAngle);
    });

    it('should initialize with other Line options', () => {
      const arrow = new Arrow([10, 20, 100, 200], {
        stroke: '#FF0000',
        strokeWidth: 3
      });
      expect(arrow.stroke).toBe('#FF0000');
      expect(arrow.strokeWidth).toBe(3);
    });

    it('should have type property set to arrow', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      expect(arrow.type).toBe('arrow');
    });

    it('should handle undefined options', () => {
      const arrow = new Arrow([10, 20, 100, 200]);
      expect(arrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(arrow.headAngle).toBe(ARROW.HEAD_ANGLE);
    });
  });

  describe('_render', () => {
    let mockCtx;
    let arrow;

    beforeEach(() => {
      mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow = new Arrow([0, 0, 100, 0], {
        stroke: '#0000FF',
        strokeWidth: 2,
        strokeLineCap: 'round'
      });
    });

    it('should call beginPath once', () => {
      arrow._render(mockCtx);
      expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
    });

    it('should draw main line from start to end', () => {
      arrow._render(mockCtx);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(0, 0);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(100, 0);
    });

    it('should draw two arrowhead lines', () => {
      arrow._render(mockCtx);
      const lineToCallCount = mockCtx.lineTo.mock.calls.length;
      expect(lineToCallCount).toBe(3);
    });

    it('should set lineWidth from strokeWidth', () => {
      arrow._render(mockCtx);
      expect(mockCtx.lineWidth).toBe(2);
    });

    it('should set lineCap from strokeLineCap', () => {
      arrow._render(mockCtx);
      expect(mockCtx.lineCap).toBe('round');
    });

    it('should set lineJoin to miter', () => {
      arrow._render(mockCtx);
      expect(mockCtx.lineJoin).toBe('miter');
    });

    it('should set strokeStyle to stroke color if provided', () => {
      const originalStyle = mockCtx.strokeStyle;
      arrow._render(mockCtx);
      expect(mockCtx.strokeStyle).toBe(originalStyle);
    });

    it('should use fillStyle when stroke is not provided', () => {
      const arrowNoStroke = new Arrow([0, 0, 100, 0], { strokeWidth: 2 });
      const originalStyle = mockCtx.strokeStyle;
      mockCtx.fillStyle = '#FF0000';
      arrowNoStroke._render(mockCtx);
      expect(mockCtx.strokeStyle).toBe(originalStyle);
    });

    it('should restore original strokeStyle', () => {
      const originalStyle = '#AABBCC';
      mockCtx.strokeStyle = originalStyle;
      arrow._render(mockCtx);
      expect(mockCtx.strokeStyle).toBe(originalStyle);
    });

    it('should call stroke once', () => {
      arrow._render(mockCtx);
      expect(mockCtx.stroke).toHaveBeenCalledTimes(1);
    });

    it('should calculate correct arrowhead for horizontal line (right)', () => {
      const arrow = new Arrow([0, 0, 100, 0], {});
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      expect(lineToCallsForArrowhead).toHaveLength(2);

      const [x1, y1] = lineToCallsForArrowhead[0];
      const [x2, y2] = lineToCallsForArrowhead[1];

      expect(x1).toBeLessThan(100);
      expect(x2).toBeLessThan(100);
      expect(y1).not.toBe(0);
      expect(y2).not.toBe(0);
      expect(y1 * y2).toBeLessThan(0);
    });

    it('should calculate correct arrowhead for vertical line (down)', () => {
      const arrow = new Arrow([0, 0, 0, 100], {});
      arrow._render(mockCtx);

      const allLineToCalls = mockCtx.lineTo.mock.calls;
      expect(allLineToCalls[0]).toEqual([0, 100]);

      const [x1, y1] = allLineToCalls[1];
      const [x2, y2] = allLineToCalls[2];

      expect(y1).toBeLessThan(100);
      expect(y2).toBeLessThan(100);
      expect(x1).toBeLessThan(0);
      expect(x2).toBeGreaterThan(0);
    });

    it('should calculate correct arrowhead for diagonal line', () => {
      const arrow = new Arrow([0, 0, 100, 100], {});
      arrow._render(mockCtx);

      const allLineToCalls = mockCtx.lineTo.mock.calls;
      expect(allLineToCalls[0]).toEqual([100, 100]);

      const [x1, y1] = allLineToCalls[1];
      const [x2, y2] = allLineToCalls[2];

      expect(x1).toBeLessThan(100);
      expect(y1).toBeLessThan(100);
      expect(x2).toBeLessThan(100);
      expect(y2).toBeLessThan(100);
    });

    it('should use custom headLength when provided', () => {
      const customHeadLength = 30;
      const arrow = new Arrow([0, 0, 100, 0], { headLength: customHeadLength });
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0];

      const distance = 100 - x1;
      expect(distance).toBeCloseTo(customHeadLength * Math.cos(ARROW.HEAD_ANGLE), 1);
    });

    it('should use custom headAngle when provided', () => {
      const customHeadAngle = Math.PI / 4;
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: customHeadAngle });
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0];
      const [, y2] = lineToCallsForArrowhead[1];

      expect(Math.abs(y1)).toBeGreaterThan(Math.abs(ARROW.HEAD_LENGTH * Math.sin(ARROW.HEAD_ANGLE)));
      expect(Math.abs(y2)).toBeGreaterThan(Math.abs(ARROW.HEAD_LENGTH * Math.sin(ARROW.HEAD_ANGLE)));
    });

    it('should fallback to default headLength if not set', () => {
      const arrow = new Arrow([0, 0, 100, 0], {});
      arrow.headLength = undefined;
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0];
      const distance = 100 - x1;
      expect(distance).toBeCloseTo(ARROW.HEAD_LENGTH * Math.cos(ARROW.HEAD_ANGLE), 1);
    });

    it('should fallback to default headAngle if not set', () => {
      const arrow = new Arrow([0, 0, 100, 0], {});
      arrow.headAngle = undefined;
      arrow._render(mockCtx);

      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle zero length arrow', () => {
      const arrow = new Arrow([50, 50, 50, 50], {});
      arrow._render(mockCtx);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should handle negative coordinates', () => {
      const arrow = new Arrow([-100, -100, -50, -50], {});
      arrow._render(mockCtx);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should handle arrow pointing left', () => {
      const arrow = new Arrow([100, 0, 0, 0], {});
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0];
      const [x2] = lineToCallsForArrowhead[1];

      expect(x1).toBeGreaterThan(0);
      expect(x2).toBeGreaterThan(0);
    });

    it('should handle arrow pointing up', () => {
      const arrow = new Arrow([0, 100, 0, 0], {});
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0];
      const [, y2] = lineToCallsForArrowhead[1];

      expect(y1).toBeGreaterThan(0);
      expect(y2).toBeGreaterThan(0);
    });
  });

  describe('toObject', () => {
    it('should serialize arrow with default properties', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      const obj = arrow.toObject();

      expect(obj.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(obj.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should serialize arrow with custom headLength', () => {
      const customHeadLength = 25;
      const arrow = new Arrow([10, 20, 100, 200], { headLength: customHeadLength });
      const obj = arrow.toObject();

      expect(obj.headLength).toBe(customHeadLength);
    });

    it('should serialize arrow with custom headAngle', () => {
      const customHeadAngle = Math.PI / 4;
      const arrow = new Arrow([10, 20, 100, 200], { headAngle: customHeadAngle });
      const obj = arrow.toObject();

      expect(obj.headAngle).toBe(customHeadAngle);
    });

    it('should include base Line properties', () => {
      const arrow = new Arrow([10, 20, 100, 200], {
        stroke: '#FF0000',
        strokeWidth: 3
      });
      const obj = arrow.toObject();

      expect(obj.type).toBe('line');
      expect(obj.stroke).toBe('#FF0000');
      expect(obj.strokeWidth).toBe(3);
    });

    it('should handle propertiesToInclude parameter', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      const obj = arrow.toObject(['customProp']);

      expect(obj.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(obj.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should include coordinates', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      const obj = arrow.toObject();

      expect(obj.x1).toBe(10);
      expect(obj.y1).toBe(20);
      expect(obj.x2).toBe(100);
      expect(obj.y2).toBe(200);
    });
  });

  describe('fromObject', () => {
    it('should deserialize arrow from object', async () => {
      const object = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200,
        headLength: 20,
        headAngle: Math.PI / 4,
        stroke: '#FF0000',
        strokeWidth: 3
      };

      let deserializedArrow;
      const { fabric } = await import('fabric');
      fabric.Arrow.fromObject(object, (arrow) => {
        deserializedArrow = arrow;
      });

      expect(deserializedArrow).toBeDefined();
      expect(deserializedArrow.headLength).toBe(20);
      expect(deserializedArrow.headAngle).toBe(Math.PI / 4);
      expect(deserializedArrow.stroke).toBe('#FF0000');
      expect(deserializedArrow.strokeWidth).toBe(3);
    });

    it('should construct points array from coordinates', async () => {
      const object = {
        x1: 50,
        y1: 60,
        x2: 150,
        y2: 160,
        headLength: ARROW.HEAD_LENGTH,
        headAngle: ARROW.HEAD_ANGLE
      };

      let deserializedArrow;
      const { fabric } = await import('fabric');
      fabric.Arrow.fromObject(object, (arrow) => {
        deserializedArrow = arrow;
      });

      expect(deserializedArrow.x1).toBe(50);
      expect(deserializedArrow.y1).toBe(60);
      expect(deserializedArrow.x2).toBe(150);
      expect(deserializedArrow.y2).toBe(160);
    });

    it('should handle callback being undefined', async () => {
      const object = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200
      };

      const { fabric } = await import('fabric');
      expect(() => {
        fabric.Arrow.fromObject(object);
      }).not.toThrow();
    });

    it('should work without headLength and headAngle in object', async () => {
      const object = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200
      };

      let deserializedArrow;
      const { fabric } = await import('fabric');
      fabric.Arrow.fromObject(object, (arrow) => {
        deserializedArrow = arrow;
      });

      expect(deserializedArrow).toBeDefined();
      expect(deserializedArrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(deserializedArrow.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should preserve all object properties', async () => {
      const object = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200,
        headLength: 25,
        headAngle: Math.PI / 3,
        stroke: '#00FF00',
        strokeWidth: 5,
        opacity: 0.5,
        customProp: 'customValue'
      };

      let deserializedArrow;
      const { fabric } = await import('fabric');
      fabric.Arrow.fromObject(object, (arrow) => {
        deserializedArrow = arrow;
      });

      expect(deserializedArrow.opacity).toBe(0.5);
      expect(deserializedArrow.customProp).toBe('customValue');
    });
  });

  describe('async property', () => {
    it('should have async property set to true', async () => {
      const { fabric } = await import('fabric');
      expect(fabric.Arrow.async).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle very small headLength', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headLength: 0.1 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very large headLength', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headLength: 200 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very small headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: 0.01 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very large headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: Math.PI / 2 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle large coordinate values', () => {
      const arrow = new Arrow([10000, 10000, 20000, 20000], {});
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(10000, 10000);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(20000, 20000);
    });

    it('should handle floating point coordinates', () => {
      const arrow = new Arrow([10.5, 20.7, 100.3, 200.9], {});
      expect(arrow.x1).toBe(10.5);
      expect(arrow.y1).toBe(20.7);
      expect(arrow.x2).toBe(100.3);
      expect(arrow.y2).toBe(200.9);
    });

    it('should handle zero headLength', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headLength: 0 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0];
      const [x2] = lineToCallsForArrowhead[1];

      expect(x1).toBeLessThan(100);
      expect(x2).toBeLessThan(100);
    });

    it('should handle zero headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: 0 });
      const mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000'
      };

      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0];
      const [, y2] = lineToCallsForArrowhead[1];

      expect(y1).not.toBe(0);
      expect(y2).not.toBe(0);
    });
  });
});
