import { Icon } from "../icons.jsx";

export function Button({
  icon,
  children,
  primary = false,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={"wb-button " + (primary ? "is-primary " : "") + className}
      {...props}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}
export function IconButton({ icon, label, ...props }) {
  return (
    <button
      type="button"
      className="wb-icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
export function Toolbar({ title, trail, children }) {
  return (
    <header className="wb-toolbar">
      <div className="wb-heading">
        <h1>{title}</h1>
        {trail && <span>{trail}</span>}
      </div>
      <div className="wb-actions">{children}</div>
    </header>
  );
}
export function Empty({ icon = "inbox", title, children }) {
  return (
    <div className="wb-empty">
      <Icon name={icon} size={25} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}
export function Graph({ compact = false }) {
  return (
    <svg
      className={"wb-graph" + (compact ? " is-compact" : "")}
      viewBox="0 0 440 260"
      role="img"
      aria-label="二次函数 y 等于 x 平方的图象"
    >
      <g stroke="#eeeeee" strokeWidth="1">
        {[60, 100, 140, 180, 220, 260, 300, 340, 380].map((x) => (
          <path key={x} d={"M" + x + " 20V240"} />
        ))}
        {[40, 80, 120, 160, 200, 240].map((y) => (
          <path key={y} d={"M30 " + y + "H410"} />
        ))}
      </g>
      <g stroke="#b8bac1" strokeWidth="1.2">
        <path d="M30 220H414l-6-3m6 3-6 3M220 240V18l-3 6m3-6 3 6" />
      </g>
      <path
        d="M78 18Q220 422 362 18"
        fill="none"
        stroke="#8170b3"
        strokeWidth="2.5"
      />
      <g fill="#737783" fontSize="12" fontFamily="serif">
        <text x="420" y="224">
          x
        </text>
        <text x="229" y="24">
          y
        </text>
        <text x="205" y="236">
          O
        </text>
        <text x="314" y="78">
          y = x²
        </text>
      </g>
    </svg>
  );
}
export function QuestionContent({ question, answers = true }) {
  return (
    <div className="wb-question-content">
      <p className="wb-math-copy">{question.body}</p>
      {question.graph && <Graph />}
      {answers && (
        <details className="wb-answer">
          <summary>答案与解析</summary>
          <p>{question.answer}</p>
          <p className="wb-secondary">{question.analysis}</p>
        </details>
      )}
    </div>
  );
}
