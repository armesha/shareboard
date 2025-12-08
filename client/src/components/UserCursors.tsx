import { useMemo } from 'react';
import { useYjs } from '../context/YjsContext';

interface User {
  id?: string;
  name?: string;
  color?: string;
}

export default function UserCursors() {
  const { provider } = useYjs();

  const users = useMemo(() => {
    if (!provider?.awareness) return [];
    return Array.from(provider.awareness.getStates().values())
      .map((state) => state.user as User)
      .filter(Boolean);
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {users.map((user, index) => (
        <span
          key={user.id || index}
          className="px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: user.color || '#3b82f6' }}
        >
          {user.name || 'User'}
        </span>
      ))}
    </div>
  );
}
