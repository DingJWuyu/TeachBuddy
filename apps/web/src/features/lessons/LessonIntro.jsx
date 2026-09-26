import { useRef } from "react";
import { Icon } from "../workbench/icons.jsx";
import { useModuleDialogFocus } from "../workbench/ModuleMotion.jsx";

export function LessonExample({ onClose, onStart }) {
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
        aria-label="备课示例"
      >
        <header>
          <div>
            <span className="lesson-eyebrow">备课示例</span>
            <h2>函数的单调性</h2>
          </div>
          <button
            className="wb-icon-button"
            aria-label="关闭示例"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="lesson-example-intro">
          从图像观察增减变化，再用数学语言描述。整理好自己的课稿后，可以生成教案、讲义或练习。
        </p>
        <section>
          <span className="lesson-step-number">1</span>
          <div>
            <h3>观察图像</h3>
            <p>
              展示熟悉的函数图像，请学生描述：自变量增加时，函数值怎样变化？
            </p>
          </div>
        </section>
        <section>
          <span className="lesson-step-number">2</span>
          <div>
            <h3>例题讲解</h3>
            <p>
              在这里加入题库中的例题，题面直接显示在课稿里，答案可以按需展开。
            </p>
            <div className="lesson-example-question">
              判断函数 f(x) = 2x + 1 的单调性，并说明理由。
            </div>
          </div>
        </section>
        <section>
          <span className="lesson-step-number">3</span>
          <div>
            <h3>课堂练习</h3>
            <p>
              加入练习题，留出学生作答空间。只给自己看的提醒可以写成教师注记。
            </p>
          </div>
        </section>
        <footer>
          <span>新建后按自己的内容填写，环节可以自由调整。</span>
          <button className="wb-button is-primary" onClick={onStart}>
            开始我的备课
          </button>
        </footer>
      </section>
    </div>
  );
}

export function LessonIdentity({ title = "备课", subtitle, children }) {
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
