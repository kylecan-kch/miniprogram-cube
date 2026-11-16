#!/usr/bin/env python3
"""校验 packageCube/data/lessons.json 里的每一条公式。

用法（在 miniprogram-cube 目录下）：
    python3 tools/verify_lessons.py [path/to/lessons.json]

内置一个贴纸级三阶魔方模拟器（支持 R L U D F B、小写宽层 r l u d f b 与 Rw 写法、
M E S、x y z，以及 ' 和 2）。约定：白色中心在下（D），黄色中心在上（U）。
每条 algorithm：
  1. 能解析；
  2. 从 setup（没给就用 algorithm 的逆）出发，确认起始状态就是讲解里描述的情形；
  3. 执行 algorithm 后，确认得到讲解说的目标（十字完成 / 槽位放好 / 顶面全黄 / 复原……），
     并且没有破坏不该动的部分（例如 OLL/PLL 不破坏前两层）。
所有 algorithm 步骤都必须在下面 SPEC 里有对应的检查项，否则算失败。
无第三方依赖，退出码 0 表示全部通过。
"""
import json, os, random, re, sys

# ---------------- 模拟器 ----------------
FACES = {'U': (0, 1, 0), 'D': (0, -1, 0), 'R': (1, 0, 0), 'L': (-1, 0, 0), 'F': (0, 0, 1), 'B': (0, 0, -1)}
FNAME = {v: k for k, v in FACES.items()}

def _rot(v, axis, q):
    x, y, z = v
    for _ in range(q % 4):  # 绕正轴 +90 度（从正方向看逆时针）
        if axis == 0: y, z = -z, y
        elif axis == 1: z, x = -x, z
        else: x, y = -y, x
    return (x, y, z)

# 名称 -> (轴, 层坐标集合, 单次转动方向)
_BASE = {'R': (0, {1}, -1), 'L': (0, {-1}, 1), 'M': (0, {0}, 1),
         'U': (1, {1}, -1), 'D': (1, {-1}, 1), 'E': (1, {0}, 1),
         'F': (2, {1}, -1), 'B': (2, {-1}, 1), 'S': (2, {0}, -1),
         'x': (0, {-1, 0, 1}, -1), 'y': (1, {-1, 0, 1}, -1), 'z': (2, {-1, 0, 1}, -1)}
_WIDE = {'r': (0, {0, 1}, -1), 'l': (0, {-1, 0}, 1), 'u': (1, {0, 1}, -1),
         'd': (1, {-1, 0}, 1), 'f': (2, {0, 1}, -1), 'b': (2, {-1, 0}, 1)}
_TOK = re.compile(r"^([RLUDFB]w|[RLUDFBMESxyz]|[rludfb])(2'|2|')?$")

def parse(alg):
    moves = []
    for t in alg.split():
        m = _TOK.match(t)
        if not m:
            raise ValueError('无法解析的记号: %r' % t)
        base, suf = m.group(1), m.group(2) or ''
        if base.endswith('w'): axis, lay, d = _WIDE[base[0].lower()]
        elif base in _WIDE: axis, lay, d = _WIDE[base]
        else: axis, lay, d = _BASE[base]
        moves.append((axis, lay, d * {'': 1, "'": -1, '2': 2, "2'": 2}[suf]))
    return moves

def solved():
    st = {}
    for f, n in FACES.items():
        ax = [i for i in range(3) if n[i]][0]
        o = [i for i in range(3) if i != ax]
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                p = list(n); p[o[0]] = a; p[o[1]] = b
                st[(tuple(p), n)] = f
    return st

def apply(st, alg):
    for axis, lay, q in parse(alg):
        st = {((_rot(p, axis, q), _rot(n, axis, q)) if p[axis] in lay else (p, n)): c for (p, n), c in st.items()}
    return st

def inverse(alg):
    out = []
    for t in reversed(alg.split()):
        if t.endswith("2'"): out.append(t[:-1])
        elif t.endswith('2'): out.append(t)
        elif t.endswith("'"): out.append(t[:-1])
        else: out.append(t + "'")
    return ' '.join(out)

S = solved()
UP = (0, 1, 0)

# 所有判断都相对中心块颜色，因此与整体转向（x/y/z）无关
def center(st, n): return st[(n, n)]
def ok(st, p, n): return st[(p, n)] == center(st, n)

POS = {}
for x in (-1, 0, 1):
    for y in (-1, 0, 1):
        for z in (-1, 0, 1):
            if abs(x) + abs(y) + abs(z) >= 2:
                POS[(x, y, z)] = (('U' if y == 1 else 'D' if y == -1 else '') +
                                  ('F' if z == 1 else 'B' if z == -1 else '') +
                                  ('R' if x == 1 else 'L' if x == -1 else ''))
PID = {v: k for k, v in POS.items()}

def bad_pieces(st, cond):
    return sorted({POS[p] for (p, n) in st if p in POS and cond(p) and not ok(st, p, n)})

def f2l_ok(st): return not bad_pieces(st, lambda p: p[1] <= 0)
def dlayer_bad(st): return bad_pieces(st, lambda p: p[1] == -1)
def cross_bad(st): return [x for x in bad_pieces(st, lambda p: p[1] == -1) if len(x) == 2]
def all_ok(st): return all(ok(st, p, n) for (p, n) in st)
def uface_ok(st): return all(ok(st, p, n) for (p, n) in st if n == UP)

def where(st, home):
    """home 位置上的那块现在在哪，以及它每个贴纸朝向哪个面（颜色以“原属面”字母表示，D=白）。"""
    hp = PID[home]
    cols = sorted(S[(p, n)] for (p, n) in S if p == hp)
    for p in POS:
        stk = {FNAME[n]: st[(pp, n)] for (pp, n) in st if pp == p}
        if sorted(stk.values()) == cols:
            return POS[p], stk

def white_dir(st, home):
    pos, stk = where(st, home)
    return pos, [f for f, c in stk.items() if c == 'D'][0]

UE = ['UF', 'UR', 'UB', 'UL']
UC = ['UFR', 'UFL', 'UBR', 'UBL']
def eo(st):
    U = center(st, UP)
    return sorted(e for e in UE if st[(PID[e], UP)] == U)
def co(st):
    U = center(st, UP); res = {}
    for c in UC:
        for (p, n), col in st.items():
            if p == PID[c] and col == U: res[c] = FNAME[n]
    return res
def headlights(st):
    hl = []
    for f in 'FRBL':
        n = FACES[f]
        cs = [c for (p, nn), c in st.items() if nn == n and p[1] == 1 and p in POS and len(POS[p]) == 3]
        if cs[0] == cs[1]: hl.append(f)
    return hl
def bars(st):
    return [f for f in 'FRBL' if all(ok(st, p, nn) for (p, nn) in st if nn == FACES[f] and p[1] == 1)]
def solved_auf(st):
    return any(all_ok(apply(st, u) if u else st) for u in ('', 'U', 'U2', "U'"))
def corners_rel_ok(st):
    """顶层角相对位置都对（四面都有车灯，转顶层可对齐）。"""
    return len(headlights(st)) == 4
def perm(alg):
    """执行 alg 后顶层块的去向：{原位置: 新位置}，只列移动了的块。"""
    st = apply(S, alg); res = {}
    for q in UE + UC:
        pos, _ = where(st, q)
        if pos != q: res[q] = pos
    return res

# 随机生成“前两层完好”的顶层状态，用来确认 OLL/PLL 不破坏前两层
_LL_GEN = ["R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'", "F R U R' U' F'", 'U', "U'"]
def random_ll_states(n=30, seed=1):
    rnd = random.Random(seed); out = []
    for _ in range(n):
        st = S
        for _ in range(8): st = apply(st, rnd.choice(_LL_GEN))
        out.append(st)
    return out
LL = random_ll_states()
OLL_CORNER_ALGS = ["R U R' U R U' R' U R U2 R'", "R U2 R2 U' R2 U' R2 U2 R", "R2 D R' U2 R D' R' U2 R'",
                   "r U R' U' r' F R F'", "F' r U R' U' r' F R"]  # H, Pi, U, T, L
def keeps_f2l(alg):
    return all(f2l_ok(apply(st, alg)) for st in LL)

# ---------------- 每个情形的期望 ----------------
# key: (lessonId, caseName)
SPEC = {
    # 记号课：只要求能解析
    ('notation', 'R 右面顺时针'): {'type': 'parse'}, ('notation', "R' 右面逆时针"): {'type': 'parse'},
    ('notation', 'R2 右面转半圈'): {'type': 'parse'}, ('notation', 'U 顶面顺时针'): {'type': 'parse'},
    ('notation', "U' 顶面逆时针"): {'type': 'parse'}, ('notation', 'F 前面顺时针'): {'type': 'parse'},
    ('notation', 'L 左面顺时针'): {'type': 'parse'}, ('notation', 'D 底面顺时针'): {'type': 'parse'},
    ('notation', 'B 后面顺时针'): {'type': 'parse'}, ('notation', 'r 右边两层'): {'type': 'parse'},
    ('notation', 'M 中间层'): {'type': 'parse'}, ('notation', 'y 整体转'): {'type': 'parse'},
    ('notation', "练习：R U R' U'"): {'type': 'parse'},
    # 十字：起始只有 DF 那条白棱不对；白棱在哪、白色朝哪
    ('cross', '白色朝上的白棱'): {'type': 'cross', 'edge': ('UF', 'U')},
    ('cross', '白色朝前的白棱'): {'type': 'cross', 'edge': ('UF', 'F')},
    ('cfop-cross', '顶层白色朝上'): {'type': 'cross', 'edge': ('UF', 'U')},
    ('cfop-cross', '顶层白色朝前'): {'type': 'cross', 'edge': ('UF', 'F')},
    ('cfop-cross', '底层白棱反了'): {'type': 'cross', 'edge': ('DF', 'F')},
    # 底角：角块在右前上方，白色朝向；只有 DFR 不对
    ('first-corners', '白色朝右（1 次）'): {'type': 'corner', 'white': 'R'},
    ('first-corners', '白色朝上（3 次）'): {'type': 'corner', 'white': 'U'},
    ('first-corners', '白色朝前（5 次）'): {'type': 'corner', 'white': 'F'},
    # 中棱：棱块在顶层前面（UF），前面颜色对齐前中心，只有目标槽的棱不对
    ('middle-edges', '棱块放右边'): {'type': 'midedge', 'slot': 'FR'},
    ('middle-edges', '棱块放左边'): {'type': 'midedge', 'slot': 'FL'},
    ('f2l-basic', '角已归位·棱在顶'): {'type': 'midedge', 'slot': 'FR'},
    # F2L：只有右前槽（DFR+FR）不对；角块位置/白色朝向，棱块位置
    ('f2l-basic', '分离·白色朝前'): {'type': 'f2l', 'corner': ('UFR', 'F'), 'edge': 'UR'},
    ('f2l-basic', '分离·白色朝右'): {'type': 'f2l', 'corner': ('UFR', 'R'), 'edge': 'UF'},
    ('f2l-basic', '直接插入·右'): {'type': 'f2l', 'corner': ('UFR', 'R'), 'edge': 'UB'},
    ('f2l-basic', '直接插入·前'): {'type': 'f2l', 'corner': ('UFR', 'F'), 'edge': 'UL'},
    ('f2l-basic', '白色朝上'): {'type': 'f2l', 'corner': ('UFR', 'U'), 'edge': 'UR'},
    # 顶十字（只看棱的朝向）
    ('top-cross', '一字形'): {'type': 'eo', 'before': ['UL', 'UR'], 'after': UE},
    ('top-cross', 'L 形'): {'type': 'eo', 'before': ['UB', 'UL'], 'after': ['UL', 'UR']},
    ('top-cross', '点'): {'type': 'eo', 'before': [], 'after_count': 2},
    ('oll-2look', '一字'): {'type': 'eo', 'before': ['UL', 'UR'], 'after': UE},
    ('oll-2look', 'L 形'): {'type': 'eo', 'before': ['UB', 'UL'], 'after': UE},
    ('oll-2look', '点'): {'type': 'eo', 'before': [], 'after': UE},
    # 顶面角（co：每个顶角黄色朝向；U 表示朝上）
    ('top-face', '小鱼'): {'type': 'co', 'before': {'UFL': 'U', 'UFR': 'F', 'UBR': 'R', 'UBL': 'B'}, 'after': 'uface'},
    ('top-face', '没有黄角朝上'): {'type': 'co', 'before_count': 0, 'ufl': 'L', 'after': 'fish'},
    ('top-face', '两个黄角朝上'): {'type': 'co', 'before_count': 2, 'ufl': 'F', 'after': 'fish'},
    ('oll-2look', 'Sune'): {'type': 'co', 'before': {'UFL': 'U', 'UFR': 'F', 'UBR': 'R', 'UBL': 'B'}, 'after': 'uface'},
    ('oll-2look', 'Anti-Sune'): {'type': 'co', 'before': {'UBR': 'U', 'UFR': 'R', 'UFL': 'F', 'UBL': 'L'}, 'after': 'uface'},
    ('oll-2look', 'H'): {'type': 'co', 'before': {'UFR': 'R', 'UBR': 'R', 'UFL': 'L', 'UBL': 'L'}, 'after': 'uface'},
    ('oll-2look', 'Pi'): {'type': 'co', 'before': {'UFL': 'L', 'UBL': 'L', 'UFR': 'F', 'UBR': 'B'}, 'after': 'uface'},
    ('oll-2look', 'U / Headlights'): {'type': 'co', 'before': {'UBR': 'U', 'UBL': 'U', 'UFR': 'F', 'UFL': 'F'}, 'after': 'uface'},
    ('oll-2look', 'T'): {'type': 'co', 'before': {'UFR': 'U', 'UBR': 'U', 'UFL': 'F', 'UBL': 'B'}, 'after': 'uface'},
    ('oll-2look', 'L / Bowtie'): {'type': 'co', 'before': {'UFL': 'U', 'UBR': 'U', 'UFR': 'F', 'UBL': 'L'}, 'after': 'uface'},
    # 顶层角归位（三角换），车灯在后
    ('top-corners', '有一对车灯'): {'type': 'pll', 'headlights': ['B'], 'perm': {'UFR': 'UBL', 'UBL': 'UBR', 'UBR': 'UFR'}},
    ('top-corners', '没有车灯'): {'type': 'pll', 'headlights': [], 'perm': {'UFR': 'UBL', 'UBL': 'UBR', 'UBR': 'UFR'}, 'times': 'diag'},
    # 两步 PLL 换角
    ('pll-2look', '相邻换角（T）'): {'type': 'pll', 'headlights': ['L'], 'perm': {'UFR': 'UBR', 'UBR': 'UFR', 'UL': 'UR', 'UR': 'UL'}},
    ('pll-2look', '对角换角（Y）'): {'type': 'pll', 'headlights': [], 'perm': {'UFR': 'UBL', 'UBL': 'UFR', 'UB': 'UL', 'UL': 'UB'}},
    # 棱换（perm 写 {原位置: 去向}）
    ('top-edges', '三棱逆时针（Ua）'): {'type': 'pll', 'bars': ['B'], 'perm': {'UF': 'UR', 'UR': 'UL', 'UL': 'UF'}},
    ('top-edges', '三棱顺时针（Ub）'): {'type': 'pll', 'bars': ['B'], 'perm': {'UF': 'UL', 'UL': 'UR', 'UR': 'UF'}},
    ('pll-2look', 'Ua'): {'type': 'pll', 'bars': ['B'], 'perm': {'UF': 'UR', 'UR': 'UL', 'UL': 'UF'}},
    ('pll-2look', 'Ub'): {'type': 'pll', 'bars': ['B'], 'perm': {'UF': 'UL', 'UL': 'UR', 'UR': 'UF'}},
    ('pll-2look', 'H'): {'type': 'pll', 'bars': [], 'perm': {'UF': 'UB', 'UB': 'UF', 'UL': 'UR', 'UR': 'UL'}},
    ('pll-2look', 'Z'): {'type': 'pll', 'bars': [], 'perm': {'UF': 'UL', 'UL': 'UF', 'UB': 'UR', 'UR': 'UB'}},
}

def check(lesson, step):
    alg = step['algorithm']; key = (lesson, step.get('caseName'))
    errs = []
    try:
        parse(alg)
        if step.get('setup'): parse(step['setup'])
    except ValueError as e:
        return [str(e)]
    spec = SPEC.get(key)
    if spec is None:
        return ['SPEC 里没有这个情形的检查项']
    t = spec['type']
    if t == 'parse':
        return []
    setup = step.get('setup') or inverse(alg)
    s0 = apply(S, setup); s1 = apply(s0, alg)
    def need(cond, msg):
        if not cond: errs.append(msg)
    if t == 'cross':
        need(cross_bad(s0) == ['DF'], '起始应只有 DF 白棱不对，实际 %s' % cross_bad(s0))
        need(white_dir(s0, 'DF') == spec['edge'], '白棱位置/朝向应为 %s，实际 %s' % (spec['edge'], white_dir(s0, 'DF')))
        need(not cross_bad(s1), '做完十字没好: %s' % cross_bad(s1))
    elif t == 'corner':
        need(dlayer_bad(s0) == ['DFR'], '起始底层应只有 DFR 不对，实际 %s' % dlayer_bad(s0))
        need(white_dir(s0, 'DFR') == ('UFR', spec['white']), '角块应在 UFR 白色朝 %s，实际 %s' % (spec['white'], white_dir(s0, 'DFR')))
        need(not dlayer_bad(s1), '做完底层没好: %s' % dlayer_bad(s1))
    elif t == 'midedge':
        bad0 = bad_pieces(s0, lambda p: p[1] <= 0)
        need(bad0 == [spec['slot']], '起始前两层应只有 %s 不对，实际 %s' % (spec['slot'], bad0))
        pos, stk = where(s0, spec['slot'])
        need(pos == 'UF' and stk.get('F') == 'F', '棱块应在 UF 且前面颜色对齐前中心，实际 %s %s' % (pos, stk))
        need(f2l_ok(s1), '做完前两层没好: %s' % bad_pieces(s1, lambda p: p[1] <= 0))
    elif t == 'f2l':
        bad0 = bad_pieces(s0, lambda p: p[1] <= 0)
        need(bad0 == ['DFR', 'FR'], '起始应只有右前槽一对不对，实际 %s' % bad0)
        need(white_dir(s0, 'DFR') == spec['corner'], '角块应为 %s，实际 %s' % (spec['corner'], white_dir(s0, 'DFR')))
        need(where(s0, 'FR')[0] == spec['edge'], '棱块应在 %s，实际 %s' % (spec['edge'], where(s0, 'FR')[0]))
        need(f2l_ok(s1), '做完前两层没好: %s' % bad_pieces(s1, lambda p: p[1] <= 0))
    elif t == 'eo':
        need(f2l_ok(s0), '起始前两层应完好')
        need(eo(s0) == sorted(spec['before']), '起始黄棱朝上应为 %s，实际 %s' % (spec['before'], eo(s0)))
        if 'after' in spec:
            need(eo(s1) == sorted(spec['after']), '做完黄棱朝上应为 %s，实际 %s' % (spec['after'], eo(s1)))
        else:
            e = eo(s1)
            need(len(e) == spec['after_count'] and not (set(e) in ({'UF', 'UB'}, {'UL', 'UR'})),
                 '做完应出现 L 形（两条相邻黄棱），实际 %s' % e)
        need(keeps_f2l(alg), '公式会破坏前两层')
    elif t == 'co':
        need(f2l_ok(s0) and eo(s0) == sorted(UE), '起始应前两层完好且已有黄十字')
        c0 = co(s0)
        if 'before' in spec:
            need(c0 == spec['before'], '顶角黄色朝向应为 %s，实际 %s' % (spec['before'], c0))
        else:
            cnt = sum(1 for v in c0.values() if v == 'U')
            need(cnt == spec['before_count'], '黄角朝上个数应为 %d，实际 %d' % (spec['before_count'], cnt))
            need(c0.get('UFL') == spec['ufl'], '左前角黄色应朝 %s，实际 %s' % (spec['ufl'], c0.get('UFL')))
        if spec['after'] == 'uface':
            need(uface_ok(s1) and f2l_ok(s1), '做完顶面没全黄或前两层被破坏')
        else:
            c1 = co(s1)
            need(sum(1 for v in c1.values() if v == 'U') == 1 and eo(s1) == sorted(UE) and f2l_ok(s1),
                 '做完应变成小鱼（只有一个黄角朝上），实际 %s' % c1)
            # 讲解里的摆法规则对所有同类情形都成立（遍历 H/Pi/U/T/L 及四个顶层转角）
            for oll in OLL_CORNER_ALGS:
                for u in ('', ' U', ' U2', " U'"):
                    t0 = apply(S, inverse(oll) + u); c = co(t0)
                    if sum(1 for v in c.values() if v == 'U') == spec['before_count'] and c.get('UFL') == spec['ufl']:
                        c2 = co(apply(t0, alg))
                        need(sum(1 for v in c2.values() if v == 'U') == 1, '摆法规则在 %s 情形下不成立' % oll)
        need(keeps_f2l(alg), '公式会破坏前两层')
    elif t == 'pll':
        need(f2l_ok(s0) and uface_ok(s0), '起始应前两层完好、顶面全黄')
        if 'headlights' in spec:
            need(headlights(s0) == spec['headlights'], '车灯应在 %s，实际 %s' % (spec['headlights'], headlights(s0)))
        if 'bars' in spec:
            need(bars(s0) == spec['bars'], '整条好的面应为 %s，实际 %s' % (spec['bars'], bars(s0)))
        need(perm(alg) == spec['perm'], '块的去向应为 %s，实际 %s' % (spec['perm'], perm(alg)))
        need(keeps_f2l(alg), '公式会破坏前两层')
        need(all(uface_ok(apply(st, alg)) for st in LL if uface_ok(st)), '公式会破坏顶面同色')
        if spec.get('times') == 'diag':
            # 没车灯：做一次后出现车灯；把车灯转到后面再做一次，角全部归位
            need(len(headlights(s1)) >= 1, '做一次后应出现车灯')
            fixed = False
            for u in ('', 'U', 'U2', "U'"):
                t = apply(s1, u) if u else s1
                if headlights(t) == ['B'] and corners_rel_ok(apply(t, alg)): fixed = True
            need(fixed, '把车灯放后面再做一次后角应全部归位')
        elif 'headlights' in spec and spec['headlights'] == ['B']:
            need(solved_auf(s1) or corners_rel_ok(s1), '做完角应全部归位')
        else:
            need(solved_auf(s1), '做完没复原（允许最后转顶层对齐）')
    return errs

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'packageCube', 'data', 'lessons.json')
    data = json.load(open(path, encoding='utf-8'))
    fails = 0; total = 0
    for tr in data['tracks']:
        nl = len(tr['lessons']); ns = sum(len(l['steps']) for l in tr['lessons'])
        na = sum(1 for l in tr['lessons'] for s in l['steps'] if s.get('algorithm'))
        print('[%s] %s：%d 课，%d 步，%d 条公式' % (tr['id'], tr['title'], nl, ns, na))
        for l in tr['lessons']:
            for s in l['steps']:
                if 'tips' in s and not isinstance(s['tips'], list):
                    print('  FAIL %s: tips 应为数组' % l['id']); fails += 1
                if not s.get('algorithm'): continue
                total += 1
                errs = check(l['id'], s)
                tag = 'OK  ' if not errs else 'FAIL'
                print('  %s %s / %s: %s' % (tag, l['id'], s.get('caseName'), s['algorithm']))
                for e in errs: print('        - ' + e)
                fails += bool(errs)
    print('\n共 %d 条公式，%d 条失败' % (total, fails))
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
