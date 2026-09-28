import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'lessons', ...options });
import { useRef } from "react";
import { Icon } from "../workbench/icons.jsx";
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";

export function LessonExample({ onClose, onStart }) {
  const { t } = useTranslation('lessons');
  const ref = useRef(null);
  useModuleDialogFocus(ref, onClose);
  return (
    <div className="wb-dialog-host lesson-example-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
      <section
        ref={ref}
        className="wb-module wb-dialog lesson-example"
        role="dialog"
        aria-modal="true"
        aria-label={t("备课示例")}
      >
        <header>
          <div>
            <span className="lesson-eyebrow">{t("备课示例")}</span>
            <h2>{t("example.topic")}</h2>
          </div>
          <button
            className="wb-icon-button"
            aria-label={t("关闭示例")}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="lesson-example-intro">
          {t("example.introduction")}
        </p>
        <section>
          <span className="lesson-step-number">1</span>
          <div>
            <h3>{t("example.observeTitle")}</h3>
            <p>
              {t("example.observeBody")}
            </p>
          </div>
        </section>
        <section>
          <span className="lesson-step-number">2</span>
          <div>
            <h3>{t("example.explainTitle")}</h3>
            <p>
              {t("example.explainBody")}
            </p>
            <div className="lesson-example-question">
              {t("example.question", { formula: "f(x) = 2x + 1" })}
            </div>
          </div>
        </section>
        <section>
          <span className="lesson-step-number">3</span>
          <div>
            <h3>{t("example.practiceTitle")}</h3>
            <p>
              {t("example.practiceBody")}
            </p>
          </div>
        </section>
        <footer>
          <span>{t("新建后按自己的内容填写，环节可以自由调整。")}</span>
          <button className="wb-button is-primary" onClick={onStart}>
            {t("开始我的备课")}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function LessonIdentity({ title = t("备课"), subtitle, children }) {
  return (
    <header className="lesson-page-heading">
      <div className="lesson-page-identity">
        <span className="lesson-page-icon">
          <Icon name="prep" size={24} />
        </span>
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </header>
  );
}
