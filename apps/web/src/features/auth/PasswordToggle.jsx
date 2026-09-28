import { useTranslation } from 'react-i18next';

const EYE = (
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

const EYE_OFF = (
  <>
    <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-2.8 3.8" />
    <path d="M6.7 6.7A18.6 18.6 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.3-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </>
);

export default function PasswordToggle({ visible, onToggle }) {
  const { t } = useTranslation('auth');
  return (
    <button
      className="ae-password-toggle"
      type="button"
      aria-label={visible ? t("隐藏密码") : t("显示密码")}
      aria-pressed={visible}
      title={visible ? t("隐藏密码") : t("显示密码")}
      onClick={onToggle}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {visible ? EYE : EYE_OFF}
      </svg>
    </button>
  );
}
