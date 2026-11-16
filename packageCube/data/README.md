# 魔方教学内容（lessons.json）

本目录是「魔方教学」微信小程序的教学内容数据。小程序读取 `lessons.json` 渲染课程，并用 3D 魔方动画演示每一步的公式。

## 两条教学轨

| 轨道 id | 名称 | 课程 |
| --- | --- | --- |
| `beginner` | 入门：层先法（8 课） | 记号与颜色认识、底层十字、底层角块、中层棱块、顶层十字、顶面同色、顶层角块归位、顶层棱块归位 |
| `cfop` | 进阶：CFOP（4 课） | 十字技巧、F2L 基础情形、两步 OLL（顶十字 3 种 + 顶面 7 种）、两步 PLL（换角 2 种 + 换棱 4 种） |

完整 57 OLL / 21 PLL 留给后续版本。

## lessons.json 结构

```jsonc
{
  "tracks": [
    {
      "id": "beginner",            // "beginner" | "cfop"
      "title": "入门：层先法",
      "lessons": [
        {
          "id": "cross",           // 轨道内唯一
          "title": "底层十字",
          "goal": "这一课要达到的效果",
          "steps": [
            {
              "text": "讲解（必有）",
              "caseName": "情形名（可选）",
              "algorithm": "公式（可选），如 R U R' U'",
              "setup": "展示情形用的打乱（可选）；不给时用 algorithm 的逆",
              "tips": ["常见错误提示（可选，统一为字符串数组）"]
            }
          ]
        }
      ]
    }
  ]
}
```

演示约定：从复原状态先执行 `setup`（没有就执行 `algorithm` 的逆），得到这一步的情形；再执行 `algorithm` 播放动画。

## 记号说明

- 拿法：**白色中心朝下（D），黄色中心朝上（U）**，全程不变。
- `R L U D F B`：右、左、上、下、前、后面，单写表示正对该面看顺时针转 90°。
- `'`：逆时针 90°；`2`：转 180°。
- 小写 `r l u d f b`：宽层（该面连同相邻中间层一起转），等同 `Rw` 等写法。
- `M`：左右之间的中间层，方向同 `L`；`E`：上下之间的中间层，方向同 `D`；`S`：前后之间的中间层，方向同 `F`。
- `x y z`：整个魔方转动，方向分别同 `R`、`U`、`F`。

## 公式校验

`tools/verify_lessons.py` 内置贴纸级三阶魔方模拟器（纯 Python 3，无依赖），对每条 `algorithm` 检查：能解析；`setup`（或逆公式）得到的起始状态就是讲解描述的情形；执行后达到讲解说的目标，且不破坏不该动的部分（如 OLL/PLL 不破坏前两层）。

```bash
python3 tools/verify_lessons.py                 # 默认读 packageCube/data/lessons.json
python3 tools/verify_lessons.py path/to/lessons.json
```

全部通过退出码为 0。新增带 `algorithm` 的步骤时，需要在脚本的 `SPEC` 里补上对应情形的检查项，否则会被判为失败。
