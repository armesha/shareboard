import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';

const DiagramContext = createContext();

export const DiagramProvider = ({ children }) => {
  const [diagrams, setDiagrams] = useState([]);
  const [currentDiagram, setCurrentDiagram] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      // Request initial diagrams state
      socket.emit('getDiagrams');

      // Listen for diagram updates
      socket.on('diagramsUpdate', (updatedDiagrams) => {
        setDiagrams(updatedDiagrams);
        // Update current diagram if it exists in the updated list
        if (currentDiagram) {
          const updated = updatedDiagrams.find(d => d.id === currentDiagram.id);
          if (updated) {
            setCurrentDiagram(updated);
          }
        }
      });

      return () => {
        socket.off('diagramsUpdate');
      };
    }
  }, [socket]);

  const createDiagram = (diagramData) => {
    if (socket) {
      socket.emit('createDiagram', diagramData);
    }
  };

  const updateDiagram = (diagramData) => {
    if (socket) {
      socket.emit('updateDiagram', diagramData);
    }
  };

  const deleteDiagram = (diagramId) => {
    if (socket) {
      socket.emit('deleteDiagram', diagramId);
      if (currentDiagram?.id === diagramId) {
        setCurrentDiagram(null);
      }
    }
  };

  const selectDiagram = (diagram) => {
    setCurrentDiagram(diagram);
  };

  return (
    <DiagramContext.Provider
      value={{
        diagrams,
        currentDiagram,
        createDiagram,
        updateDiagram,
        deleteDiagram,
        selectDiagram,
      }}
    >
      {children}
    </DiagramContext.Provider>
  );
};

export const useDiagram = () => {
  const context = useContext(DiagramContext);
  if (!context) {
    throw new Error('useDiagram must be used within a DiagramProvider');
  }
  return context;
};
