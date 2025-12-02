import { useEffect } from 'react';

export function useClickOutside(ref, callback, isActive = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback, isActive]);
}

export function useEscapeKey(callback, isActive = true) {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callback, isActive]);
}

export function useDropdownBehavior(ref, isOpen, onClose) {
  useClickOutside(ref, onClose, isOpen);
  useEscapeKey(onClose, isOpen);
}
