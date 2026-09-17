export default function ModuleCard({ moduleItem, isActive, onOpen }) {
  return (
    <button className={`card module-card ${isActive ? 'active' : ''}`} onClick={onOpen}>
      <div className="module-card-top">
        <span className="module-icon">{moduleItem.icon}</span>
        <span className="badge">{moduleItem.categoryLabel || moduleItem.category}</span>
      </div>
      <h3>{moduleItem.title}</h3>
      <p className="muted">{moduleItem.description}</p>
    </button>
  );
}
