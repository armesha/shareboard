import { type FabricObject } from 'fabric';

export function getAbsolutePosition(item: FabricObject): { left: number; top: number } {
  const matrix = item.calcTransformMatrix();
  const centerX = matrix[4];
  const centerY = matrix[5];
  const scaleX = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1]);
  const scaleY = Math.sqrt(matrix[2] * matrix[2] + matrix[3] * matrix[3]);

  return {
    left: centerX - (item.width * scaleX) / 2,
    top: centerY - (item.height * scaleY) / 2
  };
}
