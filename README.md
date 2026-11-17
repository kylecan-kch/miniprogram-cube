# 魔方教学

微信小程序 · 三阶层先法入门 + CFOP 进阶 · 版本 **1.0.0**

原生微信小程序（纯 JS，不用 Taro / uni-app）。基础库、目录风格和 `project.config.json` 对齐 [kylecan-kch/ai-made](https://github.com/kylecan-kch/ai-made) 仓库 `ready-for-everything` 分支的 `miniprogram-vcf/`：`libVersion` **2.32.3**，`style: v2`，2 空格缩进，运行时代码用 `var` + `function`。

魔方功能全部在分包 `packageCube/`。主包只有一个入口页，打开后跳进分包首页。以后并进 VCF 小程序时，把 `packageCube/` 整份拷过去，在对方 `app.json` 加一条 `subpackages` 即可。

## 一、用微信开发者工具打开

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 稳定版。
2. 导入项目时，目录选**本仓库根目录**（含 `app.json`、`project.config.json` 的这一层）。
3. AppID：本地体验选测试号，或保持 `project.config.json` 里的 `touristappid`。真机预览再换成自己的 AppID。
4. 后端服务选「不使用云服务」，导入。
5. 调试基础库选 **2.32.3** 或更高（详情 → 本地设置 → 调试基础库）。`canvas type="webgl"` 需要基础库 ≥ 2.7.0。

用开发者工具「导入项目」选仓库根目录（含 `project.config.json` 的那一层），AppID 用测试号或 `touristappid`。这是普通小程序：`compileType` 为 `miniprogram`，`projectArchitecture` 为 `miniProgram`。如果导入时报 `project.config.json: ["pluginRoot"] 不能为空`，删除本地的 `project.private.config.json` 后重新导入，并确保不是以插件模式导入。

不需要 `npm install`，也不需要「构建 npm」。

## 二、目录结构

```
├── app.js / app.json / app.wxss     # 壳。app.wxss 不写全局样式，app.js 不放魔方状态
├── project.config.json              # libVersion 2.32.3；tests/、tools/ 不打进包
├── sitemap.json
├── package.json                     # 仅给 node --test 用，小程序运行时不依赖它
├── pages/index/                     # 主包入口，redirect 到分包首页
├── packageCube/                     # 魔方分包，合并时整份拷贝
│   ├── pages/home/                  # 入门 / 进阶入口（轨道来自 lessons.json）
│   ├── pages/lessons/               # 课程列表
│   ├── pages/lesson/                # 单课：3D 魔方 + 公式播放器
│   ├── pages/notation/              # 记号说明
│   ├── components/cube-stage/       # WebGL 魔方与视角拖动
│   ├── core/cube.js                 # 状态、转动、是否还原（不依赖 wx）
│   ├── core/notation.js             # 公式解析、求逆
│   ├── data/lessons.json            # 教学内容，替换这个文件即可换课
│   ├── data/catalog.js              # 读取 lessons.json
│   ├── data/README.md               # 数据说明（数据提供方）
│   └── styles/ui.wxss               # 分包内共享样式，类名一律 cube-
├── tests/                           # Node 测试，packOptions 已排除
└── tools/verify_lessons.py          # 课程公式校验，packOptions 已排除
```

## 三、页面在做什么

- 首页按 `lessons.json` 的 `tracks` 列出轨道（当前是「入门：层先法」和「进阶：CFOP」），并提供记号说明。上次打开的课记在本地存储 `cube_last_lesson`。
- 课程列表、单课页都不写死课程内容，只读 JSON。
- 单课页：当前步的讲解、情形名、`tips`（字符串数组；如果以后写成单个字符串也会按一条显示）。有公式时先把复原魔方按 `setup` 打乱，没有 `setup` 就用 `algorithm` 的逆，再播放 `algorithm`。
- 播放器：播放 / 暂停、单步前进、后退、重置。正在播的那一步在公式上高亮。手指在画布上拖动可以转视角。

拿法：**白底黄顶**（U 黄、D 白）。演示配色另外取前绿、后蓝、右红、左橙，见下方「需要知道的约定」。

## 四、跑测试

需要 Node 18+（本仓库用 Node 自带的 `node:test`，没有 npm 依赖）。在仓库根目录：

```bash
node --test tests/*.test.js
# 或
npm test
```

课程数据另有一份 Python 校验（无第三方依赖）：

```bash
python3 tools/verify_lessons.py
# 默认读取 packageCube/data/lessons.json，也可以传入别的路径
```

内核单测覆盖：每种转动做 4 次回到原状、转动与其逆抵消、`(R U R' U')6` 恒等、`r R' = M'`、`x = R M' L'`、`y = U E' D'`、`z = F S B'`、`f = F S`、求逆后接上原公式为恒等、解析器的空格 / 括号 / 重复。并遍历 `lessons.json` 的全部 `algorithm` / `setup`：都能解析；没有 `setup` 的步骤做完回到还原；贴纸状态与 `tools/verify_lessons.py` 里的模拟器一致。

## 五、lessons.json

格式以 `packageCube/data/README.md` 为准。结构是：

```json
{
  "tracks": [
    {
      "id": "beginner",
      "title": "入门：层先法",
      "lessons": [
        {
          "id": "cross",
          "title": "底层十字",
          "goal": "这一课要达到的效果",
          "steps": [
            {
              "text": "讲解（必有）",
              "caseName": "情形名（可选）",
              "algorithm": "公式（可选），如 R U R' U'",
              "setup": "展示情形用的打乱（可选）；不给时用 algorithm 的逆",
              "tips": ["提示（可选，字符串数组）"]
            }
          ]
        }
      ]
    }
  ]
}
```

替换 `packageCube/data/lessons.json` 后页面会跟着变，不需要改页面代码。新增带 `algorithm` 的步骤时，要在 `tools/verify_lessons.py` 的 `SPEC` 里补上情形检查，否则校验脚本会失败。

记号：`R L U D F B`，后缀 `'` 和 `2`（`2'` 与 `2` 相同）；宽层 `r l u d f b` 以及 `Rw Lw Uw Dw Fw Bw`；中层 `M E S`；整体 `x y z`。解析器还接受多余空格、不写空格、括号分组和 `(R U)3` 这种重复。

## 六、合并进 VCF 小程序

目标仓库是 `ai-made` 的 `miniprogram-vcf/`。按下面做，不必改魔方分包内部：

1. 把本仓库的 `packageCube/` 整个目录拷到 VCF 小程序根目录（和 `pages/`、`utils/` 同级）。
2. 在对方 `app.json` 增加一条分包（已有 `subpackages` 就追加，没有就新建）：

```json
{
  "root": "packageCube",
  "name": "cube",
  "pages": [
    "pages/home/home",
    "pages/lessons/lessons",
    "pages/lesson/lesson",
    "pages/notation/notation"
  ]
}
```

3. 在 VCF 某个页面加一个入口，例如 `wx.navigateTo({ url: '/packageCube/pages/home/home' })`。
4. 不要覆盖对方的 `app.js`、`app.wxss`、`app.json`（除了上面这一条）。分包不调用 `getApp()`，不读 `globalData`，样式也不依赖 `app.wxss`。
5. 样式类名都是 `cube-` 前缀，本地存储键是 `cube_last_lesson`，和 VCF 的 `vcf_` 键不冲突。
6. `tests/`、`tools/` 不要打进小程序包。若这两个目录也被拷进 VCF 工程，在 `project.config.json` 的 `packOptions.ignore` 里加上 `tests` 和 `tools`。

## 七、约定

- **宽层和中层**：`M` 的方向同 `L`，小写 `r` 同 `R`（也就是 `r = R M'`）。因此 `r R'` 等于 `M'`，`x` 等于 `R M' L'`。这和 `tools/verify_lessons.py`、`packageCube/data/README.md` 一致。
- **前面的颜色**：数据说明只规定白下黄上，以及白对黄、红对橙、蓝对绿，没有写死哪一面朝前。3D 和记号页目前用前绿、后蓝、右红、左橙。要改的话只动 `packageCube/components/cube-stage/glcube.js` 里的 `COLORS`，以及记号页的色块。
- **渲染**：自写 WebGL1，不用 three.js。26 个块各画一次塑料体和贴纸，顶点缓冲在初始化时建好，动画帧只复用矩阵。像素比上限 2，关闭抗锯齿，避免低端安卓每帧分配内存。
