import React from 'react';
import MouseIcon from '@mui/icons-material/Mouse';
import CreateIcon from '@mui/icons-material/Create';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ComputerIcon from '@mui/icons-material/Computer';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
import { TOOLS } from '../../constants';
import {
  ColorPicker,
  WidthSlider,
  ToolButton,
  ShapesMenu,
  OptionsMenu,
  ConnectionStatus
} from '../ui';

const Toolbar = React.memo(function Toolbar({
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
  socket,
  workspaceId
}) {
  const hasWriteAccess = canWrite();

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-full shadow-lg border border-gray-200 py-2 px-2 sm:px-3 overflow-visible">
        <WidthSlider
          width={width}
          onWidthChange={setWidth}
          disabled={!hasWriteAccess}
        />

        <ColorPicker
          currentColor={color}
          onColorChange={setColor}
          disabled={!hasWriteAccess}
        />

        <ToolButton
          icon={MouseIcon}
          isActive={tool === TOOLS.SELECT}
          onClick={() => {
            setTool(TOOLS.SELECT);
            setSelectedShape(null);
          }}
          title={hasWriteAccess ? 'Select' : 'Select (Read-Only View)'}
          disabled={false}
        />

        {!hasWriteAccess && (
          <div className="ml-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded flex items-center whitespace-nowrap">
            <LockIcon className="h-3 w-3 mr-1" />
            View Only
          </div>
        )}

        {hasWriteAccess && (
          <>
            <ToolButton
              icon={CreateIcon}
              isActive={tool === TOOLS.PEN}
              onClick={() => {
                setTool(TOOLS.PEN);
                setSelectedShape(null);
              }}
              title="Pen"
            />

            <ShapesMenu
              selectedShape={selectedShape}
              onSelectShape={setSelectedShape}
              setTool={setTool}
            />

            <ToolButton
              icon={TextFieldsIcon}
              isActive={tool === TOOLS.TEXT}
              onClick={() => {
                setTool(tool === TOOLS.TEXT ? TOOLS.SELECT : TOOLS.TEXT);
                setSelectedShape(null);
              }}
              title="Text"
            />
          </>
        )}

        <div className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />

        <ToolButton
          icon={ComputerIcon}
          isActive={viewMode === 'split'}
          onClick={cycleViewMode}
          title={viewMode === 'split' ? 'Close CodeBoard' : 'Open CodeBoard'}
        />

        <button
          type="button"
          className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
          onClick={onShareClick}
          aria-label="Share Settings"
          title="Share Settings"
        >
          <ShareIcon className={`text-${isOwner ? 'blue' : 'gray'}-500`} />
        </button>

        {hasWriteAccess && (
          <OptionsMenu
            onClearCanvas={clearCanvas}
            isOwner={isOwner}
            socket={socket}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
});

export default Toolbar;
