import build from 'virtual:teachbuddy-build';
import { followAnchor } from './routes.js';
import { useScene } from './useScene.js';
import { useScrollRestore } from './useScrollRestore.js';
import { useWorkbenchShell } from './shellContext.js';

const articles = [
  ['questions', '录题与整理题库', '/questions', '进入题库', [
    '在题库点击“自建”，填写标题，用段落、公式和图片组成题面，补充答案与解析，再保存题目。',
    '从列表打开题目可继续编辑；通过题型、标签、标记与搜索查找内容。复制题目后编辑副本，原题保持不变。',
    '收录材料后，请对照原稿检查题面与公式，再将校对好的题目入库。上传到设备之外前，先确认文件来源与内容。'
  ]],
  ['lessons', '备课、取材与输出', '/lessons', '进入备课', [
    '新建备课，填写课题并添加教学环节。在环节中从题库取题、从资源库取材，或制作数学作品；采用后返回原环节继续编辑。',
    '已采用的材料保存为本课快照。修改源题目、资源或作品后，需在备课中明确采用新版，不会悄悄改变原文稿。',
    '在“输出”选择成果类型及 DOCX 或 PDF，按需要包含答案解析与教师注记，点击“保存并生成”。完成后下载；重新打开备课的输出面板可找回任务和成果。'
  ]],
  ['resources', '资源上传与复用', '/resources', '进入资源库', [
    '上传文件后，填写名称、分类、标签与备注并保存。点击条目预览，或下载原文件。',
    '替换文件保留资源条目与关联；已有备课继续使用原来采用的内容，需要时明确采用新版本。',
    '尚未完成的文件上传不能只靠文件名恢复。重开后如提示重选文件，请选择原文件，再确认上传结果。'
  ]],
  ['math', '数学作品与下载', '/math', '进入数学工坊', [
    '新建公式、函数、平面图形、空间图形或演示，在“作品与工具”调整内容、参数和样式，再保存作品。',
    '公式与图形可输出 PNG 或 SVG，演示可下载 HTML 离线打开。下载后先打开检查显示效果，再用于课堂。',
    '从备课进入制作时，保存后使用返回备课的入口，将作品带回对应环节。'
  ]],
  ['classes', '记录班级教学', '/classes', '进入班级教学', [
    '创建并选择班级，写一句课后情况即可保存。需要时补充教学进度、共性问题、下一步和关联材料。',
    '不同班级的实际授课记录分别保存。课程安排表示计划，不会自动成为已授课记录。'
  ]],
  ['schedule', '日程与提醒', '/calendar', '进入日程', [
    '选择日期范围，在时间网格拖出时间段，填写课程或多项安排并保存。未排期事项可先记录，再安排时间。',
    '按周重复的课程可以设置结束日期。只调整某次课程时，选择对应实例，其他周保持原安排。',
    '提醒按自行设置的时间进入顶部通知栏，不发送外部邮件。没有设置提醒的安排保持安静。'
  ]],
  ['recovery', '保存失败、草稿与重开', '/settings', '管理本设备草稿', [
    '“已保存”表示服务器已确认。看到“未保存”或“草稿在此设备”时，输入只保存在当前浏览器的账户分区，同一设备重新登录可继续，其他设备不会获得这些草稿。',
    '看到“暂时无法确认是否保存”，先使用“重试确认”。系统用原请求核实结果，避免重复创建。不要清除浏览器数据来处理保存失败。',
    '看到“内容已在别处修改”，先查看服务器版本并对照草稿。采用服务器版本会丢弃本地输入；需要保留的内容应先复制或下载。',
    '设置中的清理只处理当前账户的设备资料，不删除服务器内容。尚未确认的请求和必要输入会保留；损坏或不支持的资料也会保留供下载检查。',
    '退出登录不会删除草稿。共享电脑上，请先保存并处理待确认操作，再清理本设备资料并退出。'
  ]]
];

export function SupportHelp() {
  const shell = useWorkbenchShell();
  const [scene, patch] = useScene(shell.accountKey, 'help', { article: 'questions', scrollTop: 0 });
  const current = articles.find(item => item[0] === scene.article) || articles[0];
  const scroll = useScrollRestore(scene.scrollTop, top => patch({ scrollTop: top }), current[0]);
  return <div className="wb-support wb-help" data-region="help">
    <header><h1>使用帮助</h1><p>从日常备课到课堂记录</p></header>
    <div className="wb-help-layout">
      <nav aria-label="帮助目录">{articles.map(([id, title]) => <button key={id} className={id === current[0] ? 'is-active' : ''}
        onClick={() => { patch({ article: id, scrollTop: 0 }); if (scroll.ref.current) scroll.ref.current.scrollTop = 0; }}>{title}</button>)}</nav>
      <article {...scroll} className="wb-help-article"><h2>{current[1]}</h2>
        <ol>{current[4].map(text => <li key={text}>{text}</li>)}</ol>
        <a className="wb-button" href={current[2]} onClick={event => followAnchor(event, current[2])}>{current[3]}</a>
      </article>
    </div>
  </div>;
}

export function SupportReleases() {
  return <div className="wb-support wb-releases" data-region="releases">
    <header><h1>版本记录</h1><p>当前构建 {build.version} · {build.commit.slice(0, 12)}{build.dirty ? ' · 含本地改动' : ''}</p></header>
    <p className="wb-note">{build.tag ? `发布标记：${build.tag}` : '当前构建未标记正式发布。以下是此构建包含的实际提交记录。'}</p>
    <ol className="wb-release-list">{build.changes.map(change => <li key={change.sha}>
      <time dateTime={change.date}>{change.date.slice(0, 10)}</time>
      <div><h2>{change.title}</h2><code>{change.sha.slice(0, 12)}</code></div>
    </li>)}</ol>
  </div>;
}
