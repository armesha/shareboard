import React, { useState, useEffect, useRef, useCallback } from 'react';

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
];

const SHAPE_TYPES = [
  'rectangle',
  'circle',
  'ellipse',
  'triangle',
  'pentagon',
  'hexagon',
  'octagon',
  'diamond',
  'star',
  'cross',
];

const SHAPE_LIFETIME = 12000;
const FADE_DURATION = 1000;
const SPAWN_INTERVAL = 120;
const INITIAL_SHAPES = 25;
const GRID_COLS = 6;
const GRID_ROWS = 5;

function generatePolygonPoints(cx, cy, radius, sides, startAngle = -Math.PI / 2) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points.map(p => `${p.x},${p.y}`).join(' ');
}

function generateStarPoints(cx, cy, outerRadius, innerRadius, points) {
  const result = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    result.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return result.map(p => `${p.x},${p.y}`).join(' ');
}

function generateCrossPoints(cx, cy, size) {
  const arm = size * 0.3;
  const half = size / 2;
  return [
    `${cx - arm},${cy - half}`,
    `${cx + arm},${cy - half}`,
    `${cx + arm},${cy - arm}`,
    `${cx + half},${cy - arm}`,
    `${cx + half},${cy + arm}`,
    `${cx + arm},${cy + arm}`,
    `${cx + arm},${cy + half}`,
    `${cx - arm},${cy + half}`,
    `${cx - arm},${cy + arm}`,
    `${cx - half},${cy + arm}`,
    `${cx - half},${cy - arm}`,
    `${cx - arm},${cy - arm}`,
  ].join(' ');
}

function DemoShape({ shape }) {
  const { type, x, y, size, color, opacity } = shape;
  const strokeWidth = 2.5;
  const style = {
    opacity,
    transition: `opacity ${FADE_DURATION}ms ease-out`,
  };

  const cx = x;
  const cy = y;
  const half = size / 2;

  switch (type) {
    case 'rectangle':
      return (
        <rect
          x={cx - size * 0.6}
          y={cy - half}
          width={size * 1.2}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          rx={4}
          style={style}
        />
      );

    case 'circle':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={half}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          style={style}
        />
      );

    case 'ellipse':
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={size * 0.7}
          ry={half * 0.6}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          style={style}
        />
      );

    case 'triangle':
      return (
        <polygon
          points={generatePolygonPoints(cx, cy, half, 3)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'pentagon':
      return (
        <polygon
          points={generatePolygonPoints(cx, cy, half, 5)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'hexagon':
      return (
        <polygon
          points={generatePolygonPoints(cx, cy, half, 6)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'octagon':
      return (
        <polygon
          points={generatePolygonPoints(cx, cy, half, 8)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'diamond':
      return (
        <polygon
          points={generatePolygonPoints(cx, cy, half, 4)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'star':
      return (
        <polygon
          points={generateStarPoints(cx, cy, half, half * 0.4, 5)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    case 'cross':
      return (
        <polygon
          points={generateCrossPoints(cx, cy, size)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          style={style}
        />
      );

    default:
      return null;
  }
}

function createRandomShape(id, windowSize, gridIndex = null) {
  const cellWidth = windowSize.width / GRID_COLS;
  const cellHeight = windowSize.height / GRID_ROWS;

  let x, y;
  if (gridIndex !== null) {
    const col = gridIndex % GRID_COLS;
    const row = Math.floor(gridIndex / GRID_COLS) % GRID_ROWS;
    x = col * cellWidth + Math.random() * cellWidth;
    y = row * cellHeight + Math.random() * cellHeight;
  } else {
    const col = Math.floor(Math.random() * GRID_COLS);
    const row = Math.floor(Math.random() * GRID_ROWS);
    x = col * cellWidth + Math.random() * cellWidth;
    y = row * cellHeight + Math.random() * cellHeight;
  }

  return {
    id,
    type: SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)],
    x,
    y,
    size: 45 + Math.random() * 70,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    opacity: 0,
    createdAt: Date.now(),
  };
}

function DemoWhiteboard() {
  const [shapes, setShapes] = useState([]);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  const idCounter = useRef(0);
  const isRunning = useRef(true);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const spawnShape = useCallback(() => {
    if (!isRunning.current) return;

    const newShape = createRandomShape(idCounter.current++, windowSize);
    setShapes(prev => [...prev, newShape]);

    requestAnimationFrame(() => {
      setShapes(prev =>
        prev.map(s => (s.id === newShape.id ? { ...s, opacity: 1 } : s))
      );
    });
  }, [windowSize]);

  useEffect(() => {
    isRunning.current = true;

    const initialShapes = [];
    for (let i = 0; i < INITIAL_SHAPES; i++) {
      initialShapes.push(createRandomShape(idCounter.current++, windowSize, i));
    }
    setShapes(initialShapes);

    requestAnimationFrame(() => {
      setShapes(prev => prev.map(s => ({ ...s, opacity: 1 })));
    });

    const spawnInterval = setInterval(spawnShape, SPAWN_INTERVAL);

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setShapes(prev => {
        const updated = prev.map(shape => {
          const age = now - shape.createdAt;
          if (age > SHAPE_LIFETIME - FADE_DURATION && shape.opacity === 1) {
            return { ...shape, opacity: 0 };
          }
          return shape;
        });
        return updated.filter(shape => now - shape.createdAt < SHAPE_LIFETIME);
      });
    }, 100);

    return () => {
      isRunning.current = false;
      clearInterval(spawnInterval);
      clearInterval(cleanupInterval);
    };
  }, [spawnShape, windowSize]);

  return (
    <div className="demo-background">
      <svg className="demo-svg" width={windowSize.width} height={windowSize.height}>
        {shapes.map(shape => (
          <DemoShape key={shape.id} shape={shape} />
        ))}
      </svg>
      <div className="demo-blur-overlay" />
    </div>
  );
}

export default React.memo(DemoWhiteboard);
