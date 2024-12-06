import React from 'react';
import DiagramPanel from '../components/DiagramPanel';
import DiagramList from '../components/DiagramList';
import { useDiagram } from '../context/DiagramContext';

const DiagramWorkspace = () => {
  const {
    diagrams,
    currentDiagram,
    createDiagram,
    updateDiagram,
    deleteDiagram,
    selectDiagram,
  } = useDiagram();

  const handleDiagramSubmit = (diagramData) => {
    if (currentDiagram) {
      updateDiagram(diagramData);
    } else {
      createDiagram(diagramData);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 border-r overflow-y-auto">
        <DiagramList
          diagrams={diagrams}
          currentDiagramId={currentDiagram?.id}
          onSelectDiagram={selectDiagram}
          onDeleteDiagram={deleteDiagram}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <DiagramPanel
          onDiagramSubmit={handleDiagramSubmit}
          currentDiagram={currentDiagram}
          diagrams={diagrams}
        />
      </div>
    </div>
  );
};

export default DiagramWorkspace;
