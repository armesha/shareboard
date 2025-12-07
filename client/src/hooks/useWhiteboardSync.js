import { useState, useEffect, useCallback, useRef } from 'react';
import { SOCKET_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';
import { loadDiagramToCanvas } from '../factories/diagramFactory';
import { createBatchedRender } from '../utils/batchedRender';

export function useWhiteboardSync(socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, setElements, canWrite) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activeUsers, setActiveUsers] = useState(0);
  const objectMapRef = useRef(new Map());

  const handleWhiteboardUpdate = useCallback((serverElements) => {
    if (!serverElements || !Array.isArray(serverElements) || serverElements.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const batchedRender = createBatchedRender(canvas);
    const hasWritePermission = canWrite && canWrite();

    isUpdatingRef.current = true;
    canvas.suspendDrawing = true;

    try {
      const _newIds = new Set(serverElements.map(e => e.id));

      serverElements.forEach(element => {
        if (!element || !element.id) return;

        if (element.type === 'diagram') {
          const existingObject = objectMapRef.current.get(element.id);

          if (existingObject) {
            existingObject.set({
              left: element.data.left ?? existingObject.left,
              top: element.data.top ?? existingObject.top,
              scaleX: element.data.scaleX ?? existingObject.scaleX,
              scaleY: element.data.scaleY ?? existingObject.scaleY,
              angle: element.data.angle ?? existingObject.angle
            });
            existingObject.setCoords();
          } else {
            loadDiagramToCanvas(canvas, element, hasWritePermission);
          }

          elementsMapRef.current.set(element.id, element);
          return;
        }

        const existingObject = objectMapRef.current.get(element.id);

        if (existingObject) {
          const data = element.data || {};
          Object.keys(data).forEach(key => {
            if (existingObject[key] !== data[key]) {
              existingObject.set(key, data[key]);
            }
          });
          existingObject.setCoords();
        } else {
          const newObject = createFabricObject(element);
          if (newObject) {
            canvas.add(newObject);
            newObject.setCoords();
            objectMapRef.current.set(element.id, newObject);
          }
        }

        elementsMapRef.current.set(element.id, element);
      });
      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
    } finally {
      canvas.suspendDrawing = false;
      batchedRender();
      isUpdatingRef.current = false;
    }
  }, [canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, setElements, canWrite]);

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

    const handleWhiteboardState = (state) => {
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
          const regularElements = state.whiteboardElements.filter(el => el.type !== 'diagram');
          const diagramElements = state.whiteboardElements.filter(el => el.type === 'diagram');

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
              loadDiagramToCanvas(canvas, element, hasWritePermission);
              const diagramObj = canvas.getObjects().find(o => o.id === element.id);
              if (diagramObj) {
                objectMapRef.current.set(element.id, diagramObj);
              }
            }
          });

          canvas.getObjects().forEach(obj => {
            obj.set({
              selectable: hasWritePermission,
              hasControls: hasWritePermission,
              hasBorders: hasWritePermission,
              evented: hasWritePermission
            });
          });

          batchedRender();
          setElements(state.whiteboardElements);
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
        setElements([]);
      }
    };

    const handleDeleteElement = ({ workspaceId, elementId }) => {
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

      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);

      batchedRender();
    };

    const handleUserJoined = ({ activeUsers }) => {
      setActiveUsers(activeUsers);
    };

    const handleUserLeft = ({ activeUsers }) => {
      setActiveUsers(activeUsers);
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState);
    socket.on(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
    socket.on(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);

    if (socket.connected) {
      setIsConnected(true);
      setConnectionStatus('connected');
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.WORKSPACE_STATE, handleWhiteboardState);
      socket.off(SOCKET_EVENTS.WHITEBOARD_UPDATE, handleWhiteboardUpdate);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR, handleWhiteboardClear);
      socket.off(SOCKET_EVENTS.DELETE_ELEMENT, handleDeleteElement);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    };
  }, [socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, setElements, handleWhiteboardUpdate, canWrite]);

  return {
    isConnected,
    isLoading,
    connectionStatus,
    activeUsers
  };
}
