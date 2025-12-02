import React from 'react';
import { useTranslation } from 'react-i18next';
import MouseIcon from '@mui/icons-material/Mouse';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import { TOOLS } from '../../constants';
import {
  ToolButton,
  ShapesMenu,
  OptionsMenu,
  PenButton
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
  onShareClick,
  clearCanvas,
  socket,
  workspaceId
}) {
  const { t } = useTranslation(['toolbar', 'common']);
  const hasWriteAccess = canWrite();

  return (
    <div className="flex flex-col items-center gap-2 bg-white rounded-2xl shadow-lg border border-gray-200 px-2 py-3 overflow-visible">
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

      {hasWriteAccess && (
        <>
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
            tool={tool}
            selectedShape={selectedShape}
            onSelectShape={setSelectedShape}
            setTool={setTool}
            vertical
          />

          <ToolButton
            icon={TextFieldsIcon}
            isActive={tool === TOOLS.TEXT}
            onClick={() => {
              setTool(tool === TOOLS.TEXT ? TOOLS.SELECT : TOOLS.TEXT);
              setSelectedShape(null);
            }}
            title={t('tools.text')}
          />
        </>
      )}

      {!hasWriteAccess && (
        <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded flex items-center">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
      )}

      <div className="w-8 h-px bg-gray-200 my-1" aria-hidden="true" />

      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
        onClick={onShareClick}
        aria-label={t('common:accessibility.shareSettings')}
        title={t('common:accessibility.shareSettings')}
      >
        <svg className={`text-${isOwner ? 'blue' : 'gray'}-500 w-6 h-6`} fill="currentColor" viewBox="0 0 24 24">
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
  );
});

export default Toolbar;
