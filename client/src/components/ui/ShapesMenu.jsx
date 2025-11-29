import React, { useState, useEffect, useRef } from 'react';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { SHAPES, TOOLS } from '../../constants';

const SHAPE_ITEMS = [
  { id: SHAPES.RECTANGLE, icon: CropSquareIcon, tool: TOOLS.SHAPES },
  { id: SHAPES.CIRCLE, icon: CircleOutlinedIcon, tool: TOOLS.SHAPES },
  { id: SHAPES.TRIANGLE, icon: ChangeHistoryIcon, tool: TOOLS.SHAPES },
  { id: 'line', icon: HorizontalRuleIcon, tool: TOOLS.LINE },
  { id: 'arrow', icon: ArrowRightAltIcon, tool: TOOLS.ARROW },
];

const GroupedShapesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <circle cx="17" cy="7" r="4" />
    <path d="M7 14 L3 21 L11 21 Z" />
    <line x1="14" y1="17" x2="21" y2="17" strokeWidth="2" />
  </svg>
);

const ShapesMenu = React.memo(function ShapesMenu({
  tool,
  selectedShape,
  onSelectShape,
  setTool,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const isActive = tool === TOOLS.SHAPES || tool === TOOLS.LINE || tool === TOOLS.ARROW;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (disabled) return null;

  const handleItemSelect = (item) => {
    if (item.tool === TOOLS.SHAPES) {
      onSelectShape(item.id);
      setTool(TOOLS.SHAPES);
    } else {
      onSelectShape(null);
      setTool(item.tool);
    }
    setIsOpen(false);
  };

  const getActiveItemId = () => {
    if (tool === TOOLS.LINE) return 'line';
    if (tool === TOOLS.ARROW) return 'arrow';
    if (tool === TOOLS.SHAPES && selectedShape) return selectedShape;
    return null;
  };

  const activeItemId = getActiveItemId();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className={`p-2 rounded-full transition-all duration-200 ${
          isActive ? 'bg-blue-500 hover:bg-blue-600' : 'hover:bg-gray-100'
        }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Shapes menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Shapes & Lines"
      >
        <div className={isActive ? 'text-white' : 'text-gray-700'}>
          <GroupedShapesIcon />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 z-50 animate-fadeIn"
          role="menu"
          aria-label="Shape options"
        >
          <div className="flex gap-1">
            {SHAPE_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => handleItemSelect(item)}
                  role="menuitem"
                  aria-label={`Select ${item.id}`}
                  title={item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                >
                  <Icon sx={{ fontSize: 20 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default ShapesMenu;
