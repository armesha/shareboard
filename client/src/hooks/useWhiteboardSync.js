import { useState, useEffect, useCallback } from 'react';
import { SOCKET_EVENTS } from '../constants';
import { getWorkspaceId } from '../utils';
import { loadDiagramToCanvas } from '../factories/diagramFactory';

export function useWhiteboardSync(socket, canvasRef, elementsMapRef, isUpdatingRef, createFabricObject, setElements, canWrite) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [activeUsers, setActiveUsers] = useState(0);

  const handleWhiteboardUpdate = useCallback((serverElements) => {
    if (!serverElements || !Array.isArray(serverElements) || serverElements.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    isUpdatingRef.current = true;
    canvas.suspendDrawing = true;

    try {
      const _newIds = new Set(serverElements.map(e => e.id));

      serverElements.forEach(element => {
        if (!element || !element.id) return;

        if (element.type === 'diagram') {
          const existingObject = canvas.getObjects().find(obj => obj.id === element.id);

          if (existingObject) {
            existingObject.set({
              left: element.data.left || existingObject.left,
              top: element.data.top || existingObject.top,
              scaleX: element.data.scaleX || existingObject.scaleX,
              scaleY: element.data.scaleY || existingObject.scaleY,
              angle: element.data.angle || existingObject.angle
            });
            existingObject.setCoords();
          } else {
            const isSelectable = canWrite && canWrite();
            loadDiagramToCanvas(canvas, element, isSelectable);
          }

          elementsMapRef.current.set(element.id, element);
          return;
        }

        const existingObject = canvas.getObjects().find(obj => obj.id === element.id);

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
          }
        }

        elementsMapRef.current.set(element.id, element);
      });
      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);
    } finally {
      canvas.suspendDrawing = false;
      canvas.requestRenderAll();
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

      canvas.clear();
      elementsMapRef.current.clear();

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
              }
            }
          });

          diagramElements.forEach(element => {
            if (element && element.id) {
              elementsMapRef.current.set(element.id, element);
              const isSelectable = canWrite && canWrite();
              loadDiagramToCanvas(canvas, element, isSelectable);
            }
          });

          canvas.getObjects().forEach(obj => {
            const isSelectable = canWrite && canWrite();

            obj.set({
              selectable: isSelectable,
              hasControls: isSelectable,
              hasBorders: isSelectable,
              evented: isSelectable
            });
          });

          canvas.requestRenderAll();
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

      elementsMapRef.current.delete(elementId);

      const obj = canvas.getObjects().find(o => o.id === elementId);
      if (obj) {
        canvas.remove(obj);
      }

      const updatedElements = Array.from(elementsMapRef.current.values());
      setElements(updatedElements);

      canvas.requestRenderAll();
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
