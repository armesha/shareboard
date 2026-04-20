import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import { type Canvas, type FabricObject } from 'fabric';
import { SOCKET_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';
import { loadDiagramToCanvas } from '../factories/diagramFactory';
import { createBatchedRender } from '../utils/batchedRender';
import type { Socket } from 'socket.io-client';

interface Element {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface WorkspaceState {
  whiteboardElements: Element[];
  activeUsers: number;
}

interface DeleteElementEvent {
  workspaceId: string;
  elementId: string;
}

interface UserEvent {
  activeUsers: number;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseWhiteboardSyncReturn {
  isConnected: boolean;
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  activeUsers: number;
}

type FabricObjectWithId = FabricObject & { id?: string };

export function useWhiteboardSync(
  socket: Socket | null,
  canvasRef: MutableRefObject<Canvas | null>,
  elementsMapRef: MutableRefObject<Map<string, Element>>,
  isUpdatingRef: MutableRefObject<boolean>,
  createFabricObject: (element: Element) => FabricObject | null,
  canWrite: (() => boolean) | null
): UseWhiteboardSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [activeUsers, setActiveUsers] = useState(0);
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());

  const handleWhiteboardUpdate = useCallback((serverElements: Element[]) => {
    if (!serverElements || !Array.isArray(serverElements) || serverElements.length === 0) {
      return;
    }

    if (isUpdatingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);
    const hasWritePermission = canWrite && canWrite();

    isUpdatingRef.current = true;
    (canvas as unknown as { suspendDrawing: boolean }).suspendDrawing = true;

    try {
      serverElements.forEach(element => {
        if (!element || !element.id) return;

        const isDiagram = element.type === 'diagram' || (element.data as { isDiagram?: boolean })?.isDiagram;
        if (isDiagram) {
          let existingObject = objectMapRef.current.get(element.id);

          if (!existingObject) {
            existingObject = canvas.getObjects().find((o: FabricObjectWithId) => o.id === element.id) ?? undefined;
            if (existingObject) {
              objectMapRef.current.set(element.id, existingObject);
            }
          }

          if (existingObject) {
            existingObject.set({
              left: (element.data.left as number) ?? existingObject.left,
              top: (element.data.top as number) ?? existingObject.top,
              scaleX: (element.data.scaleX as number) ?? existingObject.scaleX,
              scaleY: (element.data.scaleY as number) ?? existingObject.scaleY,
              angle: (element.data.angle as number) ?? existingObject.angle
            });
            existingObject.setCoords();
          } else {
            loadDiagramToCanvas(canvas, { id: element.id, data: element.data as { src?: string } }, hasWritePermission ?? false);
          }

          elementsMapRef.current.set(element.id, element);
          return;
        }

        const existingObject = objectMapRef.current.get(element.id);

        const resolvedExisting =
          existingObject ??
          canvas.getObjects().find((o: FabricObjectWithId) => o.id === element.id);

        if (resolvedExisting && !existingObject) {
          objectMapRef.current.set(element.id, resolvedExisting);
        }

        if (resolvedExisting) {
          const data = element.data || {};
          const readOnlyProps = new Set(['type', 'id']);
          Object.keys(data).forEach(key => {
            if (readOnlyProps.has(key)) return;
            if ((resolvedExisting as unknown as Record<string, unknown>)[key] !== data[key]) {
              resolvedExisting.set(key, data[key]);
            }
          });
          resolvedExisting.setCoords();
        } else {
          const tempObject = canvas.getObjects().find((obj) => {
            const tempObj = obj as unknown as { _shapeId?: string; _drawingId?: string };
            return tempObj._shapeId === element.id || tempObj._drawingId === element.id;
          });
          if (tempObject) {
            canvas.remove(tempObject);
          }

          const newObject = createFabricObject(element);
          if (newObject) {
            canvas.add(newObject);
            newObject.setCoords();
            objectMapRef.current.set(element.id, newObject);
          }
        }

        elementsMapRef.current.set(element.id, element);
      });
    } finally {
      (canvas as unknown as { suspendDrawing: boolean }).suspendDrawing = false;
      batchedRender();
      isUpdatingRef.current = false;
    }
  }, [canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, canWrite]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setIsLoading(true);
    };

    const handleWhiteboardState = (state: WorkspaceState) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const batchedRender = createBatchedRender(canvas);
      const hasWritePermission = canWrite && canWrite();

      canvas.clear();
      elementsMapRef.current.clear();
      objectMapRef.current.clear();

      if (state.whiteboardElements && state.whiteboardElements.length > 0) {
        isUpdatingRef.current = true;
        try {
          const isDiagramElement = (el: Element): boolean =>
            el.type === 'diagram' || (el.data as { isDiagram?: boolean })?.isDiagram === true;
          const regularElements = state.whiteboardElements.filter(el => !isDiagramElement(el));
          const diagramElements = state.whiteboardElements.filter(el => isDiagramElement(el));

          regularElements.forEach(element => {
            if (element && element.id) {
              const obj = createFabricObject(element);
              if (obj) {
                canvas.add(obj);
                elementsMapRef.current.set(element.id, element);
                objectMapRef.current.set(element.id, obj);
              }
            }
          });

          diagramElements.forEach(element => {
            if (element && element.id) {
              elementsMapRef.current.set(element.id, element);
              loadDiagramToCanvas(canvas, { id: element.id, data: element.data as { src?: string } }, hasWritePermission ?? false);
              const diagramObj = canvas.getObjects().find((o: FabricObjectWithId) => o.id === element.id);
              if (diagramObj) {
                objectMapRef.current.set(element.id, diagramObj);
              }
            }
          });

          canvas.getObjects().forEach(obj => {
            obj.set({
              selectable: hasWritePermission ?? false,
              hasControls: hasWritePermission ?? false,
              hasBorders: hasWritePermission ?? false,
              evented: hasWritePermission ?? false
            });
          });

          batchedRender();
        } finally {
          isUpdatingRef.current = false;
        }
      }

      setActiveUsers(state.activeUsers);
      setIsLoading(false);
    };

    const handleWhiteboardClear = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.clear();
        elementsMapRef.current.clear();
        objectMapRef.current.clear();
      }
    };

    const handleDeleteElement = ({ workspaceId, elementId }: DeleteElementEvent) => {
      const currentWorkspace = getWorkspaceId();
      if (currentWorkspace !== workspaceId) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const batchedRender = createBatchedRender(canvas);

      elementsMapRef.current.delete(elementId);

      const obj = objectMapRef.current.get(elementId);
      if (obj) {
        canvas.remove(obj);
        objectMapRef.current.delete(elementId);
      }

      batchedRender();
    };

    const handleUserJoined = ({ activeUsers }: UserEvent) => {
      setActiveUsers(activeUsers);
    };

    const handleUserLeft = ({ activeUsers }: UserEvent) => {
      setActiveUsers(activeUsers);
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState as (...args: unknown[]) => void);
    socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate as (...args: unknown[]) => void);
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
    socket.on(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement as (...args: unknown[]) => void);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined as (...args: unknown[]) => void);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft as (...args: unknown[]) => void);

    if (socket.connected) {
      setIsConnected(true);
      setConnectionStatus('connected');
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState as (...args: unknown[]) => void);
      socket.off(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate as (...args: unknown[]) => void);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
      socket.off(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement as (...args: unknown[]) => void);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined as (...args: unknown[]) => void);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft as (...args: unknown[]) => void);
    };
  }, [socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, handleWhiteboardUpdate, canWrite]);

  return {
    isConnected,
    isLoading,
    connectionStatus,
    activeUsers
  };
}
