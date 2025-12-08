import { FabricImage, type Canvas } from 'fabric';
import { DEFAULT_COLORS } from '../constants';

interface DiagramElement {
  id: string;
  data: {
    src?: string;
    left?: number;
    top?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    isDiagram?: boolean;
  };
}

export async function loadDiagramToCanvas(
  canvas: Canvas,
  element: DiagramElement,
  isSelectable = true
): Promise<void> {
  if (!element.data || !element.data.src) return;

  const existsOnCanvas = canvas.getObjects().some((o) => (o as { id?: string }).id === element.id);
  if (existsOnCanvas) return;

  try {
    const fabricImage = await FabricImage.fromURL(element.data.src, { crossOrigin: 'anonymous' });
    if (!fabricImage) return;

    if (canvas.getObjects().some((o) => (o as { id?: string }).id === element.id)) return;

    fabricImage.set({
      left: element.data.left ?? 50,
      top: element.data.top ?? 50,
      scaleX: element.data.scaleX ?? 0.5,
      scaleY: element.data.scaleY ?? 0.5,
      angle: element.data.angle ?? 0,
      selectable: isSelectable,
      hasControls: isSelectable,
      hasBorders: isSelectable,
      evented: isSelectable,
      cornerColor: DEFAULT_COLORS.SELECTION,
      borderColor: DEFAULT_COLORS.SELECTION_BORDER,
      cornerSize: 8,
      padding: 10,
    });

    fabricImage.set('id' as keyof typeof fabricImage, element.id);
    fabricImage.set('data' as keyof typeof fabricImage, { ...element.data, isDiagram: true });

    canvas.add(fabricImage);
    canvas.bringObjectToFront(fabricImage);
    canvas.requestRenderAll();
  } catch (error) {
    console.error('Failed to load diagram:', element.id, error);
  }
}
