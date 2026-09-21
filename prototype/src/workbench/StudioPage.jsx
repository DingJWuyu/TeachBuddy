import { useRef } from "react";
import { modulePath, navigate } from "../routes.js";
import { useWorkspace, newId } from "./context.js";
import { Button, Toolbar } from "./ui.jsx";

// One self-contained fixture, not a generic math editor or a chosen skill.
const PARABOLA_HTML = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>*{box-sizing:border-box}body{margin:0;padding:32px;font:14px system-ui;color:#30333a;background:#fff}h2{font-size:22px;font-weight:500;margin:0 0 6px}p{color:#81848d}svg{display:block;width:100%;height:55vh;min-height:220px}label{display:flex;align-items:center;gap:12px;white-space:nowrap;max-width:430px;margin:22px auto}input{width:100%;min-width:0;accent-color:#8170b3}button{flex:none;border:1px solid #e4e4e8;background:#fff;border-radius:6px;padding:6px 12px;color:#555;cursor:pointer}</style><h2>让图象动起来</h2><p>观察参数 a 变化时，图象的位置如何改变。</p><svg viewBox="0 0 600 340" aria-label="平移二次函数图象"><defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#ededf0"/></pattern></defs><rect width="600" height="340" fill="url(#grid)"/><path d="M0 280H600M300 0V340" stroke="#b4b7c0"/><polyline id="curve" fill="none" stroke="#8170b3" stroke-width="3"/><text x="580" y="270" fill="#777">x</text><text x="310" y="18" fill="#777">y</text><text x="420" y="45" fill="#8170b3" font-size="20">y = (x − a)²</text></svg><label>a = <output id="v">0</output><input aria-label="参数 a" id="a" type="range" min="-3" max="3" step="0.1" value="0"><button id="reset">重置</button></label><script>const a=document.getElementById('a'),c=document.getElementById('curve');function draw(){document.getElementById('v').textContent=a.value;let points=[];for(let px=0;px<=600;px+=2){let x=(px-300)/45;points.push(px+','+(280-25*(x-Number(a.value))**2))}c.setAttribute('points',points.join(' '))}a.oninput=draw;document.getElementById('reset').onclick=()=>{a.value=0;draw()};draw();</script></html>`;

export default function StudioPage() {
  const w = useWorkspace();
  const upload = useRef(null);
  const viewer = useRef(null);
  const work = w.works.find((item) => item.id === w.workId) || w.works[0];
  async function importHtml(event) {
    const file = event.target.files[0];
    if (!file) return;
    const item = {
      id: newId("w"),
      name: file.name.replace(/\.html?$/i, ""),
      type: "HTML 演示",
      html: await file.text(),
    };
    w.setWorks((items) => [...items, item]);
    w.setWorkId(item.id);
    event.target.value = "";
  }
  function returnToLesson() {
    w.attach("works", [work.id], w.returnTarget);
    w.setLessonId(w.returnTarget.lessonId);
    navigate(modulePath("prep"));
  }
  return (
    <div className="wb-module">
      <Toolbar title="数学工坊" trail={work.name}>
        {w.returnTarget && (
          <Button icon="arrowLeft" onClick={returnToLesson}>
            插入并返回备课
          </Button>
        )}
        <Button icon="upload" onClick={() => upload.current?.click()}>
          导入 HTML
        </Button>
        <Button
          primary
          icon="expand"
          onClick={() => viewer.current?.requestFullscreen?.()}
        >
          展示
        </Button>
      </Toolbar>
      <input
        ref={upload}
        hidden
        type="file"
        accept=".html,.htm"
        onChange={importHtml}
      />
      <div className="wb-studio-viewer" ref={viewer}>
        {w.works.map((item) => (
          <div
            key={item.id}
            className="wb-work-frame"
            hidden={item.id !== work.id}
          >
            {item.id === "w2" ? (
              <div className="wb-formula-work">
                <span className="wb-eyebrow">函数的单调性</span>
                <h2>用符号表达变化</h2>
                <p>任意 x₁, x₂ ∈ I，若 x₁ &lt; x₂，</p>
                <p className="wb-large-formula">f(x₁) &lt; f(x₂)</p>
                <p>则函数 f(x) 在区间 I 上单调递增。</p>
              </div>
            ) : (
              <iframe
                title={item.name}
                sandbox="allow-scripts"
                srcDoc={item.html || PARABOLA_HTML}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
