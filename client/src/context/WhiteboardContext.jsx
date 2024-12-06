import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';

const WhiteboardContext = createContext(null);

export function useWhiteboard() {
  return useContext(WhiteboardContext);
}

export function WhiteboardProvider({ children }) {
  const socket = useSocket();
  const [elements, setElements] = useState([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);

  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard-update', (updatedElements) => {
      setElements(updatedElements);
    });

    socket.on('workspace-state', (state) => {
      if (state.whiteboardElements) {
        setElements(state.whiteboardElements);
      }
    });

    return () => {
      socket.off('whiteboard-update');
      socket.off('workspace-state');
    };
  }, [socket]);

  const addElement = (element) => {
    const updatedElements = [...elements, element];
    setElements(updatedElements);
    if (socket) {
      socket.emit('whiteboard-update', {
        workspaceId: window.location.pathname.split('/')[2],
        elements: updatedElements
      });
    }
  };

  const updateElement = (elementId, updates) => {
    const updatedElements = elements.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(updatedElements);
    if (socket) {
      socket.emit('whiteboard-update', {
        workspaceId: window.location.pathname.split('/')[2],
        elements: updatedElements
      });
    }
  };

  const value = {
    elements,
    tool,
    setTool,
    color,
    setColor,
    width,
    setWidth,
    addElement,
    updateElement
  };

  return (
    <WhiteboardContext.Provider value={value}>
      {children}
    </WhiteboardContext.Provider>
  );
}
