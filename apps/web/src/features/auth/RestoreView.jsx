import { useTranslation } from 'react-i18next';

import BrandMark from './BrandMark.jsx';
import AuthEntryLayout from './AuthEntryLayout.jsx';
import { COPY } from './presentation.js';

/*
 * Neutral entry placeholder, restore waiting and restore failure.
 * The boot placeholder deliberately renders neither the login card nor the
 * workbench, so the first state read cannot flash the wrong surface.
 */
export function BootCard() {
  return (
    <AuthEntryLayout surface="boot">
      <div className="ae-shell">
        <header className="ae-brand">
          <BrandMark />
        </header>
        <div className="ae-card ae-boot-card" aria-busy="true" />
      </div>
    </AuthEntryLayout>
  );
}

export default function RestoreCard({ checking, message, onRetry, onReturn }) {
  const { t } = useTranslation('auth');
  return (
    <AuthEntryLayout surface={checking ? 'restoring' : 'restore-failed'} expression={checking ? 'busy' : 'error'}>
      <div className="ae-shell">
        <header className="ae-brand">
          <BrandMark />
        </header>
        <div className="ae-card ae-restore-card">
          <div className="ae-card-head">
            <h1>{checking ? t("恢复登录状态") : t("恢复失败")}</h1>
          </div>
          {checking ? (
            <p className="ae-restore-message" role="status">{t("正在恢复登录状态，请稍候…")}</p>
          ) : (
            <>
              <p className="ae-restore-message" role="alert">{message || COPY.restoreFailed}</p>
              <div className="ae-restore-actions">
                <button className="ae-primary" type="button" onClick={onRetry}>{t("重试")}</button>
                <button className="ae-send is-block" type="button" onClick={onReturn}>{t("返回登录")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </AuthEntryLayout>
  );
}
