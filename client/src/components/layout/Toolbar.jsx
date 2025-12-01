import React from 'react';
import { useTranslation } from 'react-i18next';
import MouseIcon from '@mui/icons-material/Mouse';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ShareIcon from '@mui/icons-material/Share';
import LockIcon from '@mui/icons-material/Lock';
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
          <LockIcon className="h-3 w-3" />
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
        <ShareIcon className={`text-${isOwner ? 'blue' : 'gray'}-500`} />
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
