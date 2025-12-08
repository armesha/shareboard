import { Rect, Circle, Ellipse, Polygon, Triangle, type FabricObject } from 'fabric';
import { SHAPES } from '../constants';

interface Point {
  x: number;
  y: number;
}

interface ShapeProps {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  radius?: number;
  rx?: number;
  ry?: number;
  points?: Point[];
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  strokeUniform?: boolean;
  strokeLineJoin?: CanvasLineJoin;
  strokeLineCap?: CanvasLineCap;
  objectCaching?: boolean;
}

const getCommonShapeProps = (props: ShapeProps): ShapeProps => ({
  fill: 'transparent',
  stroke: props.stroke ?? '#000000',
  strokeWidth: props.strokeWidth ?? 2,
  strokeUniform: true,
  objectCaching: true,
  ...props,
});

const getPolygonProps = (props: ShapeProps): ShapeProps => ({
  ...getCommonShapeProps(props),
  strokeLineJoin: 'round',
  strokeLineCap: 'round',
});

export const polygonPointGenerators: Record<string, (w: number, h: number) => Point[]> = {
  triangle: (w, h) => [
    { x: w / 2, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
  diamond: (w, h) => [
    { x: w / 2, y: 0 },
    { x: w, y: h / 2 },
    { x: w / 2, y: h },
    { x: 0, y: h / 2 },
  ],
  pentagon: (w, h) => {
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2;
    return Array.from({ length: 5 }, (_, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  },
  hexagon: (w, h) => {
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2;
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  },
  octagon: (w, h) => {
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2;
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i * Math.PI) / 4 - Math.PI / 8;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  },
  star: (w, h) => {
    const cx = w / 2, cy = h / 2;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.4;
    const points: Point[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return points;
  },
  cross: (w, h) => {
    const size = Math.min(w, h) / 2;
    const armWidth = size / 3;
    const cx = w / 2, cy = h / 2;
    return [
      { x: cx - armWidth, y: cy - size },
      { x: cx + armWidth, y: cy - size },
      { x: cx + armWidth, y: cy - armWidth },
      { x: cx + size, y: cy - armWidth },
      { x: cx + size, y: cy + armWidth },
      { x: cx + armWidth, y: cy + armWidth },
      { x: cx + armWidth, y: cy + size },
      { x: cx - armWidth, y: cy + size },
      { x: cx - armWidth, y: cy + armWidth },
      { x: cx - size, y: cy + armWidth },
      { x: cx - size, y: cy - armWidth },
      { x: cx - armWidth, y: cy - armWidth },
    ];
  },
};

const getInitialPolygonPoints = (shapeType: string): Point[] => {
  const pointCounts: Record<string, number> = {
    triangle: 3,
    diamond: 4,
    pentagon: 5,
    hexagon: 6,
    octagon: 8,
    star: 10,
    cross: 12,
  };
  const count = pointCounts[shapeType] ?? 3;
  return Array(count).fill({ x: 0, y: 0 }) as Point[];
};

interface ExtendedFabricObject extends FabricObject {
  data?: { shapeType?: string };
}

const createPolygonShape = (shapeType: string, props: ShapeProps): FabricObject => {
  const initialPoints = getInitialPolygonPoints(shapeType);
  const shape = new Polygon(initialPoints, getPolygonProps(props)) as ExtendedFabricObject;
  shape.data = { shapeType };
  return shape;
};

type ShapeCreator = (props: ShapeProps) => FabricObject;

const shapeCreators: Record<string, ShapeCreator> = {
  [SHAPES.RECTANGLE]: (props) => new Rect(getCommonShapeProps({
    ...props,
    width: 0,
    height: 0,
  })),

  [SHAPES.CIRCLE]: (props) => new Circle(getCommonShapeProps({
    ...props,
    radius: 0,
  })),

  [SHAPES.ELLIPSE]: (props) => new Ellipse(getCommonShapeProps({
    ...props,
    rx: 0,
    ry: 0,
  })),

  [SHAPES.TRIANGLE]: (props) => createPolygonShape('triangle', props),
  [SHAPES.STAR]: (props) => createPolygonShape('star', props),
  [SHAPES.DIAMOND]: (props) => createPolygonShape('diamond', props),
  [SHAPES.PENTAGON]: (props) => createPolygonShape('pentagon', props),
  [SHAPES.HEXAGON]: (props) => createPolygonShape('hexagon', props),
  [SHAPES.OCTAGON]: (props) => createPolygonShape('octagon', props),
  [SHAPES.CROSS]: (props) => createPolygonShape('cross', props),
};

const createPolygonFromData = (shapeType: string, data: ShapeProps): FabricObject => {
  const obj = new Polygon(data.points ?? [], {
    ...data,
    strokeLineJoin: 'round',
    strokeLineCap: 'round',
    strokeUniform: true,
  }) as ExtendedFabricObject;
  obj.data = { ...obj.data, shapeType };
  return obj;
};

const shapeFromDataCreators: Record<string, (data: ShapeProps) => FabricObject> = {
  rect: (data) => new Rect(data),
  circle: (data) => new Circle(data),
  ellipse: (data) => new Ellipse(data),
  triangle: (data) => data.points ? createPolygonFromData('triangle', data) : new Triangle(data),
  star: (data) => createPolygonFromData('star', data),
  diamond: (data) => createPolygonFromData('diamond', data),
  pentagon: (data) => createPolygonFromData('pentagon', data),
  hexagon: (data) => createPolygonFromData('hexagon', data),
  octagon: (data) => createPolygonFromData('octagon', data),
  cross: (data) => createPolygonFromData('cross', data),
  polygon: (data) => new Polygon(data.points ?? [], data),
};

export function createShape(shapeType: string, props: ShapeProps): FabricObject | null {
  const creator = shapeCreators[shapeType];
  if (!creator) {
    return null;
  }
  return creator(props);
}

export function createShapeFromData(type: string, data: ShapeProps): FabricObject | null {
  const creator = shapeFromDataCreators[type];
  if (!creator) {
    return null;
  }
  return creator(data);
}

export function isPolygonShape(shapeType: string): boolean {
  return shapeType in polygonPointGenerators;
}

export const POLYGON_SHAPES = [
  SHAPES.TRIANGLE,
  SHAPES.STAR,
  SHAPES.DIAMOND,
  SHAPES.PENTAGON,
  SHAPES.HEXAGON,
  SHAPES.OCTAGON,
  SHAPES.CROSS,
];
