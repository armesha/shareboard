import { memo } from 'react';

interface CursorIconProps {
  color: string;
}

const CursorIcon = memo(function CursorIcon({ color }: CursorIconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
      <path
        d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
});

interface Cursor {
  x?: number;
  y?: number;
  color: string;
  name: string;
}

type ViewportTransform = [number, number, number, number, number, number];

interface RemoteCursorProps {
  cursor: Cursor;
  viewportTransform?: ViewportTransform;
}

const RemoteCursor = memo(function RemoteCursor({ cursor, viewportTransform = [1, 0, 0, 1, 0, 0] }: RemoteCursorProps) {
  const { x = 0, y = 0 } = cursor || {};
  const vpt = viewportTransform;
  const screenX = vpt[0] * x + vpt[2] * y + vpt[4];
  const screenY = vpt[1] * x + vpt[3] * y + vpt[5];

  return (
    <div
      className="remote-cursor"
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
        // Smooth transition matching the cursor throttle interval (50ms)
        // This syncs cursor movement with drawing without prediction lag
        transition: 'transform 50ms linear',
      }}
    >
      <CursorIcon color={cursor.color} />
      <span
        className="remote-cursor-label"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
    </div>
  );
});

interface CursorsMap {
  [userId: string]: Cursor;
}

interface RemoteCursorsProps {
  cursors: CursorsMap;
  viewportTransform?: ViewportTransform;
}

function RemoteCursors({ cursors, viewportTransform }: RemoteCursorsProps) {
  const cursorEntries = Object.entries(cursors);

  if (cursorEntries.length === 0) return null;

  return (
    <div className="remote-cursors-container">
      {cursorEntries.map(([userId, cursor]) => (
        <RemoteCursor
          key={userId}
          cursor={cursor}
          viewportTransform={viewportTransform}
        />
      ))}
    </div>
  );
}

export default memo(RemoteCursors);
