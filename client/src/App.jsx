import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import { SocketProvider, useSocket } from './context/SocketContext';

function App() {
  const socket = useSocket();
  const [viewMode, setViewMode] = useState('split');
  const [status, setStatus] = useState('');
  const { workspaceId } = useParams();

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('Socket connected successfully');
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
    };

    socket.on('connect', handleConnect);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('error', handleError);
    };
  }, [socket]);

  return (
    <Router>
      <SocketProvider>
        <div className="min-h-screen bg-gray-100">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/w/:workspaceId" element={<Workspace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SocketProvider>
    </Router>
  );
}

export default App;
