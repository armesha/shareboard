import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useParams,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom';
import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import { SocketProvider } from './context/SocketContext';
import { WhiteboardProvider } from './context/WhiteboardContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Create router with future flags to avoid warnings
const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <LandingPage />
    },
    {
      path: "/w/:workspaceId",
      element: <Workspace />
    },
    {
      path: "*",
      element: <Navigate to="/" replace />
    }
  ],
  {
    // Apply future flags to avoid warnings
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }
  }
);

function App() {
  return (
    <SocketProvider>
      <WhiteboardProvider>
        <div className="min-h-screen bg-gray-100">
          <RouterProvider router={router} />
          <ToastContainer position="bottom-right" />
        </div>
      </WhiteboardProvider>
    </SocketProvider>
  );
}

export default App;
