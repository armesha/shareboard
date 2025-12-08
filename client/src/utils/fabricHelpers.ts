import { util, type FabricObject, type Group } from 'fabric';

export function getAbsolutePosition(item: FabricObject, group: Group): { left: number; top: number } {
  const groupMatrix = group.calcTransformMatrix();
  const point = util.transformPoint(
    { x: item.left ?? 0, y: item.top ?? 0 },
    groupMatrix
  );
  return { left: point.x, top: point.y };
}
