import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HomeIcon from '@mui/icons-material/Home';
import LockIcon from '@mui/icons-material/Lock';

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
          <HomeIcon className="text-gray-700" />
        </button>

        <h1 className="text-base sm:text-lg font-semibold truncate pr-2">
          <span className="hidden sm:inline text-gray-500 font-normal">{t('workspace:header.workspacePrefix')}</span>
          {workspaceId}
        </h1>

        {!canWrite() && (
          <div className="hidden md:flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 whitespace-nowrap">
            <LockIcon className="h-3 w-3 mr-1" />
            {t('common:permissions.readOnly')}
          </div>
        )}
      </div>
    </header>
  );
});

export default Header;
