import type { Path, FabricObject } from 'fabric';
import type { PerfectCursor } from 'perfect-cursors';

interface Point {
  x: number;
  y: number;
}

export interface DrawingData {
  fabricPath: (Path & { _isRemoteDrawing?: boolean; _drawingId?: string }) | null;
  fabricShape?: (FabricObject & { _isRemoteShape?: boolean; _shapeId?: string }) | null;
  points: Point[];
  color: string;
  brushWidth: number;
  userId?: string;
  shapeType?: string;
  interpolator?: PerfectCursor;
}
