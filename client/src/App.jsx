import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import DiagramWorkspace from './pages/DiagramWorkspace';
import { SocketProvider } from './context/SocketContext';
import { DiagramProvider } from './context/DiagramContext';

function App() {
  return (
    <Router>
      <SocketProvider>
        <DiagramProvider>
          <div className="min-h-screen bg-gray-100">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/w/:workspaceId" element={<Workspace />} />
              <Route path="/diagram" element={<DiagramWorkspace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </DiagramProvider>
      </SocketProvider>
    </Router>
  );
}

export default App;
