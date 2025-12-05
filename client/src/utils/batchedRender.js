/**
 * Batched render utility for Fabric.js canvas
 * Coalesces multiple render requests into a single render call using requestAnimationFrame
 */

const canvasRenderQueues = new WeakMap();

/**
 * Creates a batched render function for a canvas that defers and coalesces
 * multiple render requests into a single render call on the next animation frame.
 *
 * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
 * @returns {Function} A function that queues a render request
 */
export function createBatchedRender(canvas) {
  if (!canvas) {
    return () => {};
  }

  // Check if we already have a queue for this canvas
  let queue = canvasRenderQueues.get(canvas);

  if (!queue) {
    queue = {
      pending: false,
      frameId: null
    };
    canvasRenderQueues.set(canvas, queue);
  }

  return function batchedRequestRenderAll() {
    // If a render is already scheduled, don't schedule another
    if (queue.pending) {
      return;
    }

    queue.pending = true;

    // Schedule render on next animation frame
    queue.frameId = requestAnimationFrame(() => {
      queue.pending = false;
      queue.frameId = null;

      // Only render if canvas still exists and is not disposed
      if (canvas && canvas.requestRenderAll) {
        canvas.requestRenderAll();
      }
    });
  };
}

/**
 * Cancels any pending batched render for a canvas
 * Useful for cleanup when disposing canvas
 *
 * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
 */
export function cancelBatchedRender(canvas) {
  const queue = canvasRenderQueues.get(canvas);

  if (queue && queue.frameId !== null) {
    cancelAnimationFrame(queue.frameId);
    queue.pending = false;
    queue.frameId = null;
  }

  canvasRenderQueues.delete(canvas);
}

/**
 * Forces an immediate render, bypassing the batching mechanism
 * Use sparingly, only when immediate visual feedback is critical
 *
 * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
 */
export function forceImmediateRender(canvas) {
  if (!canvas || !canvas.requestRenderAll) {
    return;
  }

  // Cancel any pending batched render
  const queue = canvasRenderQueues.get(canvas);
  if (queue && queue.frameId !== null) {
    cancelAnimationFrame(queue.frameId);
    queue.pending = false;
    queue.frameId = null;
  }

  // Render immediately
  canvas.requestRenderAll();
}
