import { useEffect, useRef } from 'react';
import type { Canvas, FabricObject, Group } from 'fabric';
import { FABRIC_EVENTS, TIMING, POLYGON_SHAPE_TYPES } from '../constants';
import { getAbsolutePosition } from '../utils/fabricHelpers';

type ExtendedFabricObject = FabricObject & {
  id?: string;
  data?: { isDiagram?: boolean; shapeType?: string };
  originalState?: { left?: number; top?: number };
  modificationTimeout?: ReturnType<typeof setTimeout>;
  text?: string;
  fontSize?: number;
  rx?: number;
  ry?: number;
  points?: { x: number; y: number }[];
  headLength?: number;
  headAngle?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  radius?: number;
};

interface ActiveSelection extends FabricObject {
  getObjects: () => ExtendedFabricObject[];
}

interface UseObjectModificationProps {
  canvas: Canvas | null;
  updateElement: (id: string, element: { id: string; type: string; data: Record<string, unknown> }) => void;
  disabled: boolean;
  batchedRenderRef: React.MutableRefObject<(() => void) | null>;
  isUpdatingRef: React.MutableRefObject<boolean>;
}

export function useObjectModification({
  canvas,
  updateElement,
  disabled,
  batchedRenderRef,
  isUpdatingRef
}: UseObjectModificationProps) {
  const modificationTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (!canvas) return;

    const timeoutsSet = modificationTimeoutsRef.current;

    const handleObjectModification = (e: { target?: ExtendedFabricObject | null }) => {
      if (disabled) {
        if (e.target?.originalState) {
          e.target.set(e.target.originalState);
          if (batchedRenderRef.current) {
            batchedRenderRef.current();
          }
        }
        return;
      }

      const obj = e.target as ExtendedFabricObject | null;
      if (!obj || isUpdatingRef.current) return;

      if (obj.type === 'diagram' || (obj.type === 'image' && obj.data?.isDiagram)) {
        obj.lockMovementX = false;
        obj.lockMovementY = false;
      }

      const isActiveSelection = obj.type === 'activeSelection';
      const objectsToUpdate = isActiveSelection ? (obj as unknown as ActiveSelection).getObjects() : [obj];

      objectsToUpdate.forEach(item => {
        if (!item.id) return;

        if (item.modificationTimeout) {
          modificationTimeoutsRef.current.delete(item.modificationTimeout);
          clearTimeout(item.modificationTimeout);
        }

        let absoluteLeft = item.left ?? 0;
        let absoluteTop = item.top ?? 0;

        if (isActiveSelection) {
          const absPos = getAbsolutePosition(item, obj as unknown as Group);
          absoluteLeft = absPos.left;
          absoluteTop = absPos.top;
        }

        const capturedLeft = absoluteLeft;
        const capturedTop = absoluteTop;

        const timeoutId = setTimeout(() => {
          modificationTimeoutsRef.current.delete(timeoutId);
          (canvas as Canvas & { suspendDrawing?: boolean }).suspendDrawing = true;

          try {
            updateElementByType(item, capturedLeft, capturedTop, updateElement);
          } finally {
            (canvas as Canvas & { suspendDrawing?: boolean }).suspendDrawing = false;
            if (batchedRenderRef.current) {
              batchedRenderRef.current();
            }
          }
        }, TIMING.MOVEMENT_TIMEOUT);
        item.modificationTimeout = timeoutId;
        modificationTimeoutsRef.current.add(timeoutId);
      });
    };

    canvas.on(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification as (e: unknown) => void);
    canvas.on(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification as (e: unknown) => void);

    return () => {
      canvas.off(FABRIC_EVENTS.OBJECT_MODIFIED, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_MOVING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_SCALING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.OBJECT_ROTATING, handleObjectModification as (e: unknown) => void);
      canvas.off(FABRIC_EVENTS.TEXT_CHANGED, handleObjectModification as (e: unknown) => void);
      timeoutsSet.forEach(clearTimeout);
      timeoutsSet.clear();
    };
  }, [canvas, updateElement, disabled, batchedRenderRef, isUpdatingRef]);

  return { modificationTimeoutsRef };
}

function updateElementByType(
  item: ExtendedFabricObject,
  left: number,
  top: number,
  updateElement: (id: string, element: { id: string; type: string; data: Record<string, unknown> }) => void
) {
  if (!item.id) return;

  const baseData = {
    left,
    top,
    scaleX: item.scaleX,
    scaleY: item.scaleY,
    angle: item.angle
  };

  if (item.data?.isDiagram) {
    updateElement(item.id, { id: item.id, type: 'diagram', data: { ...item.data, ...baseData } });
  } else if (item.type === 'text' || item.type === 'i-text') {
    updateElement(item.id, { id: item.id, type: 'text', data: { text: item.text, fontSize: item.fontSize, fill: item.fill, ...baseData } });
  } else if (item.type === 'path') {
    updateElement(item.id, { id: item.id, type: 'path', data: { path: (item as unknown as { path: unknown }).path, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, strokeLineCap: item.strokeLineCap, strokeLineJoin: item.strokeLineJoin, ...baseData } });
  } else if (item.type === 'line' || item.type === 'arrow') {
    updateElement(item.id, { id: item.id, type: item.type, data: { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, stroke: item.stroke, strokeWidth: item.strokeWidth, strokeLineCap: item.strokeLineCap, headLength: item.headLength, headAngle: item.headAngle, ...baseData } });
  } else if (item.type === 'circle') {
    updateElement(item.id, { id: item.id, type: 'circle', data: { radius: item.radius, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, strokeUniform: item.strokeUniform, ...baseData } });
  } else if (item.type === 'rect') {
    updateElement(item.id, { id: item.id, type: 'rect', data: { width: item.width, height: item.height, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, strokeUniform: item.strokeUniform, ...baseData } });
  } else if (item.type === 'ellipse') {
    updateElement(item.id, { id: item.id, type: 'ellipse', data: { rx: item.rx, ry: item.ry, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, strokeUniform: item.strokeUniform, ...baseData } });
  } else if (item.data?.shapeType && (POLYGON_SHAPE_TYPES as readonly string[]).includes(item.data.shapeType)) {
    updateElement(item.id, { id: item.id, type: item.data.shapeType, data: { points: item.points, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, strokeUniform: item.strokeUniform, strokeLineJoin: item.strokeLineJoin, strokeLineCap: item.strokeLineCap, ...baseData } });
  } else {
    updateElement(item.id, { id: item.id, type: item.type, data: { width: item.width, height: item.height, stroke: item.stroke, strokeWidth: item.strokeWidth, fill: item.fill, ...baseData } });
  }
}
