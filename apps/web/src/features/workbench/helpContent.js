import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "workbench", ...options });
export function getHelpTopics() {
  return [
  {
    id: "questions", label: t("题库"), icon: "file",
    description: t("录入、整理和查找题目，让教学材料随时可用。"),
    destination: "/questions", action: t("进入题库"),
    articles: [
      { id: "1", title: t("自建题目"),
        body: t("在题库点击“自建”，填写标题，用段落、公式和图片组成题面，补充答案与解析，再保存题目。") },
      { id: "2", title: t("查找与复制题目"),
        body: t("从列表打开题目可继续编辑；通过题型、标签、标记与搜索查找内容。复制题目后编辑副本，原题保持不变。") },
      { id: "3", title: t("收录后校对"),
        body: t("收录材料后，请对照原稿检查题面与公式，再将校对好的题目入库。上传到设备之外前，先确认文件来源与内容。") }
    ]
  },
  {
    id: "resources", label: t("资源库"), icon: "folder",
    description: t("上传、预览与复用文件，管理教学资源。"),
    destination: "/resources", action: t("进入资源库"),
    articles: [
      { id: "1", title: t("上传与预览"),
        body: t("上传文件后，填写名称、分类、标签与备注并保存。点击条目预览，或下载原文件。") },
      { id: "2", title: t("替换资源文件"),
        body: t("替换文件保留资源条目、分类和备注。") },
      { id: "3", title: t("继续未完成的上传"),
        body: t("尚未完成的文件上传不能只靠文件名恢复。重开后如提示重选文件，请选择原文件，再确认上传结果。") }
    ]
  },
  {
    id: "math", label: t("数学工坊"), icon: "graph",
    description: t("制作公式、函数和图形，下载作品用于课堂。"),
    destination: "/math", action: t("进入数学工坊"),
    articles: [
      { id: "1", title: t("创建数学作品"),
        body: t("新建公式、函数、平面图形、空间图形或演示，在“作品与工具”调整内容、参数和样式，再保存作品。") },
      { id: "2", title: t("下载与离线使用"),
        body: t("公式与图形可输出 PNG 或 SVG，演示可下载 HTML 离线打开。下载后先打开检查显示效果，再用于课堂。") }
    ]
  },
  {
    id: "classes", label: t("班级教学"), icon: "classes",
    description: t("分别记录各班教学进度、课后情况和下一步安排。"),
    destination: "/classes", action: t("进入班级教学"),
    articles: [
      { id: "1", title: t("记录课后情况"),
        body: t("创建并选择班级，写一句课后情况即可保存。需要时补充教学进度、共性问题、下一步和关联材料。") },
      { id: "2", title: t("区分教学计划与记录"),
        body: t("不同班级的实际授课记录分别保存。课程安排表示计划，不会自动成为已授课记录。") }
    ]
  },
  {
    id: "schedule", label: t("日程与提醒"), icon: "calendar",
    description: t("安排课程与事项，管理重复课程和站内提醒。"),
    destination: "/calendar", action: t("进入日程"),
    articles: [
      { id: "1", title: t("创建课程与事项"),
        body: t("选择日期范围，在时间网格拖出时间段，填写课程或多项安排并保存。未排期事项可先记录，再安排时间。") },
      { id: "2", title: t("安排重复课程"),
        body: t("按周重复的课程可以设置结束日期。只调整某次课程时，选择对应实例，其他周保持原安排。") },
      { id: "3", title: t("查看日程提醒"),
        body: t("提醒按自行设置的时间进入顶部通知栏，不发送外部邮件。没有设置提醒的安排保持安静。") }
    ]
  },
  {
    id: "recovery", label: t("常见问题"), icon: "circleHelp",
    description: t("了解保存状态，处理冲突，导出资料与恢复误删内容。"),
    destination: "/settings", action: t("导出个人资料"),
    articles: [
      { id: "1", title: t("理解保存状态"),
        body: t("“已保存”表示服务器已确认。看到“未保存”或“草稿在此设备”时，输入只保存在当前浏览器的账户分区，同一设备重新登录可继续，其他设备不会获得这些草稿。") },
      { id: "2", title: t("确认保存结果"),
        body: t("看到“暂时无法确认是否保存”，先使用“重试确认”。系统用原请求核实结果，避免重复创建。不要清除浏览器数据来处理保存失败。") },
      { id: "3", title: t("处理版本冲突"),
        body: t("看到“内容已在别处修改”，先查看服务器版本并对照草稿。采用服务器版本会丢弃本地输入；需要保留的内容应先复制或下载。") },
      { id: "4", title: t("导出与恢复资料"),
        body: t("设置中的“您的数据”可导出已保存资料。误删内容可在对应模块的已删除列表中恢复。未保存的本设备草稿不包含在导出包内。") },
      { id: "5", title: t("退出后的草稿"),
        body: t("退出登录不会删除草稿。共享电脑上，请先保存并处理待确认操作，再退出登录。") }
    ]
  }
];
}
