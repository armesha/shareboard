import { useEffect } from 'react';
import type { Canvas, FabricObject } from 'fabric';
import type { Socket } from 'socket.io-client';
import { TOOLS, SOCKET_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';

type ExtendedFabricObject = FabricObject & {
  id?: string;
  modificationTimeout?: ReturnType<typeof setTimeout>;
};

interface UseKeyboardDeleteProps {
  canvas: Canvas | null;
  tool: string;
  socket: Socket | null;
  disabled: boolean;
  batchedRenderRef: React.MutableRefObject<(() => void) | null>;
  modificationTimeoutsRef: React.MutableRefObject<Set<ReturnType<typeof setTimeout>>>;
}

export function useKeyboardDelete({
  canvas,
  tool,
  socket,
  disabled,
  batchedRenderRef,
  modificationTimeoutsRef
}: UseKeyboardDeleteProps) {
  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || e.key !== 'Delete' || tool !== TOOLS.SELECT) return;

      const activeObjects = canvas.getActiveObjects() as ExtendedFabricObject[];
      if (activeObjects.length === 0) return;

      const workspaceId = getWorkspaceId();
      activeObjects.forEach(obj => {
        if (obj.id) {
          if (obj.modificationTimeout && modificationTimeoutsRef.current.has(obj.modificationTimeout)) {
            modificationTimeoutsRef.current.delete(obj.modificationTimeout);
            clearTimeout(obj.modificationTimeout);
            obj.modificationTimeout = undefined;
          }
          canvas.remove(obj);
          socket?.emit(SOCKET_EVENTS.DELETE_ELEMENT, { workspaceId, elementId: obj.id });
        }
      });

      canvas.discardActiveObject();
      if (batchedRenderRef.current) {
        batchedRenderRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, tool, socket, disabled, batchedRenderRef, modificationTimeoutsRef]);
}
