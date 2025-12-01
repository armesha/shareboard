import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = React.memo(function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLang = i18n.language?.startsWith('cs') ? 'cs' : 'en';
  const nextLang = currentLang === 'cs' ? 'en' : 'cs';
  const displayText = currentLang === 'cs' ? 'CZ' : 'EN';

  const handleToggle = () => {
    i18n.changeLanguage(nextLang);
    localStorage.setItem('shareboardLanguage', nextLang);
  };

  return (
    <button
      onClick={handleToggle}
      className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150"
      aria-label={`Switch language to ${nextLang === 'cs' ? 'Czech' : 'English'}`}
      title={`Switch to ${nextLang === 'cs' ? 'Čeština' : 'English'}`}
    >
      {displayText}
    </button>
  );
});

export default LanguageSwitcher;
