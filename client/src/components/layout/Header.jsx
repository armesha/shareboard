import React from 'react';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import LockIcon from '@mui/icons-material/Lock';
import { ConnectionStatus } from '../ui';
import Toolbar from './Toolbar';

const Header = React.memo(function Header({
  workspaceId,
  tool,
  setTool,
  selectedShape,
  setSelectedShape,
  color,
  setColor,
  width,
  setWidth,
  canWrite,
  isOwner,
  viewMode,
  cycleViewMode,
  onShareClick,
  connectionStatus,
  connectionError,
  clearCanvas,
  socket
}) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-white border-b border-gray-200">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
          aria-label="Return to Home"
          title="Return to Home"
        >
          <HomeIcon className="text-gray-700" />
        </button>

        <h1 className="text-base sm:text-xl font-semibold truncate">
          <span className="hidden sm:inline">Workspace: </span>
          {workspaceId}
        </h1>

        {!canWrite() && (
          <div className="hidden md:flex items-center text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded whitespace-nowrap">
            <LockIcon className="h-4 w-4 mr-1" />
            Read-Only Mode
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <Toolbar
          tool={tool}
          setTool={setTool}
          selectedShape={selectedShape}
          setSelectedShape={setSelectedShape}
          color={color}
          setColor={setColor}
          width={width}
          setWidth={setWidth}
          canWrite={canWrite}
          isOwner={isOwner}
          viewMode={viewMode}
          cycleViewMode={cycleViewMode}
          onShareClick={onShareClick}
          connectionStatus={connectionStatus}
          connectionError={connectionError}
          clearCanvas={clearCanvas}
          socket={socket}
          workspaceId={workspaceId}
        />

        <ConnectionStatus
          status={connectionStatus}
          error={connectionError}
        />
      </div>
    </header>
  );
});

export default Header;
