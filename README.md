# 辊面铸钉点位编辑器

针对辊压机辊面拼图（2048 × 18611 超长图）的 bbox 点位编辑工具：读取算法输出的
sahi 预测 JSON，在图上绘制全部方框，支持拖动 / 缩放 / 新增 / 删除，并按空间位置
（从上到下、从左到右）批量编号，最后导出带编号的 JSON。

技术栈：React 19 + TypeScript + Vite 8 + react-konva（Konva 10）+ zustand + @tanstack/react-virtual + lucide-react

## 快速开始

**环境要求**：Node.js **20.19+ 或 22.12+**（Vite 8 的硬性要求，注意不含 21.x；本项目开发使用的是 22.20）。终端执行 `node -v` 确认版本。

**1. 安装依赖**（首次拉下代码、或 `package.json` 变更后执行）

```bash
npm install
```

**2. 启动开发服务器**

```bash
npm run dev
```

启动成功后终端会打印 `Local: http://127.0.0.1:5173`，**浏览器打开这个地址**即可使用。

**3. 停止**

在终端按 `Ctrl+C`。

### 启动后的注意事项

- **首次加载要等几秒**：默认图片 67MB（2048 × 18611），浏览器需要时间解码，画布显示"正在加载图像…”属正常现象
- **默认数据自动加载**：启动后自动读取 `public/roller.png` + `public/predictions.json`（897 个框），无需任何操作
- **端口被占用**：`npm run dev -- --port 5174` 换一个端口，或修改 `vite.config.ts` 里的 `port`
- **要局域网内访问**：把 `vite.config.ts` 里的 `host` 从 `127.0.0.1` 改成 `0.0.0.0`

### 换一批数据

两种方式，任选其一：

1. **覆盖默认文件**：把新图片命名为 `roller.png`、预测 JSON 命名为 `predictions.json`，复制到 `public/` 目录覆盖旧文件，刷新页面
2. **界面内加载**：工具栏「打开图片」/「导入 JSON」选择文件，或把文件直接拖进画布

## 构建与部署

```bash
npm run build      # 产物在 dist/，纯静态文件
npm run preview    # 本地预览构建产物
```

`dist/` 是纯静态资源，丢到任意内网静态服务器（nginx 等）即可，无需 Node 环境。
注意：部署时要把 `public/roller.png` 一并带上（`npm run build` 会自动拷贝 `public/` 内容到 `dist/`）。

## 界面说明

- **顶部工具栏**：打开图片 / 导入 JSON / 导出 JSON；缩放（－ 当前百分比 ＋ 适应宽度）；排序编号 / 清除编号；撤销 / 重做
- **左侧点位列表**：支持全部 / 原有 / 新增过滤；虚拟滚动不卡；每行显示编号、起始点坐标、宽 × 高（悬停查看完整说明）；单击行定位到画布，Ctrl 多选，Shift 范围选
- **中间画布**：右侧竖条为全局缩略图（点击/拖动跳转）；右下角为浮动工具 Dock
- **右侧属性面板**：选中单个方框时显示左上角 / 右下角坐标（可直接编辑）、宽 × 高、中心点、置信度、类别、编号
- **底部状态栏**：缩放比例、光标坐标、可见范围、点位数与选中数、颜色图例

**右下角浮动工具 Dock**（同一个深色容器内，仅图标 + tooltip）：

- **按键**（大方块）：排序编号（打开编号弹窗）/ 清除编号（无编号时置灰）
- **工具 tab 组**：选择（V）/ 画新框（D）/ 平移（H，或按住空格拖动）
- **编号显示 tab 组**：显示编号 / 隐藏编号（眼睛图标）
- 每组各有一个滑动指示器，激活工具与键盘快捷键状态双向联动

## 操作说明

| 操作 | 方式 |
| --- | --- |
| 平移 | 滚轮滚动 / 中键拖动 / 按住空格拖动 / H 切平移模式 |
| 缩放 | Ctrl+滚轮（以光标为中心）/ 工具栏 ＋ － 百分比 / F 适应宽度 |
| 选择 | 单击方框；Ctrl 多选；空白处拖拽 = 框选；列表单击定位 |
| 移动 | 拖动方框；多选后一起拖动；方向键微移 1px（Shift 10px） |
| 改大小 | 单选后拖 8 个手柄 |
| 新增 | D 进入画框模式后拖拽；Esc 取消 |
| 删除 | Del / Backspace |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Shift+Z |
| 编号 | Dock 上的「排序编号」按键：行容差 20~160px、每行偏移量可调 |
| 导出 | 工具栏「导出 JSON」，文件名自动带时间戳（`annotations_annotated_YYYYMMDD_HHmmss.json`），保留原始字段并新增 index，按编号排序 |

**JSON 往返**：导出的文件带 `index`（编号）和 `manual`（人工新增）字段，再次导入时会自动应用——
编号直接显示、人工框显示为蓝色，不需要重新排序。导入提示会写明“已导入 N 个点位（编号 X，人工 Y）”。

**框颜色**：绿色 = JSON 已有的点位，蓝色 = 人工新增的点位，黄色 = 选中。缩略图和列表同样区分。

## 排序算法

`src/lib/sorting.ts`：从上到下一行一行编号（横向排列），行内从左到右。
每行有独立的参考偏移量（图像 Y 坐标，像素）：点归入"偏移量最近且距离 ≤ 行容差"的行
（容差默认 70px，可在弹窗里 20~160px 调整），行中心不齐时可直接修改某一行的偏移量，
实时预览每行点数后再应用。

铸钉是错位砖式排列（行距 ~140px、行内距 ~250px、相邻行错半格），默认 70px 容差
在本数据上自动聚为 131 行，每行 2~8 个。

算法校验：`npm run check:sort`（打印不同容差下的行数分布、编号连续性）。

## 目录

```
public/roller.png                默认图片（67MB，2048×18611）
public/predictions.json          默认预测结果（897 个框）
src/lib/sorting.ts               空间排序算法（行偏移量分配）
src/lib/jsonio.ts                JSON 解析 / 导出
src/lib/colors.ts                配色定义（绿=已有 / 蓝=新增 / 黄=选中）
src/lib/geometry.ts              几何工具（矩形相交等）
src/lib/loaders.ts               图片 / JSON 文件加载
src/store/useStore.ts            全局状态（数据 / 视图 / 历史栈）
src/hooks/useKeyboard.ts         全局快捷键
src/components/AnnotationStage.tsx  画布：视口渲染、框编辑、框选/平移/绘制
src/components/ToolDock.tsx      右下角浮动工具 Dock
src/components/BoxList.tsx       左侧点位列表（虚拟滚动）
src/components/PropertiesPanel.tsx  右侧属性面板
src/components/SortDialog.tsx    排序编号弹窗（容差 + 每行偏移量）
src/components/Minimap.tsx       全局缩略图
src/components/StatusBar.tsx     底部状态栏
src/components/Toolbar.tsx       顶部工具栏
scripts/check-sorting.ts         排序算法校验
```
