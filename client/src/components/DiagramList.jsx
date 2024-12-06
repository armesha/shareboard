import React from 'react';

const DiagramList = ({ diagrams, onSelectDiagram, onDeleteDiagram, currentDiagramId }) => {
  return (
    <div className="p-4">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Diagrams</h2>
      <div className="space-y-2">
        {diagrams.map((diagram) => (
          <div
            key={diagram.id}
            className={`p-3 border rounded-md flex justify-between items-center ${
              currentDiagramId === diagram.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white'
            }`}
          >
            <button
              onClick={() => onSelectDiagram(diagram)}
              className="flex-1 text-left hover:text-indigo-600"
            >
              {diagram.title}
            </button>
            <button
              onClick={() => onDeleteDiagram(diagram.id)}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        ))}
        {diagrams.length === 0 && (
          <p className="text-gray-500 text-sm">No diagrams created yet</p>
        )}
      </div>
    </div>
  );
};

export default DiagramList;
