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
      <div className="header-panel pointer-events-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="header-home-btn"
          aria-label={t('common:accessibility.returnToHome')}
          title={t('common:accessibility.returnToHome')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </button>

        <div className="header-divider" />

        <h1 className="header-title">
          <span className="header-title-prefix">{t('workspace:header.workspacePrefix')}</span>
          <span className="header-workspace-id">{workspaceId}</span>
        </h1>

        {!canWrite() && (
          <div className="header-readonly-badge">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            <span>{t('common:permissions.readOnly')}</span>
          </div>
        )}
      </div>
    </header>
  );
});

export default Header;
