class DiagramHandler {
  constructor(workspaceState) {
    this.workspaceState = workspaceState;
    this.diagrams = new Map();
  }

  initialize(socket, io) {
    // Handle get diagrams request
    socket.on('getDiagrams', () => {
      socket.emit('diagramsUpdate', this.getDiagramsList());
    });

    // Handle create diagram
    socket.on('createDiagram', (diagramData) => {
      this.createDiagram(diagramData);
      io.emit('diagramsUpdate', this.getDiagramsList());
    });

    // Handle update diagram
    socket.on('updateDiagram', (diagramData) => {
      this.updateDiagram(diagramData);
      io.emit('diagramsUpdate', this.getDiagramsList());
    });

    // Handle delete diagram
    socket.on('deleteDiagram', (diagramId) => {
      this.deleteDiagram(diagramId);
      io.emit('diagramsUpdate', this.getDiagramsList());
    });
  }

  createDiagram(diagramData) {
    this.diagrams.set(diagramData.id, {
      ...diagramData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.updateWorkspaceState();
  }

  updateDiagram(diagramData) {
    if (this.diagrams.has(diagramData.id)) {
      this.diagrams.set(diagramData.id, {
        ...diagramData,
        createdAt: this.diagrams.get(diagramData.id).createdAt,
        updatedAt: new Date().toISOString(),
      });
      this.updateWorkspaceState();
    }
  }

  deleteDiagram(diagramId) {
    this.diagrams.delete(diagramId);
    this.updateWorkspaceState();
  }

  getDiagramsList() {
    return Array.from(this.diagrams.values());
  }

  updateWorkspaceState() {
    if (this.workspaceState) {
      this.workspaceState.diagrams = this.getDiagramsList();
    }
  }

  loadFromWorkspaceState(state) {
    if (state?.diagrams) {
      this.diagrams.clear();
      state.diagrams.forEach(diagram => {
        this.diagrams.set(diagram.id, diagram);
      });
    }
  }
}

export default DiagramHandler;
