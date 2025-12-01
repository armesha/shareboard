import React, { useState, useEffect, useRef } from 'react';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { SHAPES, TOOLS } from '../../constants';

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 L14.5 9 L22 9 L16 14 L18.5 22 L12 17 L5.5 22 L8 14 L2 9 L9.5 9 Z" />
  </svg>
);

const DiamondIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 L22 12 L12 22 L2 12 Z" />
  </svg>
);

const PentagonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 L22 9 L18 21 L6 21 L2 9 Z" />
  </svg>
);

const HexagonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
  </svg>
);

const EllipseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="12" rx="10" ry="6" />
  </svg>
);

const OctagonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 2 L16 2 L22 8 L22 16 L16 22 L8 22 L2 16 L2 8 Z" />
  </svg>
);

const CrossIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 2 L15 2 L15 9 L22 9 L22 15 L15 15 L15 22 L9 22 L9 15 L2 15 L2 9 L9 9 Z" />
  </svg>
);

const SHAPE_ITEMS = [
  { id: SHAPES.RECTANGLE, icon: CropSquareIcon, tool: TOOLS.SHAPES },
  { id: SHAPES.CIRCLE, icon: CircleOutlinedIcon, tool: TOOLS.SHAPES },
  { id: SHAPES.ELLIPSE, icon: EllipseIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.TRIANGLE, icon: ChangeHistoryIcon, tool: TOOLS.SHAPES },
  { id: SHAPES.PENTAGON, icon: PentagonIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.HEXAGON, icon: HexagonIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.OCTAGON, icon: OctagonIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.DIAMOND, icon: DiamondIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.STAR, icon: StarIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
  { id: SHAPES.CROSS, icon: CrossIcon, tool: TOOLS.SHAPES, isCustomIcon: true },
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
  disabled = false,
  vertical = false
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
        className={isActive ? 'btn-icon-active' : 'btn-icon'}
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
          className={`dropdown-base rounded-xl p-1.5 animate-fadeIn ${
            vertical ? 'dropdown-side' : 'top-full left-1/2 -translate-x-1/2 mt-2'
          }`}
          role="menu"
          aria-label="Shape options"
        >
          <div className="grid grid-cols-4 gap-1" style={{ minWidth: '168px' }}>
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
                  {item.isCustomIcon ? <Icon /> : <Icon sx={{ fontSize: 20 }} />}
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
