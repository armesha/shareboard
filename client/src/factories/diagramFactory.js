import { fabric } from 'fabric';
import { DEFAULT_COLORS } from '../constants';

export function loadDiagramToCanvas(canvas, element, isSelectable = true) {
  if (!element.data || !element.data.src) return;

  const existsOnCanvas = canvas.getObjects().some(o => o.id === element.id);
  if (existsOnCanvas) return;

  fabric.Image.fromURL(element.data.src, (fabricImage) => {
    if (!fabricImage) return;

    if (canvas.getObjects().some(o => o.id === element.id)) return;

    fabricImage.set({
      id: element.id,
      left: element.data.left || 50,
      top: element.data.top || 50,
      scaleX: element.data.scaleX || 0.5,
      scaleY: element.data.scaleY || 0.5,
      angle: element.data.angle || 0,
      selectable: isSelectable,
      hasControls: isSelectable,
      hasBorders: isSelectable,
      evented: isSelectable,
      cornerColor: DEFAULT_COLORS.SELECTION,
      borderColor: DEFAULT_COLORS.SELECTION_BORDER,
      cornerSize: 8,
      padding: 10,
      data: { ...element.data, isDiagram: true }
    });
    fabricImage.type = 'diagram';

    canvas.add(fabricImage);
    fabricImage.bringToFront();
    canvas.requestRenderAll();
  }, { crossOrigin: 'anonymous' });
}
