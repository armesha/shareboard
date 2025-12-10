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
    it('initializes with defaults and custom options', () => {
      const arrow = new Arrow([10, 20, 100, 200], {});
      expect(arrow.headLength).toBe(ARROW.HEAD_LENGTH);
      expect(arrow.headAngle).toBe(ARROW.HEAD_ANGLE);
      expect(arrow.type).toBe('arrow');

      const customArrow = new Arrow([10, 20, 100, 200], { headLength: 30, headAngle: Math.PI / 3, stroke: '#FF0000', strokeWidth: 3 });
      expect(customArrow.headLength).toBe(30);
      expect(customArrow.headAngle).toBe(Math.PI / 3);
      expect(customArrow.stroke).toBe('#FF0000');

      expect(Arrow.type).toBe('Arrow');
      expect(Arrow.cacheProperties).toContain('headLength');
    });
  });

  describe('_render', () => {
    it('renders arrow with correct context calls and coordinates', () => {
      const mockCtx: MockCanvasRenderingContext2D = {
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        strokeStyle: '#000000', fillStyle: '#FF0000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter'
      };

      const arrow = new Arrow([0, 0, 100, 0], { stroke: '#0000FF', strokeWidth: 2, strokeLineCap: 'round' });
      arrow._render(mockCtx);

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);
      expect(mockCtx.moveTo).toHaveBeenCalledWith(-50, 0);
      expect(mockCtx.lineTo).toHaveBeenCalledWith(50, 0);
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(3);
      expect(mockCtx.lineWidth).toBe(2);
      expect(mockCtx.lineCap).toBe('round');
      expect(mockCtx.lineJoin).toBe('miter');
      expect(mockCtx.stroke).toHaveBeenCalledTimes(1);

      const customArrow = new Arrow([0, 0, 100, 0], { headLength: 30 });
      mockCtx.lineTo = vi.fn();
      customArrow._render(mockCtx);
      const [x1] = (mockCtx.lineTo.mock.calls[1] as [number, number]);
      expect(50 - x1).toBeCloseTo(30 * Math.cos(ARROW.HEAD_ANGLE), 1);
    });
  });

  describe('toObject and fromObject', () => {
    it('serializes and deserializes arrows', async () => {
      const arrow = new Arrow([10, 20, 100, 200], { headLength: 25, headAngle: Math.PI / 4, stroke: '#FF0000', strokeWidth: 3 });
      const obj = arrow.toObject();

      expect(obj.headLength).toBe(25);
      expect(obj.headAngle).toBe(Math.PI / 4);
      expect(obj.type).toBe('arrow');
      expect(obj.x1).toBe(10);

      const deserialized = await Arrow.fromObject({ x1: 50, y1: 60, x2: 150, y2: 160, headLength: 20, opacity: 0.5 });
      expect(deserialized.headLength).toBe(20);
      expect(deserialized.opacity).toBe(0.5);
      expect(Arrow.fromObject({})).toBeInstanceOf(Promise);

      const { classRegistry } = await import('fabric');
      expect(classRegistry.getClass('arrow')).toBe(Arrow);
    });
  });
});
