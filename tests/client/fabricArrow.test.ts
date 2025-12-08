import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { ARROW } from '../../client/src/constants';

// Types for the mock implementations
interface MockLinePoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface MockLineOptions {
  strokeWidth?: number;
  strokeLineCap?: CanvasLineCap;
  stroke?: string;
  [key: string]: unknown;
}

interface MockCanvasRenderingContext2D {
  beginPath: Mock;
  moveTo: Mock;
  lineTo: Mock;
  stroke: Mock;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
}

interface ArrowOptions extends MockLineOptions {
  headLength?: number;
  headAngle?: number;
  opacity?: number;
  customProp?: string;
}

interface SerializedArrowObject {
  type?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  stroke?: string;
  strokeWidth?: number;
  headLength?: number;
  headAngle?: number;
  opacity?: number;
  customProp?: string;
  [key: string]: unknown;
}

interface ArrowInstance {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  strokeLineCap: CanvasLineCap;
  stroke?: string;
  headLength?: number;
  headAngle?: number;
  type: string;
  _render(ctx: MockCanvasRenderingContext2D): void;
  toObject(propertiesToInclude?: string[]): SerializedArrowObject;
  [key: string]: unknown;
}

interface ArrowConstructor {
  new (points?: [number, number, number, number], options?: ArrowOptions): ArrowInstance;
  type: string;
  cacheProperties: string[];
  fromObject(object: SerializedArrowObject): Promise<ArrowInstance>;
}

class MockLine {
  static type = 'Line';
  static cacheProperties = ['x1', 'y1', 'x2', 'y2'];

  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  strokeLineCap: CanvasLineCap;
  stroke?: string;
  [key: string]: unknown;

  constructor(points: [number, number, number, number] = [0, 0, 0, 0], options: MockLineOptions = {}) {
    this.x1 = points[0];
    this.y1 = points[1];
    this.x2 = points[2];
    this.y2 = points[3];
    this.strokeWidth = options.strokeWidth ?? 1;
    this.strokeLineCap = options.strokeLineCap ?? 'butt';
    this.stroke = options.stroke;
    Object.assign(this, options);
  }

  get type(): string {
    return 'line';
  }

  calcLinePoints(): MockLinePoints {
    const width = this.x2 - this.x1;
    const height = this.y2 - this.y1;
    return {
      x1: -width / 2 || 0,
      y1: -height / 2 || 0,
      x2: width / 2 || 0,
      y2: height / 2 || 0
    };
  }

  toObject(propertiesToInclude: string[] = []): SerializedArrowObject {
    const base: SerializedArrowObject = {
      type: this.type,
      x1: this.x1,
      y1: this.y1,
      x2: this.x2,
      y2: this.y2,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth
    };
    propertiesToInclude.forEach(prop => {
      if (this[prop] !== undefined) {
        base[prop] = this[prop];
      }
    });
    return base;
  }
}

type ClassConstructor = new (...args: unknown[]) => unknown;

interface ClassConstructorWithType extends ClassConstructor {
  type?: string;
}

class MockClassRegistry {
  private json: Map<string, ClassConstructor>;

  constructor() {
    this.json = new Map();
  }

  setClass(classConstructor: ClassConstructorWithType, classType?: string): void {
    const type = classType ?? classConstructor.type;
    if (type) {
      this.json.set(type, classConstructor);
    }
  }

  getClass(classType: string): ClassConstructor | undefined {
    return this.json.get(classType);
  }
}

vi.mock('fabric', () => {
  return {
    Line: MockLine,
    classRegistry: new MockClassRegistry()
  };
});

describe('Arrow', () => {
  let Arrow: ArrowConstructor;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../client/src/utils/fabricArrow');
    Arrow = module.Arrow as unknown as ArrowConstructor;
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

    it('should have static type property', () => {
      expect(Arrow.type).toBe('Arrow');
    });

    it('should include headLength and headAngle in cacheProperties', () => {
      expect(Arrow.cacheProperties).toContain('headLength');
      expect(Arrow.cacheProperties).toContain('headAngle');
    });
  });

  describe('_render', () => {
    let mockCtx: MockCanvasRenderingContext2D;
    let arrow: ArrowInstance;

    beforeEach(() => {
      mockCtx = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
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

    it('should draw main line from start to end using relative coordinates', () => {
      arrow._render(mockCtx);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(-50, 0);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(50, 0);
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

      const [x1, y1] = lineToCallsForArrowhead[0] as [number, number];
      const [x2, y2] = lineToCallsForArrowhead[1] as [number, number];

      expect(x1).toBeLessThan(50);
      expect(x2).toBeLessThan(50);
      expect(y1).not.toBe(0);
      expect(y2).not.toBe(0);
      expect(y1 * y2).toBeLessThan(0);
    });

    it('should calculate correct arrowhead for vertical line (down)', () => {
      const arrow = new Arrow([0, 0, 0, 100], {});
      arrow._render(mockCtx);

      const allLineToCalls = mockCtx.lineTo.mock.calls;
      expect(allLineToCalls[0]).toEqual([0, 50]);

      const [x1, y1] = allLineToCalls[1] as [number, number];
      const [x2, y2] = allLineToCalls[2] as [number, number];

      expect(y1).toBeLessThan(50);
      expect(y2).toBeLessThan(50);
      expect(x1).toBeLessThan(0);
      expect(x2).toBeGreaterThan(0);
    });

    it('should calculate correct arrowhead for diagonal line', () => {
      const arrow = new Arrow([0, 0, 100, 100], {});
      arrow._render(mockCtx);

      const allLineToCalls = mockCtx.lineTo.mock.calls;
      expect(allLineToCalls[0]).toEqual([50, 50]);

      const [x1, y1] = allLineToCalls[1] as [number, number];
      const [x2, y2] = allLineToCalls[2] as [number, number];

      expect(x1).toBeLessThan(50);
      expect(y1).toBeLessThan(50);
      expect(x2).toBeLessThan(50);
      expect(y2).toBeLessThan(50);
    });

    it('should use custom headLength when provided', () => {
      const customHeadLength = 30;
      const arrow = new Arrow([0, 0, 100, 0], { headLength: customHeadLength });
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0] as [number, number];

      const distance = 50 - x1;
      expect(distance).toBeCloseTo(customHeadLength * Math.cos(ARROW.HEAD_ANGLE), 1);
    });

    it('should use custom headAngle when provided', () => {
      const customHeadAngle = Math.PI / 4;
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: customHeadAngle });
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0] as [number, number];
      const [, y2] = lineToCallsForArrowhead[1] as [number, number];

      expect(Math.abs(y1)).toBeGreaterThan(Math.abs(ARROW.HEAD_LENGTH * Math.sin(ARROW.HEAD_ANGLE)));
      expect(Math.abs(y2)).toBeGreaterThan(Math.abs(ARROW.HEAD_LENGTH * Math.sin(ARROW.HEAD_ANGLE)));
    });

    it('should fallback to default headLength if not set', () => {
      const arrow = new Arrow([0, 0, 100, 0], {});
      arrow.headLength = undefined;
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0] as [number, number];
      const distance = 50 - x1;
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
      const [x1] = lineToCallsForArrowhead[0] as [number, number];
      const [x2] = lineToCallsForArrowhead[1] as [number, number];

      expect(x1).toBeGreaterThan(-50);
      expect(x2).toBeGreaterThan(-50);
    });

    it('should handle arrow pointing up', () => {
      const arrow = new Arrow([0, 100, 0, 0], {});
      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0] as [number, number];
      const [, y2] = lineToCallsForArrowhead[1] as [number, number];

      expect(y1).toBeGreaterThan(-50);
      expect(y2).toBeGreaterThan(-50);
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

      expect(obj.type).toBe('arrow');
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

  describe('fromObject (Promise-based)', () => {
    it('should deserialize arrow from object', async () => {
      const object: SerializedArrowObject = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200,
        headLength: 20,
        headAngle: Math.PI / 4,
        stroke: '#FF0000',
        strokeWidth: 3
      };

      const deserializedArrow = await Arrow.fromObject(object);

      expect(deserializedArrow).toBeDefined();
      expect(deserializedArrow.headLength).toBe(20);
      expect(deserializedArrow.headAngle).toBe(Math.PI / 4);
      expect(deserializedArrow.stroke).toBe('#FF0000');
      expect(deserializedArrow.strokeWidth).toBe(3);
    });

    it('should construct points array from coordinates', async () => {
      const object: SerializedArrowObject = {
        x1: 50,
        y1: 60,
        x2: 150,
        y2: 160,
        headLength: ARROW.HEAD_LENGTH,
        headAngle: ARROW.HEAD_ANGLE
      };

      const deserializedArrow = await Arrow.fromObject(object);

      expect(deserializedArrow.x1).toBe(50);
      expect(deserializedArrow.y1).toBe(60);
      expect(deserializedArrow.x2).toBe(150);
      expect(deserializedArrow.y2).toBe(160);
    });

    it('should work without headLength and headAngle in object', async () => {
      const object: SerializedArrowObject = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200
      };

      const deserializedArrow = await Arrow.fromObject(object);

      expect(deserializedArrow).toBeDefined();
      expect(deserializedArrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(deserializedArrow.headAngle).toBe(ARROW.HEAD_ANGLE);
    });

    it('should preserve all object properties', async () => {
      const object: SerializedArrowObject = {
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

      const deserializedArrow = await Arrow.fromObject(object);

      expect(deserializedArrow.opacity).toBe(0.5);
      expect(deserializedArrow.customProp).toBe('customValue');
    });

    it('should return a Promise', () => {
      const object: SerializedArrowObject = {
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200
      };

      const result = Arrow.fromObject(object);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle missing coordinates', async () => {
      const object: SerializedArrowObject = {};

      const deserializedArrow = await Arrow.fromObject(object);

      expect(deserializedArrow.x1).toBe(0);
      expect(deserializedArrow.y1).toBe(0);
      expect(deserializedArrow.x2).toBe(0);
      expect(deserializedArrow.y2).toBe(0);
    });
  });

  describe('class registration', () => {
    it('should register with classRegistry', async () => {
      const { classRegistry } = await import('fabric');
      const registeredClass = classRegistry.getClass('arrow');
      expect(registeredClass).toBe(Arrow);
    });
  });

  describe('edge cases', () => {
    it('should handle very small headLength', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headLength: 0.1 });
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very large headLength', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headLength: 200 });
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very small headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: 0.01 });
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle very large headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: Math.PI / 2 });
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle large coordinate values', () => {
      const arrow = new Arrow([10000, 10000, 20000, 20000], {});
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(-5000, -5000);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(5000, 5000);
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
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [x1] = lineToCallsForArrowhead[0] as [number, number];
      const [x2] = lineToCallsForArrowhead[1] as [number, number];

      expect(x1).toBe(50);
      expect(x2).toBe(50);
    });

    it('should handle zero headAngle', () => {
      const arrow = new Arrow([0, 0, 100, 0], { headAngle: 0 });
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '#000000',
        fillStyle: '#FF0000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter'
      };

      arrow._render(mockCtx);

      const lineToCallsForArrowhead = mockCtx.lineTo.mock.calls.slice(1);
      const [, y1] = lineToCallsForArrowhead[0] as [number, number];
      const [, y2] = lineToCallsForArrowhead[1] as [number, number];

      expect(y1).toBe(0);
      expect(y2).toBe(0);
    });
  });
});
