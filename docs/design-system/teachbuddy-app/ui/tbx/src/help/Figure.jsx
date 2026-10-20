import { h, Fragment } from '../shim.js';

/*
 * Small, quiet illustrations of the interface for help articles. They are
 * drawn, not screenshots: a window, a few shapes, one accent colour (the
 * topic's), so they stay sharp in both themes and never go out of date in
 * the details. All colours come from CSS variables on .tbx-fig.
 */

const W = 640;
const H = 360;

const Line = ({ x, y, w, h: ht = 7, o = 1, accent }) => (
  <rect x={x} y={y} width={w} height={ht} rx={ht / 2} fill={accent ? 'var(--fig-accent)' : 'var(--fig-ink)'} opacity={accent ? 0.9 : 0.16 * o} />
);
const Box = ({ x, y, w, h: ht, r = 12, fill = 'var(--fig-card)', stroke = true, tint }) => (
  <rect x={x} y={y} width={w} height={ht} rx={r} fill={tint ? 'var(--fig-tint)' : fill} stroke={stroke ? 'var(--fig-line)' : 'none'} />
);
const Dot = ({ x, y, r = 5, accent, fill }) => <circle cx={x} cy={y} r={r} fill={fill ?? (accent ? 'var(--fig-accent)' : 'var(--fig-ink)')} opacity={accent || fill ? 1 : 0.18} />;
const Ring = ({ x, y, r = 6, done }) => (
  <circle cx={x} cy={y} r={r} fill={done ? 'var(--fig-accent)' : 'none'} stroke={done ? 'var(--fig-accent)' : 'var(--fig-ink)'} strokeOpacity={done ? 1 : 0.28} strokeWidth="1.6" />
);

// The workbench frame: sidebar, top bar, main area.
function Frame({ children, side = true, panel = false, highlight }) {
  const hl = (part) => highlight === part;
  return (
    <>
      <rect x="0" y="0" width={W} height={H} rx="18" fill="var(--fig-canvas)" />
      {side && (
        <g>
          <Box x={12} y={12} w={128} h={H - 24} r={14} tint={hl('side')} />
          <Line x={28} y={32} w={60} h={8} o={1.4} />
          <Box x={24} y={56} w={104} h={22} r={7} fill="var(--fig-fill)" stroke={false} />
          {[96, 120, 144].map((y, i) => (
            <g key={y}><Dot x={34} y={y} r={5} accent={i === 0 && hl('side')} /><Line x={46} y={y - 3.5} w={56 - i * 8} /></g>
          ))}
          <Line x={28} y={178} w={40} h={6} o={0.6} />
        </g>
      )}
      <g>
        <Box x={side ? 152 : 12} y={14} w={130} h={24} r={12} fill={hl('top') ? 'var(--fig-tint)' : 'var(--fig-fill)'} stroke={false} />
        <Box x={W - (panel ? 260 : 196)} y={14} w={120} h={24} r={12} fill={hl('top') ? 'var(--fig-tint)' : 'var(--fig-card)'} />
        {[0, 1, 2].map((i) => <Dot key={i} x={W - (panel ? 122 : 58) + i * 18} y={26} r={5} accent={hl('top') && i === 0} />)}
      </g>
      {panel && <Box x={W - 128} y={48} w={116} h={H - 60} r={14} tint={hl('panel')} />}
      {children}
    </>
  );
}

const Main = ({ x = 152, w, children }) => (
  <g>
    <Box x={x} y={48} w={w} h={H - 60} r={14} />
    {children}
  </g>
);

const SCENES = {
  home: () => (
    <Frame>
      <Main w={476}>
        {[0, 1, 2].map((i) => <Dot key={i} x={372 + i * 16} y={96} r={5} fill={['#ffd60a', '#0a84ff', '#af52de'][i]} />)}
        <Line x={300} y={116} w={176} h={12} o={1.8} />
        <Line x={326} y={138} w={124} h={7} o={0.8} />
        <Box x={232} y={162} w={312} h={52} r={18} />
        <Line x={248} y={178} w={150} h={7} o={0.7} />
        <Dot x={528} y={200} r={8} accent />
        {[[232, 226], [392, 226], [232, 268], [392, 268]].map(([x, y]) => (
          <g key={`${x}${y}`}><Box x={x} y={y} w={152} h={34} r={10} /><Box x={x + 10} y={y + 9} w={16} h={16} r={5} tint stroke={false} /><Line x={x + 34} y={y + 13} w={84} h={7} /></g>
        ))}
      </Main>
    </Frame>
  ),
  shell: () => (
    <Frame panel highlight="side">
      <Main w={348}>
        <Line x={172} y={72} w={120} h={11} o={1.6} />
        {[100, 158, 216].map((y) => <g key={y}><Box x={172} y={y} w={308} h={46} r={10} fill="var(--fig-fill)" stroke={false} /><Line x={186} y={y + 12} w={150} /><Line x={186} y={y + 26} w={220} o={0.6} /></g>)}
      </Main>
      <Line x={W - 112} y={72} w={64} h={8} o={1.2} />
      <Line x={W - 112} y={96} w={84} h={6} o={0.6} />
      <Line x={W - 112} y={110} w={70} h={6} o={0.6} />
      <Box x={W - 118} y={H - 64} w={96} h={40} r={14} />
    </Frame>
  ),
  question: () => (
    <Frame>
      <Main w={476}>
        <Line x={176} y={74} w={140} h={12} o={1.8} />
        <Line x={176} y={106} w={400} />
        <Line x={176} y={122} w={360} />
        <rect x={176} y={140} width={150} height={22} rx={6} fill="var(--fig-tint)" />
        <text x={186} y={156} fontSize="13" fontStyle="italic" fill="var(--fig-accent)" fontFamily="Georgia, serif">y = ax² + bx + c</text>
        {[[176, 46], [230, 64], [302, 40]].map(([x, w], i) => <rect key={x} x={x} y={176} width={w} height={18} rx={9} fill={i === 0 ? 'var(--fig-tint)' : 'var(--fig-fill)'} />)}
        <line x1={176} y1={214} x2={604} y2={214} stroke="var(--fig-line)" />
        <Line x={176} y={232} w={60} h={8} o={1.2} />
        <Line x={176} y={252} w={380} o={0.7} />
        <Line x={176} y={268} w={300} o={0.7} />
        <rect x={520} y={304} width={84} height={26} rx={13} fill="var(--fig-accent)" />
      </Main>
    </Frame>
  ),
  task: () => (
    <Frame>
      <Main w={272}>
        {[72, 150, 228].map((y, i) => <g key={y}><Box x={168} y={y} w={240} h={62} r={12} fill="var(--fig-fill)" stroke={false} /><Line x={182} y={y + 14} w={110} h={8} o={1.4} /><Ring x={188} y={y + 40} r={5} done={i === 0} /><Line x={200} y={y + 37} w={120} o={0.7} /></g>)}
      </Main>
      <Box x={436} y={48} w={192} h={H - 60} r={14} />
      <rect x={450} y={62} width={50} height={18} rx={9} fill="var(--fig-tint)" />
      <Line x={450} y={94} w={120} h={11} o={1.8} />
      <Box x={450} y={118} w={164} h={92} r={12} fill="var(--fig-fill)" stroke={false} />
      {[0, 1, 2].map((i) => <g key={i}><rect x={460} y={128 + i * 28} width={14} height={14} rx={4} fill={['#ff3b30', '#0a84ff', '#ff9500'][i]} /><Line x={482} y={131 + i * 28} w={40} /><Line x={566} y={131 + i * 28} w={36} o={0.6} /></g>)}
      <Line x={450} y={226} w={50} h={8} o={1.4} />
      {[0, 1, 2].map((i) => <g key={i}><Ring x={458} y={252 + i * 24} r={6} done={i === 0} /><Line x={472} y={249 + i * 24} w={[96, 120, 80][i]} o={0.8} /></g>)}
      <rect x={560} y={316} width={54} height={20} rx={10} fill="var(--fig-accent)" />
    </Frame>
  ),
  board: () => (
    <Frame side={false}>
      {[0, 1, 2].map((c) => {
        const x = 20 + c * 204;
        return (
          <g key={c}>
            <Box x={x} y={48} w={192} h={H - 60} r={14} fill={c === 0 ? 'var(--fig-tint)' : 'var(--fig-fill)'} stroke={false} />
            <Line x={x + 14} y={66} w={56} h={9} o={1.6} />
            {[0, 1, 2].slice(0, 3 - (c === 2 ? 1 : 0)).map((r) => (
              <g key={r}>
                <Box x={x + 10} y={90 + r * 82} w={172} h={72} r={12} />
                <Dot x={x + 24} y={104 + r * 82} r={4} accent={r === 0} />
                <Line x={x + 34} y={101 + r * 82} w={40} h={6} o={0.7} />
                <rect x={x + 120} y={98 + r * 82} width={50} height={12} rx={6} fill="var(--fig-fill)" />
                <Line x={x + 20} y={118 + r * 82} w={100} h={8} o={1.4} />
                <Ring x={x + 26} y={142 + r * 82} r={5} done={r === 1} />
                <Line x={x + 38} y={139 + r * 82} w={80} h={6} o={0.6} />
                {r === 0 && c !== 1 && <rect x={x + 138} y={136 + r * 82} width={32} height={12} rx={6} fill="#ff3b30" opacity="0.85" />}
              </g>
            ))}
          </g>
        );
      })}
    </Frame>
  ),
  assistant: () => (
    <Frame>
      <Main w={476}>
        <rect x={430} y={68} width={170} height={28} rx={14} fill="var(--fig-fill)" />
        {[0, 1].map((i) => <g key={i}><circle cx={186} cy={120 + i * 22} r={5} fill="none" stroke="var(--fig-accent)" strokeWidth="1.6" /><Line x={198} y={117 + i * 22} w={[150, 110][i]} h={6} o={0.8} /></g>)}
        <Line x={176} y={174} w={380} />
        <Line x={176} y={190} w={400} />
        <Line x={176} y={206} w={260} />
        <Box x={176} y={226} w={424} h={74} r={16} fill="var(--fig-fill)" stroke={false} />
        <rect x={190} y={240} width={28} height={28} rx={8} fill="var(--fig-tint)" />
        <Line x={228} y={244} w={140} h={8} o={1.4} />
        <Line x={228} y={260} w={90} h={6} o={0.6} />
        <rect x={510} y={244} width={76} height={24} rx={12} fill="var(--fig-card)" stroke="var(--fig-line)" />
        <Line x={524} y={253} w={48} h={6} accent />
      </Main>
    </Frame>
  ),
  math: () => (
    <Frame>
      <Main w={476}>
        <line x1={190} y1={250} x2={470} y2={250} stroke="var(--fig-ink)" strokeOpacity="0.3" />
        <line x1={330} y1={72} x2={330} y2={300} stroke="var(--fig-ink)" strokeOpacity="0.3" />
        <path d="M206 92 Q330 400 454 92" fill="none" stroke="var(--fig-accent)" strokeWidth="3" strokeLinecap="round" />
        <path d="M226 92 Q330 330 434 92" fill="none" stroke="var(--fig-accent)" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="4 5" />
        <circle cx={330} cy={246} r={5} fill="var(--fig-accent)" />
        <Box x={490} y={72} w={124} h={110} r={12} fill="var(--fig-fill)" stroke={false} />
        <Line x={502} y={88} w={30} h={8} o={1.4} />
        <rect x={502} y={112} width={100} height={4} rx={2} fill="var(--fig-ink)" opacity="0.16" />
        <rect x={502} y={112} width={64} height={4} rx={2} fill="var(--fig-accent)" />
        <circle cx={566} cy={114} r={8} fill="var(--fig-card)" stroke="var(--fig-line)" />
        <Line x={502} y={140} w={30} h={8} o={1.4} />
        <rect x={502} y={160} width={100} height={4} rx={2} fill="var(--fig-ink)" opacity="0.16" />
        <circle cx={540} cy={162} r={8} fill="var(--fig-card)" stroke="var(--fig-line)" />
      </Main>
    </Frame>
  ),
  resources: () => (
    <Frame>
      <Main w={476}>
        <Line x={176} y={72} w={130} h={12} o={1.8} />
        <rect x={500} y={66} width={104} height={24} rx={12} fill="var(--fig-accent)" />
        {[0, 1, 2, 3].map((i) => {
          const x = 176 + (i % 2) * 216;
          const y = 108 + Math.floor(i / 2) * 116;
          return (
            <g key={i}>
              <rect x={x} y={y} width={204} height={74} rx={12} fill={i === 1 ? 'var(--fig-tint)' : 'var(--fig-fill)'} />
              <path d={`M${x + 120} ${y + 10} Q${x + 160} ${y + 120} ${x + 196} ${y + 10}`} fill="none" stroke="var(--fig-ink)" strokeOpacity="0.2" />
              <Line x={x + 12} y={y + 30} w={70} h={9} o={1.4} />
              <Line x={x} y={y + 86} w={120} h={8} o={1.2} />
            </g>
          );
        })}
      </Main>
    </Frame>
  ),
};

export function Figure({ kind, caption }) {
  const Scene = SCENES[kind];
  if (!Scene) return null;
  return (
    <figure className="tbx-fig">
      <div className="tbx-fig-stage">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
          <Scene />
        </svg>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/* A smaller crop for cards on the help home. */
export function FigureThumb({ kind }) {
  const Scene = SCENES[kind];
  if (!Scene) return null;
  return (
    <svg className="tbx-fig-thumb" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <Scene />
    </svg>
  );
}
