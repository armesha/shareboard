import { memo } from 'react';

const CursorIcon = memo(function CursorIcon({ color }) {
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

const RemoteCursor = memo(function RemoteCursor({ cursor, viewportTransform = [1, 0, 0, 1, 0, 0] }) {
  const { x = 0, y = 0 } = cursor || {};
  const vpt = viewportTransform;
  const screenX = vpt[0] * x + vpt[2] * y + vpt[4];
  const screenY = vpt[1] * x + vpt[3] * y + vpt[5];

  return (
    <div
      className="remote-cursor"
      style={{
        transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
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

function RemoteCursors({ cursors, viewportTransform }) {
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
