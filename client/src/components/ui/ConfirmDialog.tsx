import React, { useEffect, useRef, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type DialogVariant = 'danger' | 'warning' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

interface VariantStyle {
  icon: string;
  button: string;
}

const ConfirmDialog = React.memo(function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger'
}: ConfirmDialogProps) {
  const { t } = useTranslation(['messages', 'common']);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const defaultTitle = title || t('messages:confirmDialog.title');
  const defaultMessage = message || t('messages:confirmDialog.defaultMessage');
  const defaultConfirmText = confirmText || t('common:buttons.confirm');
  const defaultCancelText = cancelText || t('common:buttons.cancel');

  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantStyles: Record<DialogVariant, VariantStyle> = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500'
    },
    primary: {
      icon: 'text-blue-500',
      button: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
    }
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
      >
        <div className="p-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 ${styles.icon}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-gray-900"
              >
                {defaultTitle}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {defaultMessage}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {defaultCancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
          >
            {defaultConfirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default ConfirmDialog;
