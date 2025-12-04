import { fabric } from 'fabric';

export function getAbsolutePosition(item, group) {
  const groupMatrix = group.calcTransformMatrix();
  const point = fabric.util.transformPoint(
    { x: item.left, y: item.top },
    groupMatrix
  );
  return { left: point.x, top: point.y };
}
