import StatCard from '../../components/StatCard.jsx';

function buildCoreContext(moduleItem, moduleData, templates) {
  return {
    module: moduleItem,
    items: moduleData[moduleItem.id] || [],
    templates
  };
}

export default function DashboardPanel({ modules, moduleData, templates, onOpenModule }) {
  const contexts = modules.map((moduleItem) => buildCoreContext(moduleItem, moduleData, templates));
  const stats = contexts.flatMap((context) => (
    (context.module.coreEntry?.stats || []).map((stat) => ({ ...stat, context }))
  ));
  const cards = contexts.flatMap((context) => (
    (context.module.coreEntry?.cards || []).map((card) => ({ ...card, context }))
  ));
  const quickActions = contexts.flatMap((context) => (
    (context.module.coreEntry?.quickActions || []).map((action) => ({ ...action, context }))
  ));
  const groupedCards = cards.reduce((groups, card) => {
    const group = card.group || 'default';
    const current = groups.get(group) || [];
    current.push(card);
    current.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    groups.set(group, current);
    return groups;
  }, new Map());

  return (
    <section className="panel-stack">
      <section className="stats-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.id}
            label={stat.label}
            value={stat.value(stat.context)}
            hint={stat.hint}
          />
        ))}
      </section>

      <div className="card split-card align-center">
        <div>
          <p className="eyebrow">快速开始</p>
          <h2>选择下一步</h2>
        </div>
        <div className="inline-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className={action.variant === 'primary' ? 'primary-button' : 'ghost-button'}
              onClick={() => onOpenModule(action.targetModuleId)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {[...groupedCards.entries()].map(([group, groupCards]) => (
        <div className="dashboard-grid" key={group}>
          {groupCards.map((card) => {
            const items = card.items(card.context);
            return (
              <div className="card list-card" key={card.id}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow">{card.eyebrow}</p>
                    <h3>{card.title}</h3>
                  </div>
                </div>
                {items.map((item) => (
                  <div key={item.id} className="item-card compact">
                    <strong>{card.itemTitle(item)}</strong>
                    <p className="muted">{card.itemMeta(item)}</p>
                  </div>
                ))}
                {card.footer && <p className="muted tiny-text">{card.footer(card.context)}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
