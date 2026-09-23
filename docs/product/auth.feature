Feature: AUTH-CONTRACT@1 教师账户入口与工作台身份交接
  契约候选不代表实现通过，执行结果须区分 frontend-substitute、real-api/fake-mail 和 real-auth/real-mail。
  交换数据与状态码唯一依据 docs/contracts/auth.openapi.yaml，CC细节见 auth-cases.md。

  Background:
    Given 使用本批独立冻结的认证契约与隔离的同源HTTPS环境
    And 账户A与账户B的Cookie容器和测试数据可以独立重置

  @WB-AUTH-001 @CC-HAPPY
  Scenario: 注册后通过待激活会话交接保存昵称
    Given 注册开放且邮箱未占用
    When 教师成功取得注册码并提交规范邮箱、昵称、原始密码、验证码和条款同意
    Then 账户、挑战消费和待激活会话同时提交
    And 确认激活前工作台不能授权
    When 当前提交上下文完成会话激活
    Then 工作台显示保存昵称且context与认证accountKey一致

  @WB-AUTH-002 @CC-LOGIN-FAIL
  Scenario: 错误密码和不存在邮箱使用统一拒绝
    When 教师分别用错误密码和不存在的邮箱登录
    Then 两次都返回同一凭据拒绝
    And 页面只清密码并保留邮箱和可关闭横幅

  @WB-AUTH-003 @CC-BOUNDARY
  Scenario: 前后端共同遵守精确输入边界
    Given CC-BOUNDARY中的长度、Unicode、邮箱形状及前导零样本
    When 分别通过正式表单与直接HTTP提交这些样本
    Then 合法值按约定规范化并保存
    And 不合法值在对应字段拒绝且不消耗验证码
    And 本地可判错误不发业务请求
    And 密码不进行trim、大小写转换或Unicode归一化

  @WB-AUTH-004 @CC-BOUNDARY
  Scenario: 验证码形状和条款校验先于验证码真实性
    When 教师提交形状错误的验证码且未同意条款
    Then 页面优先显示验证码形状错误
    When 验证码改为形状合法但值错误且仍未同意条款
    Then 优先显示条款错误且尝试预算不变

  @WB-AUTH-005 @CC-SEND
  Scenario: 只有投递接受且挑战可用才进入验证码步骤
    Given 邮件提供者首次拒绝发送
    When 教师申请注册或找回验证码
    Then 页面保留第一步且不出现新的验证码挑战
    When 撤除故障后发码成功
    Then 返回完整挑战并显示绑定邮箱、有效期和冷却
    And 页面不声称邮件已到达收件箱

  @WB-AUTH-006 @CC-SEND @CC-CODE
  Scenario: 重发成功替换旧码而重发失败保留旧码
    Given 已有未过期挑战且距成功发码不足30秒
    When 教师重发验证码
    Then 请求被冷却拒绝且不投递
    When 冷却结束后的重发失败
    Then 旧挑战保持可用且不启动新冷却
    When 重发成功
    Then 旧challengeId失效且新挑战重新获得5次尝试

  @WB-AUTH-007 @CC-CODE
  Scenario: 验证码绑定与生命周期持久有效
    Given 注册和找回分别有绑定到不同邮箱的挑战
    When 错用邮箱或用途
    Then 拒绝绑定错误且不扣次数
    When 对正确绑定连续提交5次错误值
    Then 前4次显示4到1次剩余机会且第5次耗尽
    And 之后的正确值仍拒绝
    And 重启后不会恢复尝试预算
    And 服务端到期时正确值同样拒绝

  @WB-AUTH-008 @CC-CLOSED
  Scenario: 注册关闭只影响未提交的新注册
    Given 注册表单已填好并已发码
    When 服务端在注册事务裁决前关闭注册
    Then 显示明确关闭状态且账户未创建、验证码未消费
    And 已存在账户仍能登录、找回和重置
    And 已成功创建的账户不因随后关闭而消失

  @WB-AUTH-009 @CC-STORE
  Scenario Outline: 账户写入故障不留下部分业务结果
    Given 有可用于<操作>的正确验证码
    When <操作>的持久事务发生写入故障
    Then 业务返回已回滚的存储故障且挑战未消费
    And 重启读回看不到部分账户、密码或撤销结果
    When 撤除故障并用同一验证码重试
    Then <操作>成功
    Examples:
      | 操作 |
      | 注册 |
      | 重置密码 |

  @WB-AUTH-010 @CC-UNKNOWN
  Scenario Outline: 丢失业务响应后以登录恢复
    When <操作>已经提交但响应被丢弃
    Then 页面保留输入并显示结果暂未确认
    And 不自动重复业务或声称业务已回滚
    When 教师返回登录并使用刚提交的密码
    Then 能进入对应账户工作台
    And 同一挑战的再次确认被已消费结果拒绝
    Examples:
      | 操作 |
      | 注册 |
      | 重置密码 |

  @WB-AUTH-011 @CC-RACE
  Scenario: 重复触发与迟到结果不污染当前表单
    Given 登录、发码、注册或重置正在等待响应
    When 教师重复点击或按Enter
    Then 不产生第二次业务提交
    When 教师编辑字段、换邮箱或切换表单后旧响应到达
    Then 新输入和当前表单保持不变且不自动进入工作台
    And 已提交的注册或重置副作用仍可用提交凭据恢复

  @WB-AUTH-012 @CC-SESSION
  Scenario Outline: 会话寿命不依赖浏览器Session Cookie猜测
    Given 教师以<选择>完成登录和激活
    When 刷新或重新打开页面
    Then <结果>
    Examples:
      | 选择 | 结果 |
      | 不记住我 | 回到空登录卡且新的页面上下文不能使用旧身份 |
      | 记住我 | 在7天绝对有效期内先等待核验再恢复工作台 |

  @WB-AUTH-013 @CC-PENDING
  Scenario: 记住我保存失败可以继续或重试而不重做账户业务
    Given 登录或注册已成功但保存记住我失败
    Then 显示保存失败卡且明确账户业务已经完成
    When 教师选择继续当前会话或重试保存
    Then 只提交对应会话命令并重新核验当前有效性
    And 不重新登录、创建账户或消费验证码
    And 继续当前会话后刷新回到登录

  @WB-AUTH-014 @CC-PENDING @CC-RACE
  Scenario: 已重置或已放弃的待处理身份不能复活
    Given 教师处于保存失败卡
    When 该账户被重置或该目标会话被撤销
    Then 继续和重试保存都不能进入工作台
    When 教师切到新注册表单且旧会话事件或响应迟到
    Then 新表单和输入不被清空或改写

  @WB-AUTH-015 @CC-RESTORE
  Scenario: 恢复等待、故障和失效都有可恢复路径
    Given 存在可恢复的记住我会话
    When 恢复正在等待或返回可重试存储故障
    Then 不闪现登录卡或工作台且失败可重试或返回登录
    When 会话在恢复完成前到期、撤销或被移除
    Then 回到登录提示失效且迟到结果不进入工作台
    And 账户数据损坏不会恢复示例密码或示例账户

  @WB-AUTH-016 @CC-RESET @CC-ISOLATION
  Scenario: 密码重置立即撤销目标账户而不影响其他账户
    Given A在两设备和多个页面有会话且B已进入工作台
    When A成功重置密码
    Then A旧密码和所有旧会话在后续授权时无效
    And A以新密码登录后accountKey和业务数据保持
    And B的工作台与数据访问不受影响
    And 无关持久会话通知不直接退出另一账户的页面会话

  @WB-AUTH-017 @CC-LOGOUT
  Scenario: 设置退出确认、失败和重复请求
    Given A从工作台设置点击退出
    When 撤销失败或响应丢失
    Then 页面如实显示失败或未确认并允许重试原目标
    And 未确认时停止继续业务交互
    When 原目标撤销得到204确认
    Then 回到登录且刷新不能恢复旧身份
    And 重复退出和无会话退出仍为204
    And 其他独立会话保持有效

  @WB-AUTH-018 @CC-PROTOCOL @CC-ISOLATION
  Scenario: 来源保护与可信账户接缝
    When 跨源请求、伪造页面头、客户端账户键或旧Bearer凭据尝试授权
    Then 没有合法Cookie和active页面绑定就不能取得principal
    And 来源拒绝没有账户、验证码或会话副作用
    And 工作台沿用自己的401、404与503契约
    And 所有认证成功和失败响应都不缓存

  @WB-AUTH-019 @CC-UI
  Scenario: 正式三端呈现继承账户入口风格
    Given PC1440x900、平板768x1024和手机390x844
    When 逐一进入正常、字段错、横幅、等待、保存失败和恢复状态
    Then 按钮可操作且没有横向溢出或被隐藏的关键动作
    And 长邮箱和昵称不撑开卡片且全文可访问
    And 键盘、触摸、显隐和返回遵守既定行为

  @WB-AUTH-020 @EXT
  Scenario: 真实邮件和持久身份单独交付
    Given 已取得授权的真实发信配置、收件箱和同源HTTPS持久运行环境
    When 通过正式UI收取当次邮件并完成注册、找回、退出重登和服务重启
    Then 正确密码、昵称、稳定账户键和撤销状态均可复核
    And 两设备真实账户可以访问自己的持久工作台且不能访问另一账户
    And 报告不以fake-mail、test-principal或手工Cookie代替真实证据
