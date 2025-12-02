import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Header = React.memo(function Header({
  workspaceId,
  canWrite
}) {
  const { t } = useTranslation(['workspace', 'common']);
  const navigate = useNavigate();

  return (
    <header className="absolute top-0 left-0 z-40 p-4 pointer-events-none">
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 pointer-events-auto bg-white rounded-lg shadow-md p-2 border border-gray-200">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="p-2 rounded-md hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
          aria-label={t('common:accessibility.returnToHome')}
          title={t('common:accessibility.returnToHome')}
        >
          <svg className="text-gray-700 w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>

        <h1 className="text-base sm:text-lg font-semibold truncate pr-2">
          <span className="hidden sm:inline text-gray-500 font-normal">{t('workspace:header.workspacePrefix')}</span>
          {workspaceId}
        </h1>

        {!canWrite() && (
          <div className="hidden md:flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 whitespace-nowrap">
            <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            {t('common:permissions.readOnly')}
          </div>
        )}
      </div>
    </header>
  );
});

export default Header;
