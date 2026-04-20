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

