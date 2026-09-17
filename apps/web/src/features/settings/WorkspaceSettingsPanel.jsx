export default function WorkspaceSettingsPanel({ modules, layout, onToggleVisibility }) {
  const hiddenModuleIds = new Set(layout?.hiddenModuleIds || []);

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <p className="eyebrow">工作台设置</p>
          <h2>管理功能模块</h2>
          <p className="muted">隐藏只整理工作台界面，不会停止模块的数据、自动行为或跨模块协作。</p>
        </div>
        <span className="badge">{modules.length} 个模块</span>
      </div>

      <div className="card visibility-list">
        <div className="section-header">
          <div>
            <h2>工作台设置</h2>
            <p className="muted">选择要显示在侧栏和工作台首页中的模块。</p>
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
