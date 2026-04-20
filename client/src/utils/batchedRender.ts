import type { Canvas as FabricCanvas } from 'fabric';

interface RenderQueue {
  pending: boolean;
  frameId: number | null;
}

const canvasRenderQueues = new WeakMap<FabricCanvas, RenderQueue>();

export function createBatchedRender(canvas: FabricCanvas | null): () => void {
  if (!canvas) {
    return () => {};
  }

  let queue = canvasRenderQueues.get(canvas);

  if (!queue) {
    queue = {
      pending: false,
      frameId: null
    };
    canvasRenderQueues.set(canvas, queue);
  }

  const capturedQueue = queue;

  return function batchedRequestRenderAll(): void {
    if (capturedQueue.pending) {
      return;
    }

    capturedQueue.pending = true;

    capturedQueue.frameId = requestAnimationFrame(() => {
      capturedQueue.pending = false;
      capturedQueue.frameId = null;

      if (canvas && canvas.requestRenderAll) {
        canvas.requestRenderAll();
      }
    });
  };
}

export function cancelBatchedRender(canvas: FabricCanvas): void {
  const queue = canvasRenderQueues.get(canvas);

  if (queue && queue.frameId !== null) {
    cancelAnimationFrame(queue.frameId);
    queue.pending = false;
    queue.frameId = null;
  }

  canvasRenderQueues.delete(canvas);
}
