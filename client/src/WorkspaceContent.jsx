import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import io from 'socket.io-client';

const WorkspaceContent = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io.connect('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const addElement = (elementData) => {
    // Implementation of addElement function
  };

  const setTool = (tool) => {
    // Implementation of setTool function
  };

  const handleDiagramUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        // Добавляем диаграмму на доску после проверки изображения
        const newElementId = uuidv4();
        const elementData = {
          id: newElementId,
          type: 'diagram',
          data: {
            src: dataUrl,
            left: 100,
            top: 100,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 0,
            isDiagram: true
          }
        };
        
        addElement(elementData);
        
        // Явно отправляем данные на сервер для надежности
        const workspaceId = window.location.pathname.split('/')[2];
        if (socket && workspaceId) {
          console.log('Explicitly sending diagram to server');
          socket.emit('whiteboard-update', {
            workspaceId,
            elements: [elementData]
          });
        }
        
        setTool('select');
        console.log('Diagram element added to whiteboard with ID:', newElementId);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      {/* Diagram upload input */}
    </div>
  );
};

export default WorkspaceContent; 