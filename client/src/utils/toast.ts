import { toast as reactToast, ToastOptions, Id } from 'react-toastify';
import { TOAST } from '../constants';

const activeToasts = new Set<Id>();

const manageToastLimit = (excludeId: Id | null = null): void => {
  const toastsToCheck = excludeId
    ? [...activeToasts].filter(id => id !== excludeId)
    : [...activeToasts];

  while (toastsToCheck.length >= TOAST.MAX_TOASTS) {
    const oldestToastId = toastsToCheck.shift();
    if (oldestToastId !== undefined) {
      activeToasts.delete(oldestToastId);
      reactToast.dismiss(oldestToastId);
    }
  }
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

const createToastWithLimit = (type: ToastType) => {
  return (message: string, options: ToastOptions = {}): Id => {
    const customToastId = options.toastId;

    if (customToastId && activeToasts.has(customToastId)) {
      return customToastId;
    }

    manageToastLimit(customToastId || null);

    const toastId = reactToast[type](message, {
      ...options,
      onClose: () => {
        activeToasts.delete(toastId);
        if (options.onClose) {
          options.onClose();
        }
      }
    });

    activeToasts.add(toastId);
    return toastId;
  };
};

export const toast = {
  success: createToastWithLimit('success'),
  error: createToastWithLimit('error'),
  warning: createToastWithLimit('warning'),
  info: createToastWithLimit('info'),
};
