export default function WorkspaceSettingsPanel({ modules, layout, onToggleVisibility }) {
  const hiddenModuleIds = new Set(layout?.hiddenModuleIds || []);

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <p className="eyebrow">工作台设置</p>
          <h2>工作台设置</h2>
          <p className="muted">核心入口和个人布局始终保留在工作台外壳中。</p>
        </div>
      </div>

      <div className="card visibility-list">
        <div className="section-header">
          <div>
            <h2>模块可见性</h2>
            <p className="muted">分组、排序和模块移动可以直接在左侧栏完成。</p>
          </div>
          <span className="badge">核心入口和设置始终可见</span>
        </div>
        {modules.map((moduleItem) => {
          const isVisible = !hiddenModuleIds.has(moduleItem.id);
          return (
            <label className="visibility-row" key={moduleItem.id}>
              <input
                type="checkbox"
                aria-label={moduleItem.title}
                checked={isVisible}
                onChange={(event) => onToggleVisibility(moduleItem.id, event.target.checked)}
              />
              <span className="module-icon">{moduleItem.icon}</span>
              <span className="visibility-copy">
                <strong>{moduleItem.title}</strong>
                <span className="muted">{moduleItem.description}</span>
              </span>
              <span className="badge">{isVisible ? '显示中' : '已隐藏'}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
