import { z } from 'zod';

export const WHITEBOARD_LIMITS = {
  elementsPerUpdate: 100,
  maxDrawings: 5000
};

export const MAX_POINTS_PER_STREAM = 100;

export const WorkspaceIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/);

export const ElementDataSchema = z.object({
  left: z.number().optional(),
  top: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  angle: z.number().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  fill: z.string().optional(),
  path: z.string().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  src: z.string().optional(),
  isDiagram: z.boolean().optional(),
  points: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).optional()
}).strict();

export const WhiteboardElementSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum([
    'rect',
    'circle',
    'triangle',
    'line',
    'arrow',
    'path',
    'text',
    'diagram',
    'polygon',
    'star',
    'diamond',
    'pentagon',
    'hexagon',
    'octagon',
    'cross'
  ]),
  data: ElementDataSchema
});

export const WhiteboardUpdateSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  elements: z.array(WhiteboardElementSchema).max(WHITEBOARD_LIMITS.elementsPerUpdate)
});

export const CursorPositionSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  position: z.object({
    x: z.number().min(-10000).max(100000),
    y: z.number().min(-10000).max(100000)
  }),
  userColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  animalKey: z.string().max(50).optional()
});

export const DrawingStreamSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  drawingId: z.string().min(1).max(100),
  points: z.array(z.object({
    x: z.number(),
    y: z.number()
  })).max(MAX_POINTS_PER_STREAM)
});

export const ShapeTypeSchema = z.enum(['rect', 'circle', 'triangle', 'line', 'arrow', 'polygon']);
