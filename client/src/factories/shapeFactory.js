import { fabric } from 'fabric';
import { SHAPES } from '../constants';

const getCommonShapeProps = (props) => ({
  fill: 'transparent',
  stroke: props.stroke || '#000000',
  strokeWidth: props.strokeWidth || 2,
  strokeUniform: true,
  objectCaching: true,
  ...props,
});

const getPolygonProps = (props) => ({
  ...getCommonShapeProps(props),
  strokeLineJoin: 'round',
  strokeLineCap: 'round',
});

export const polygonPointGenerators = {
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
    const points = [];
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

const createPolygonShape = (shapeType, props) => {
  const initialPoints = getInitialPolygonPoints(shapeType);
  const shape = new fabric.Polygon(initialPoints, getPolygonProps(props));
  shape.type = shapeType;
  return shape;
};

const getInitialPolygonPoints = (shapeType) => {
  const pointCounts = {
    triangle: 3,
    diamond: 4,
    pentagon: 5,
    hexagon: 6,
    octagon: 8,
    star: 10,
    cross: 12,
  };
  const count = pointCounts[shapeType] || 3;
  return Array(count).fill({ x: 0, y: 0 });
};

const shapeCreators = {
  [SHAPES.RECTANGLE]: (props) => new fabric.Rect(getCommonShapeProps({
    ...props,
    width: 0,
    height: 0,
  })),

  [SHAPES.CIRCLE]: (props) => new fabric.Circle(getCommonShapeProps({
    ...props,
    radius: 0,
  })),

  [SHAPES.ELLIPSE]: (props) => new fabric.Ellipse(getCommonShapeProps({
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

const createPolygonFromData = (type, data) => {
  const obj = new fabric.Polygon(data.points, {
    ...data,
    strokeLineJoin: 'round',
    strokeLineCap: 'round',
    strokeUniform: true,
  });
  obj.type = type;
  return obj;
};

const shapeFromDataCreators = {
  rect: (data) => new fabric.Rect(data),
  circle: (data) => new fabric.Circle(data),
  ellipse: (data) => new fabric.Ellipse(data),
  triangle: (data) => data.points ? createPolygonFromData('triangle', data) : new fabric.Triangle(data),
  star: (data) => createPolygonFromData('star', data),
  diamond: (data) => createPolygonFromData('diamond', data),
  pentagon: (data) => createPolygonFromData('pentagon', data),
  hexagon: (data) => createPolygonFromData('hexagon', data),
  octagon: (data) => createPolygonFromData('octagon', data),
  cross: (data) => createPolygonFromData('cross', data),
};

export function createShape(shapeType, props) {
  const creator = shapeCreators[shapeType];
  if (!creator) {
    return null;
  }
  return creator(props);
}

export function createShapeFromData(type, data) {
  const creator = shapeFromDataCreators[type];
  if (!creator) {
    return null;
  }
  return creator(data);
}

export function isPolygonShape(shapeType) {
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
