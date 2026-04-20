import type { Path, FabricObject } from 'fabric';

interface Point {
  x: number;
  y: number;
}

export interface DrawingData {
  fabricPath: (Path & { _drawingId?: string }) | null;
  fabricShape?: (FabricObject & { _shapeId?: string }) | null;
  points: Point[];
  color: string;
  brushWidth: number;
  userId?: string;
  shapeType?: string;
}
