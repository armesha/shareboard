import { SHAPES, SHAPE_GEOMETRY } from '../constants';

interface Point {
  x: number;
  y: number;
}

interface ShapeUpdateParams {
  startX: number;
  startY: number;
  deltaWidth: number;
  deltaHeight: number;
  isCtrlPressed?: boolean;
}

interface ShapeUpdateResult {
  props?: Record<string, unknown>;
  points?: Point[];
}

function calculateRadius(deltaWidth: number, deltaHeight: number): number {
  return Math.sqrt(deltaWidth * deltaWidth + deltaHeight * deltaHeight) / 2;
}

function createRegularPolygon(sides: number, center: Point, radius: number): Point[] {
  const points: Point[] = [];
  const angleOffset = Math.PI / 2;
  const angleStep = (2 * Math.PI) / sides;

  for (let i = 0; i < sides; i++) {
    const angle = angleOffset + i * angleStep;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y - radius * Math.sin(angle)
    });
  }

  return points;
}

const shapeCalculators: Record<string, (params: ShapeUpdateParams) => ShapeUpdateResult> = {
  [SHAPES.RECTANGLE]: ({ startX, startY, deltaWidth, deltaHeight, isCtrlPressed }) => {
    if (isCtrlPressed) {
      const size = Math.max(Math.abs(deltaWidth), Math.abs(deltaHeight));
      return {
        props: {
          width: size,
          height: size,
          left: deltaWidth > 0 ? startX : startX - size,
          top: deltaHeight > 0 ? startY : startY - size
        }
      };
    }
    return {
      props: {
        width: Math.abs(deltaWidth),
        height: Math.abs(deltaHeight),
        left: deltaWidth > 0 ? startX : startX + deltaWidth,
        top: deltaHeight > 0 ? startY : startY + deltaHeight
      }
    };
  },

  [SHAPES.CIRCLE]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const radius = calculateRadius(deltaWidth, deltaHeight);
    return {
      props: {
        radius,
        left: startX - radius,
        top: startY - radius
      }
    };
  },

  [SHAPES.ELLIPSE]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const rx = Math.abs(deltaWidth) / 2;
    const ry = Math.abs(deltaHeight) / 2;
    return {
      props: {
        rx,
        ry,
        left: deltaWidth > 0 ? startX : startX - rx * 2,
        top: deltaHeight > 0 ? startY : startY - ry * 2
      }
    };
  },

  [SHAPES.TRIANGLE]: ({ startX, startY, deltaWidth, deltaHeight, isCtrlPressed }) => {
    const isUpsideDown = deltaHeight < 0;
    let triWidth = Math.abs(deltaWidth) || 1;
    let triHeight = Math.abs(deltaHeight) || 1;

    if (isCtrlPressed) {
      const size = Math.max(triWidth, triHeight);
      triWidth = size;
      triHeight = size;
    }

    const halfWidth = triWidth / 2;
    const points: Point[] = isUpsideDown
      ? [
          { x: startX, y: startY },
          { x: startX - halfWidth, y: startY - triHeight },
          { x: startX + halfWidth, y: startY - triHeight }
        ]
      : [
          { x: startX, y: startY },
          { x: startX - halfWidth, y: startY + triHeight },
          { x: startX + halfWidth, y: startY + triHeight }
        ];

    return { points };
  },

  [SHAPES.STAR]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const outerRadius = calculateRadius(deltaWidth, deltaHeight);
    const innerRadius = outerRadius * SHAPE_GEOMETRY.STAR.INNER_RADIUS_RATIO;
    const points: Point[] = [];

    for (let i = 0; i < SHAPE_GEOMETRY.STAR.POINTS; i++) {
      const angle = SHAPE_GEOMETRY.STAR.ANGLE_START + i * SHAPE_GEOMETRY.STAR.ANGLE_STEP;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      points.push({
        x: startX + r * Math.cos(angle),
        y: startY - r * Math.sin(angle)
      });
    }

    return { points };
  },

  [SHAPES.DIAMOND]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const radius = calculateRadius(deltaWidth, deltaHeight);
    return {
      points: [
        { x: startX, y: startY - radius },
        { x: startX + radius, y: startY },
        { x: startX, y: startY + radius },
        { x: startX - radius, y: startY }
      ]
    };
  },

  [SHAPES.PENTAGON]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const radius = calculateRadius(deltaWidth, deltaHeight);
    return { points: createRegularPolygon(SHAPE_GEOMETRY.PENTAGON.SIDES, { x: startX, y: startY }, radius) };
  },

  [SHAPES.HEXAGON]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const radius = calculateRadius(deltaWidth, deltaHeight);
    return { points: createRegularPolygon(SHAPE_GEOMETRY.HEXAGON.SIDES, { x: startX, y: startY }, radius) };
  },

  [SHAPES.OCTAGON]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const radius = calculateRadius(deltaWidth, deltaHeight);
    return { points: createRegularPolygon(SHAPE_GEOMETRY.OCTAGON.SIDES, { x: startX, y: startY }, radius) };
  },

  [SHAPES.CROSS]: ({ startX, startY, deltaWidth, deltaHeight }) => {
    const size = calculateRadius(deltaWidth, deltaHeight);
    const armWidth = size / SHAPE_GEOMETRY.CROSS.ARM_WIDTH_DIVISOR;

    return {
      points: [
        { x: startX - armWidth, y: startY - size },
        { x: startX + armWidth, y: startY - size },
        { x: startX + armWidth, y: startY - armWidth },
        { x: startX + size, y: startY - armWidth },
        { x: startX + size, y: startY + armWidth },
        { x: startX + armWidth, y: startY + armWidth },
        { x: startX + armWidth, y: startY + size },
        { x: startX - armWidth, y: startY + size },
        { x: startX - armWidth, y: startY + armWidth },
        { x: startX - size, y: startY + armWidth },
        { x: startX - size, y: startY - armWidth },
        { x: startX - armWidth, y: startY - armWidth }
      ]
    };
  }
};

export function calculateShapeUpdate(
  shapeType: string,
  params: ShapeUpdateParams
): ShapeUpdateResult | null {
  const calculator = shapeCalculators[shapeType];
  return calculator ? calculator(params) : null;
}
