import React from 'react';
import { useTranslation } from 'react-i18next';
import MouseIcon from '@mui/icons-material/Mouse';
import { TOOLS, SHAPES } from '../../constants';
import {
  ToolButton,
  ShapesMenu,
  OptionsMenu,
  PenButton,
  TextButton
} from '../ui';
import type { Socket } from 'socket.io-client';

type ToolType = typeof TOOLS[keyof typeof TOOLS];
type ShapeType = typeof SHAPES[keyof typeof SHAPES];

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  selectedShape: ShapeType | null;
  setSelectedShape: (shape: ShapeType | null) => void;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  canWrite: () => boolean;
  isOwner: boolean;
  onShareClick: () => void;
  clearCanvas: () => void;
  socket: Socket | null;
  workspaceId: string;
}

const Toolbar = React.memo(function Toolbar({
  tool,
  setTool,
  selectedShape,
  setSelectedShape,
  color,
  setColor,
  width,
  setWidth,
  fontSize,
  setFontSize,
  canWrite,
  isOwner,
  onShareClick,
  clearCanvas,
  socket,
  workspaceId
}: ToolbarProps) {
  const { t } = useTranslation(['toolbar', 'common']);
  const hasWriteAccess = canWrite();

  return (
    <div className="toolbar-panel">
      <div className="toolbar-section">
        <ToolButton
          icon={MouseIcon}
          isActive={tool === TOOLS.SELECT}
          onClick={() => {
            setTool(TOOLS.SELECT);
            setSelectedShape(null);
          }}
          title={hasWriteAccess ? t('tools.select') : t('tools.selectReadOnly')}
          disabled={false}
        />
      </div>

      {hasWriteAccess && (
        <>
          <div className="toolbar-divider-v" />

          <div className="toolbar-section">
            <PenButton
              isActive={tool === TOOLS.PEN}
              onActivate={() => {
                setTool(TOOLS.PEN);
                setSelectedShape(null);
              }}
              currentColor={color}
              onColorChange={setColor}
              width={width}
              onWidthChange={setWidth}
            />

            <ShapesMenu
              tool={tool as ToolType}
              selectedShape={selectedShape as ShapeType | null}
              onSelectShape={setSelectedShape}
              setTool={setTool}
              vertical
            />

            <TextButton
              isActive={tool === TOOLS.TEXT}
              onActivate={() => {
                setTool(TOOLS.TEXT);
                setSelectedShape(null);
              }}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
            />
          </div>
        </>
      )}

      {!hasWriteAccess && (
        <div className="toolbar-readonly-indicator">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
      )}

      <div className="toolbar-divider-v" />

      <div className="toolbar-section">
        <button
          type="button"
          className="toolbar-action-btn"
          onClick={onShareClick}
          aria-label={t('common:accessibility.shareSettings')}
          title={t('common:accessibility.shareSettings')}
        >
          <svg className={isOwner ? 'text-blue-500' : 'text-gray-500'} width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
          </svg>
        </button>

        <OptionsMenu
          onClearCanvas={clearCanvas}
          isOwner={isOwner}
          socket={socket}
          workspaceId={workspaceId}
          readOnly={!hasWriteAccess}
        />
      </div>
    </div>
  );
});

export default Toolbar;
