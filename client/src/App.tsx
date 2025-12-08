import {
  Navigate,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Workspace from './pages/Workspace';
import { SocketProvider } from './context/SocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TOAST } from './constants';

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
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
      v7_fetcherPersist: true
    }
  }
);

function App() {
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-100">
        <RouterProvider router={router} />
        <ToastContainer
          position={TOAST.POSITION}
          newestOnTop={false}
        />
      </div>
    </SocketProvider>
  );
}

export default App;
