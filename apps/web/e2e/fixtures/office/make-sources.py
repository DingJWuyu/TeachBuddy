"""Compose the fixed six documents as Markdown; Pandoc owns math conversion."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
F = json.loads((ROOT / 'source/latex.json').read_text())
def math(key):
    return '$' + F[key] + '$'

BREAK = '\n\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n\n'
def heading(text):
    return '\n\n## ' + text + '\n\n'

def image(name, width):
    return f'\n\n![](assets/{name}.png){{width={width}px}}\n\n'

Q2IMAGE = image('q2-parabola', 320) + '原图待校对：图像与题面解析式存在疑点，请核对原稿。\n\n'
Q1 = heading('Q1') + f'求函数 {math("fraction")} 的定义域。\n\n选项 A [1/2,+∞)；B [1/2,2)∪(2,+∞)；C (1/2,2)∪(2,+∞)；D (-∞,2)∪(2,+∞)。'
Q2 = heading('Q2') + f'已知 {math("quadratic")}，配坐标轴与抛物线图，标出顶点和两个横轴交点。' + Q2IMAGE + '（1）求零点；（2）写出单调递增区间。'
Q3 = heading('Q3') + math('piecewise') + '\n\n若 $f(-2)=3$，求 a 和 f(1)。使用真正两行分段公式。'
Q4 = heading('Q4') + f'解不等式 {math("log")}。'
Q5 = heading('Q5') + '如图，直角三角形 ABC，∠A=90°。求 BC 的长及 tan B。图中 AB=4，AC=3。' + image('q5-triangle', 240)
Q6 = heading('Q6') + f'正方体 ABCD-A₁B₁C₁D₁ 的棱长为 2。求体对角线 {math("cube")} 的长及体积，并参考空间示意图。' + image('q6-cube', 270)
ANSWERS = heading('已有答案解析') + f'''C22答案解析

Q1：B。根号内非负且分母不为零。

Q2：零点为 -1、3，单调递增区间为 [1,+∞)；{math('vertex')}。

Q3：a=-1，f(1)=0。

Q4：1<x≤3。

Q5：BC=5，tan B=3/4。

Q6：原材料未提供答案，保留 absent。
'''

for teacher in (False, True):
    role = 'teacher' if teacher else 'student'
    label = '教师版' if teacher else '学生版'
    lesson = heading('教学目标') + '• 能从解析式读取二次函数的零点和顶点。\n\n• 能用配方法解释图像的平移。'
    lesson += heading('活动流程')
    lesson += ('| 环节 | 活动 | 提示 |\n|---|---|---|\n| 导入 | 观察二次函数图像 | 先找横轴交点 |\n| 探究 | 完成配方 | 核对顶点 |' if teacher else
               '| 环节 | 活动 | 产出 |\n|---|---|---|\n| 导入 | 观察二次函数图像 | 标记两个零点 |\n| 探究 | 完成配方 | 写出顶点 |')
    lesson += heading('核心例题 Q2') + f'已知 {math("quadratic")}，求零点并写出单调递增区间。' + Q2IMAGE + BREAK
    lesson += (heading('C22教师注记-勿发学生') + '先让学生从图像观察，再要求写出 x=-1 与 x=3。' + heading('C22答案解析') + f'零点为 -1、3；顶点为 {math("vertex")}；单调递增区间为 [1,+∞)。' if teacher else
               '作答：______________________________\n\n仍不清楚的问题：____________________')

    handout = heading('例 1：分式与根式') + f'函数 {math("fraction")} 的定义域需要同时满足两个条件。'
    if not teacher:
        handout += '\n\n我的判断：______________________________'
    handout += heading('例 2：二次函数') + f'已知 {math("quadratic")}。' + Q2IMAGE
    handout += '（1）求零点：____________________\n\n（2）写出单调递增区间：____________'
    handout += heading('例 3：分段函数') + math('piecewise') + '\n\n若 f(-2)=3，求 a 和 f(1)。'
    if teacher:
        handout += BREAK + heading('C22答案解析') + f'例 1：根式与分母条件由 {math("fraction")} 给出。\n\n例 2：零点为 -1、3，单调递增区间为 [1,+∞)，配方为 {math("vertex")}。\n\n例 3：a=-1，f(1)=0。'
        handout += heading('C22教师注记-勿发学生') + '检查学生是否先写定义域条件，再进行单调性判断。'
    else:
        handout += '\n\n作答：______________________________'
    handout += ('' if teacher else BREAK) + heading('独立公式编辑验证') + math('standalone') + heading('例 4：对数不等式')
    handout += f'解 {math("log")}。\n\n作答：______________________________'

    practice = Q1 + Q2 + BREAK + Q3 + Q4 + BREAK + Q5 + Q6
    if teacher:
        practice += BREAK + ANSWERS + heading('C22教师注记-勿发学生') + 'Q5 要求学生同时读到 AB=4 和 AC=3；Q6 的答案不写回学生版。'

    for kind, title, body in [('lesson', '教案提纲', lesson), ('handout', '导学案讲义', handout), ('practice', '练习', practice)]:
        # Escaping answer-space underscores prevents Markdown emphasis parsing.
        body = re.sub(r'_{12,}', lambda match: r'\_' * len(match[0]), body)
        (ROOT / f'source/{kind}-{role}.md').write_text(f'# {title} - {label} - Pandoc\n\n{body}\n', encoding='utf-8')
