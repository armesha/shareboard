import type { Canvas } from 'fabric';
import { CANVAS } from '../constants';

export interface CanvasImageData {
  dataUrl: string;
  width: number;
  height: number;
  objectsBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}

export function getFullCanvasImage(canvas: Canvas | null): CanvasImageData | null {
  if (!canvas) return null;

  const multiplier = CANVAS.EXPORT_MULTIPLIER;
  const vpt = canvas.viewportTransform;
  if (!vpt) return null;

  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();

  const viewportLeft = -vpt[4]! / vpt[0]!;
  const viewportTop = -vpt[5]! / vpt[3]!;
  const viewportWidth = canvasWidth / vpt[0]!;
  const viewportHeight = canvasHeight / vpt[3]!;

  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier,
    left: viewportLeft,
    top: viewportTop,
    width: viewportWidth,
    height: viewportHeight
  });

  const objects = canvas.getObjects();
  let objectsBounds: CanvasImageData['objectsBounds'] = null;

  if (objects.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objects.forEach(obj => {
      obj.setCoords();
      const aCoords = obj.aCoords;
      if (aCoords) {
        const corners = [aCoords.tl, aCoords.tr, aCoords.br, aCoords.bl];
        corners.forEach(corner => {
          if (corner.x < minX) minX = corner.x;
          if (corner.y < minY) minY = corner.y;
          if (corner.x > maxX) maxX = corner.x;
          if (corner.y > maxY) maxY = corner.y;
        });
      }
    });

    if (minX !== Infinity) {
      const padding = CANVAS.EXPORT_PADDING;
      const boundsLeft = Math.max(0, (minX - viewportLeft - padding)) * multiplier;
      const boundsTop = Math.max(0, (minY - viewportTop - padding)) * multiplier;
      const boundsRight = Math.min(viewportWidth, maxX - viewportLeft + padding) * multiplier;
      const boundsBottom = Math.min(viewportHeight, maxY - viewportTop + padding) * multiplier;

      objectsBounds = {
        left: boundsLeft,
        top: boundsTop,
        width: Math.max(0, boundsRight - boundsLeft),
        height: Math.max(0, boundsBottom - boundsTop)
      };
    }
  }

  return {
    dataUrl,
    width: viewportWidth * multiplier,
    height: viewportHeight * multiplier,
    objectsBounds
  };
}
