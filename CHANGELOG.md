# Changelog

## v2.0.0 (2026-04-13)

### 新功能
- **IO2P 自动 Prompt 工程页面**：上传 IO 样本，推理模型自动生成最优 Prompt，支持多轮迭代优化
- **批量数据管理**：CSV 上传后以抽屉式列表展示，支持展开/折叠、内联编辑、全选/全不选、焦点导航
- **批量运行与 Output 列表化**：选中多条数据批量运行，Output 以列表形式逐条展示结果和进度
- **全局大模型配置面板**：页面顶部可展开的全局配置，各模块可继承或单独覆盖
- **并发控制**：所有模型配置新增并发数参数，智能检测同模型并发冲突
- **联动运行锁定**：两模块间锁定按钮，锁定后中间总控按钮统一启停，带跑道指示灯动效
- **System Prompt 分离**：参数配置中新增 System Prompt 输入，卡片内 textarea 改为 User Prompt
- **同步方向动效**：同步按钮点击后显示飞行箭头动画，区分 Input/Prompt 位置
- **停止运行按钮**：运行中可点击停止，支持 AbortController 取消 fetch 请求
- **批量数据导出**：导出 CSV 含运行结果（_output、_status、_latency 列），带 UTF-8 BOM
- **CSV 模板下载**：Input 卡片旁新增模板下载按钮，含 5 条中文测试数据
- **访问统计**：后端 Express 服务统计总访问量和独立访客数
- **街机风格 popup**：Agent popup 模式顶栏深色霓虹风格，按钮点击触发魂斗罗闪屏效果

### 改进
- **反馈上下文增强**：Agent 反馈上下文包含双模块完整链路信息（Input、Prompt、Output、模型参数）
- **Agent 状态保持**：反馈提交后不再自动切换为 popup，保持当前显示状态
- **Agent 参数调优**：Agent 同时建议调整模型参数，应用时一并更新
- **模块三参数配置**：从全屏抽屉改为卡片内 v-if 切换面板，参数扩展为完整集
- **同步图标统一**：四个同步按钮统一使用 icon-sync
- **预期输出对比**：CSV 含 expected_output 列时，Output 展开显示绿色预期输出对比区
- **CSV 同步修复**：Input 同步现在会深拷贝 csvData 到目标模块
- **进度溢出修复**：批量运行进度百分比限制不超过 100%

### 基础设施
- 新增 Vitest + fast-check 测试框架
- 新增工具模块：dataHelpers、configManager、concurrencyQueue、batchRunner、harnessPrompt、io2pEngine
- 新增后端统计服务（Express + pm2，端口 8081）
- 版权声明：© 2026 Timekettle SEG
