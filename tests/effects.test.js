const test = require('node:test');
const assert = require('node:assert/strict');
const cube = require('../packageCube/core/cube.js');
const notation = require('../packageCube/core/notation.js');
const lessons = require('../packageCube/data/lessons.json');

const EDGES = {
  UF: [0, 1, 1], UB: [0, 1, -1], UR: [1, 1, 0], UL: [-1, 1, 0],
  DF: [0, -1, 1], DB: [0, -1, -1], DR: [1, -1, 0], DL: [-1, -1, 0],
  FR: [1, 0, 1], FL: [-1, 0, 1], BR: [1, 0, -1], BL: [-1, 0, -1]
};
const CORNERS = {
  UFR: [1, 1, 1], UFL: [-1, 1, 1], UBR: [1, 1, -1], UBL: [-1, 1, -1],
  DFR: [1, -1, 1], DFL: [-1, -1, 1], DBR: [1, -1, -1], DBL: [-1, -1, -1]
};
const CENTERS = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
const NAME = {};
for (const table of [EDGES, CORNERS, CENTERS]) {
  for (const name of Object.keys(table)) NAME[table[name].join(',')] = name;
}
const NORMALS = [[1, 0, 0, 'R'], [-1, 0, 0, 'L'], [0, 1, 0, 'U'], [0, -1, 0, 'D'], [0, 0, 1, 'F'], [0, 0, -1, 'B']];
const SOLVED_STICKERS = cube.stickerMap(cube.createSolved());
const UE = ['UF', 'UR', 'UB', 'UL'];

function apply(alg) {
  const state = cube.createSolved();
  if (alg) cube.applyMoves(state, notation.parse(alg));
  return state;
}

function keyOf(alg) {
  return cube.stateKey(apply(alg));
}

function cubie(state, home) {
  for (let i = 0; i < state.cubies.length; i++) {
    const c = state.cubies[i];
    if (c.home[0] === home[0] && c.home[1] === home[1] && c.home[2] === home[2]) return c;
  }
  throw new Error('找不到块 ' + home.join(','));
}

function posName(state, home) {
  const p = cubie(state, home).pos;
  return NAME[p[0] + ',' + p[1] + ',' + p[2]];
}

function homeFacing(state, home, normal) {
  const w = cube.mulVec(cubie(state, home).ori, normal[0], normal[1], normal[2]);
  return cube.faceOf(w[0], w[1], w[2]);
}

function colorFacing(map, x, y, z, color) {
  for (let i = 0; i < NORMALS.length; i++) {
    const n = NORMALS[i];
    if (map[x + ',' + y + ',' + z + '|' + n[0] + ',' + n[1] + ',' + n[2]] === color) return n[3];
  }
  return '';
}

function yellowCorners(state) {
  const map = cube.stickerMap(state);
  const out = {};
  for (const name of Object.keys(CORNERS)) {
    if (name[0] !== 'U') continue;
    const p = CORNERS[name];
    out[name] = colorFacing(map, p[0], p[1], p[2], 'U');
  }
  return out;
}

function yellowEdges(state) {
  const map = cube.stickerMap(state);
  const out = [];
  for (let i = 0; i < UE.length; i++) {
    const p = EDGES[UE[i]];
    if (colorFacing(map, p[0], p[1], p[2], 'U') === 'U') out.push(UE[i]);
  }
  return out.sort();
}

function f2lOk(state) {
  const now = cube.stickerMap(state);
  const keys = Object.keys(SOLVED_STICKERS);
  for (let i = 0; i < keys.length; i++) {
    const y = Number(keys[i].split(',')[1]);
    if (y <= 0 && now[keys[i]] !== SOLVED_STICKERS[keys[i]]) return false;
  }
  return true;
}

function headlights(state) {
  const map = cube.stickerMap(state);
  const sides = [
    ['F', [[1, 1, 1], [-1, 1, 1], [0, 0, 1]]],
    ['R', [[1, 1, 1], [1, 1, -1], [1, 0, 0]]],
    ['B', [[1, 1, -1], [-1, 1, -1], [0, 0, -1]]],
    ['L', [[-1, 1, 1], [-1, 1, -1], [-1, 0, 0]]]
  ];
  const out = [];
  for (let i = 0; i < sides.length; i++) {
    const face = sides[i][0];
    const a = sides[i][1][0];
    const b = sides[i][1][1];
    const n = sides[i][1][2];
    const ca = map[a.join(',') + '|' + n.join(',')];
    const cb = map[b.join(',') + '|' + n.join(',')];
    if (ca && ca === cb) out.push(face);
  }
  return out;
}

function bars(state) {
  const map = cube.stickerMap(state);
  const faces = { F: [0, 0, 1], R: [1, 0, 0], B: [0, 0, -1], L: [-1, 0, 0] };
  const out = [];
  for (const face of Object.keys(faces)) {
    const n = faces[face];
    let ok = true;
    let seen = 0;
    for (const key of Object.keys(map)) {
      const parts = key.split('|');
      const pos = parts[0].split(',').map(Number);
      const nn = parts[1].split(',').map(Number);
      if (pos[1] === 1 && nn[0] === n[0] && nn[1] === n[1] && nn[2] === n[2]) {
        seen++;
        if (map[key] !== face) ok = false;
      }
    }
    if (ok && seen === 3) out.push(face);
  }
  return out;
}

function moved(state, homes) {
  const out = {};
  for (let i = 0; i < homes.length; i++) {
    const name = homes[i];
    const at = posName(state, EDGES[name] || CORNERS[name]);
    if (at !== name) out[name] = at;
  }
  return out;
}

function repeat(alg, times) {
  return Array(times).fill(alg).join(' ');
}

function findStep(lessonId, caseName) {
  for (const track of lessons.tracks) {
    for (const lesson of track.lessons) {
      if (lesson.id !== lessonId) continue;
      for (const step of lesson.steps) {
        if (step.caseName === caseName) return step;
      }
    }
  }
  throw new Error('找不到 ' + lessonId + ' / ' + caseName);
}

function play(step) {
  const setup = step.setup || notation.inverseAlgorithm(step.algorithm);
  const state = apply(setup);
  const before = {
    edges: yellowEdges(state),
    corners: yellowCorners(state),
    f2l: f2lOk(state),
    solved: cube.isSolved(state)
  };
  cube.applyMoves(state, notation.parse(step.algorithm));
  return {
    before: before,
    after: {
      edges: yellowEdges(state),
      corners: yellowCorners(state),
      f2l: f2lOk(state),
      solved: cube.isSolved(state)
    }
  };
}

function yellowUp(corners) {
  return Object.keys(corners).filter((name) => corners[name] === 'U').sort();
}

test('面转方向与记号页一致：U 前排到左，R 前棱向上，F 上棱到右', () => {
  assert.equal(posName(apply('U'), EDGES.UF), 'UL');
  assert.equal(posName(apply("U'"), EDGES.UF), 'UR');
  assert.equal(posName(apply('D'), EDGES.DF), 'DR');
  assert.equal(posName(apply('R'), EDGES.FR), 'UR');
  assert.equal(posName(apply("R'"), EDGES.FR), 'DR');
  assert.equal(posName(apply('L'), EDGES.FL), 'DL');
  assert.equal(posName(apply('F'), EDGES.UF), 'FR');
  assert.equal(posName(apply('B'), EDGES.UB), 'BL');
  const r = apply('R');
  assert.equal(homeFacing(r, EDGES.FR, [0, 0, 1]), 'U');
  const u = apply('U');
  assert.equal(homeFacing(u, EDGES.UF, [0, 1, 0]), 'U');
  assert.equal(homeFacing(u, EDGES.UF, [0, 0, 1]), 'L');
});

test('中层跟对应面同向，宽层等于面加中层', () => {
  assert.equal(posName(apply('M'), CENTERS.U), 'F');
  assert.equal(posName(apply('M'), EDGES.UF), 'DF');
  assert.equal(posName(apply('E'), CENTERS.F), 'R');
  assert.equal(posName(apply('S'), CENTERS.U), 'R');
  assert.equal(posName(apply('L'), EDGES.FL), 'DL');
  assert.equal(posName(apply('D'), EDGES.DF), 'DR');
  assert.equal(posName(apply('F'), EDGES.UF), 'FR');

  const same = [
    ['r', "R M'"],
    ['l', 'L M'],
    ['u', "U E'"],
    ['d', 'D E'],
    ['f', 'F S'],
    ['b', "B S'"],
    ['Rw', 'r'],
    ['Lw', 'l'],
    ['Uw', 'u'],
    ['Dw', 'd'],
    ['Fw', 'f'],
    ['Bw', 'b'],
    ["Fw'", "f'"],
    ['M2', 'M M'],
    ["E'", 'E E E']
  ];
  for (const pair of same) {
    assert.equal(keyOf(pair[0]), keyOf(pair[1]), pair[0] + ' = ' + pair[1]);
  }
  assert.equal(posName(apply('r'), EDGES.FR), 'UR');
  assert.equal(posName(apply('r'), CENTERS.U), 'B');
  assert.notEqual(keyOf('r'), keyOf('R'));
  assert.notEqual(keyOf('M'), keyOf('L'));
  assert.equal(keyOf("r R'"), keyOf("M'"));
});

test('整体转动 x/y/z 跟 R/U/F 同向，对侧是逆', () => {
  assert.equal(posName(apply('x'), EDGES.FR), 'UR');
  assert.equal(posName(apply('x'), EDGES.FL), 'UL');
  assert.equal(posName(apply("L'"), EDGES.FL), 'UL');
  assert.notEqual(posName(apply('x'), EDGES.FL), posName(apply('L'), EDGES.FL));
  assert.equal(posName(apply('y'), EDGES.UF), 'UL');
  assert.equal(posName(apply('y'), EDGES.DF), 'DL');
  assert.equal(posName(apply("D'"), EDGES.DF), 'DL');
  assert.equal(posName(apply('z'), EDGES.UF), 'FR');
  assert.equal(posName(apply('z'), EDGES.UB), 'BR');
  assert.equal(posName(apply("B'"), EDGES.UB), 'BR');
  assert.equal(keyOf('x'), keyOf("R M' L'"));
  assert.equal(keyOf('y'), keyOf("U E' D'"));
  assert.equal(keyOf('z'), keyOf("F S B'"));
  assert.equal(keyOf('x2'), keyOf("R2 M2 L2"));
  assert.equal(keyOf("M2 E2 S2 M2 E2 S2"), cube.solvedKey());
});

test('M2 E2 S2 是棋盘格：棱块对色，中心和角块留在本面', () => {
  const opp = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
  const map = cube.stickerMap(apply('M2 E2 S2'));
  for (const key of Object.keys(map)) {
    const pos = key.split('|')[0].split(',').map(Number);
    const normal = key.split('|')[1].split(',').map(Number);
    const face = cube.faceOf(normal[0], normal[1], normal[2]);
    const kind = Math.abs(pos[0]) + Math.abs(pos[1]) + Math.abs(pos[2]);
    const expect = kind === 2 ? opp[face] : face;
    assert.equal(map[key], expect, key);
  }
  assert.equal(cube.isSolved(apply('M2 E2 S2')), false);
});

test("括号重复、2' 和 sexy move 的周期", () => {
  assert.equal(keyOf("(R U R' U')2"), keyOf("R U R' U' R U R' U'"));
  assert.equal(notation.formatMoves(notation.parse("(R U R' U')2")), "R U R' U' R U R' U'");
  assert.equal(notation.inverseAlgorithm("(R U R' U')2"), "U R U' R' U R U' R'");
  assert.equal(keyOf("(R U R' U')2 " + notation.inverseAlgorithm("(R U R' U')2")), cube.solvedKey());
  assert.notEqual(keyOf("(R U R' U')2"), cube.solvedKey());
  assert.equal(notation.formatMoves(notation.parse("R'2")), 'R2');
  assert.equal(keyOf("R'2"), keyOf('R2'));
  assert.equal(keyOf("(M U)4"), keyOf('M U M U M U M U'));
  for (let n = 1; n <= 5; n++) {
    assert.notEqual(keyOf(repeat("R U R' U'", n)), cube.solvedKey(), 'sexy ×' + n);
    assert.equal(cube.isSolved(apply(repeat("R U R' U'", n))), false);
  }
  assert.equal(keyOf(repeat("R U R' U'", 6)), cube.solvedKey());
  assert.equal(cube.isSolved(apply("(R U R' U')6")), true);
});

test('层先法：十字、底角、中棱和 lessons.json 的描述一致', () => {
  const up = findStep('cross', '白色朝上的白棱');
  let state = apply(notation.inverseAlgorithm(up.algorithm));
  assert.equal(posName(state, EDGES.DF), 'UF');
  assert.equal(homeFacing(state, EDGES.DF, [0, -1, 0]), 'U');
  cube.applyMoves(state, notation.parse(up.algorithm));
  assert.equal(cube.isSolved(state), true);

  const front = findStep('cross', '白色朝前的白棱');
  state = apply(notation.inverseAlgorithm(front.algorithm));
  assert.equal(posName(state, EDGES.DF), 'UF');
  assert.equal(homeFacing(state, EDGES.DF, [0, -1, 0]), 'F');
  cube.applyMoves(state, notation.parse(front.algorithm));
  assert.equal(cube.isSolved(state), true);

  const once = findStep('first-corners', '白色朝右（1 次）');
  const thrice = findStep('first-corners', '白色朝上（3 次）');
  const five = findStep('first-corners', '白色朝前（5 次）');
  const expectWhite = [[once, 'R'], [thrice, 'U'], [five, 'F']];
  for (const item of expectWhite) {
    state = apply(item[0].setup || notation.inverseAlgorithm(item[0].algorithm));
    assert.equal(posName(state, CORNERS.DFR), 'UFR', item[1]);
    assert.equal(homeFacing(state, CORNERS.DFR, [0, -1, 0]), item[1]);
    cube.applyMoves(state, notation.parse(item[0].algorithm));
    assert.equal(cube.isSolved(state), true, item[1]);
  }

  const right = findStep('middle-edges', '棱块放右边');
  state = apply(notation.inverseAlgorithm(right.algorithm));
  assert.equal(posName(state, EDGES.FR), 'UF');
  assert.equal(homeFacing(state, EDGES.FR, [0, 0, 1]), 'F');
  cube.applyMoves(state, notation.parse(right.algorithm));
  assert.equal(cube.isSolved(state), true);

  const left = findStep('middle-edges', '棱块放左边');
  state = apply(notation.inverseAlgorithm(left.algorithm));
  assert.equal(posName(state, EDGES.FL), 'UF');
  assert.equal(homeFacing(state, EDGES.FL, [0, 0, 1]), 'F');
  cube.applyMoves(state, notation.parse(left.algorithm));
  assert.equal(cube.isSolved(state), true);
});

test('顶十字、小鱼和文案一致：一字变十字，L 和点按描述过渡', () => {
  const line = play(findStep('top-cross', '一字形'));
  assert.deepEqual(line.before.edges, ['UL', 'UR']);
  assert.deepEqual(line.after.edges, ['UB', 'UF', 'UL', 'UR']);
  assert.equal(line.after.solved, true);

  const ell = play(findStep('top-cross', 'L 形'));
  assert.deepEqual(ell.before.edges, ['UB', 'UL']);
  assert.deepEqual(ell.after.edges, ['UL', 'UR']);
  assert.equal(ell.after.solved, false);

  const dot = play(findStep('top-cross', '点'));
  assert.deepEqual(dot.before.edges, []);
  assert.deepEqual(dot.after.edges, ['UF', 'UR']);
  assert.equal(dot.after.solved, false);

  const fish = play(findStep('top-face', '小鱼'));
  assert.deepEqual(yellowUp(fish.before.corners), ['UFL']);
  assert.equal(fish.before.corners.UFR, 'F');
  assert.deepEqual(fish.before.edges, ['UB', 'UF', 'UL', 'UR']);
  assert.equal(fish.after.solved, true);

  const none = play(findStep('top-face', '没有黄角朝上'));
  assert.deepEqual(yellowUp(none.before.corners), []);
  assert.equal(none.before.corners.UFL, 'L');
  assert.deepEqual(yellowUp(none.after.corners), ['UFL']);
  assert.equal(none.after.f2l, true);

  const two = play(findStep('top-face', '两个黄角朝上'));
  assert.equal(two.before.corners.UFL, 'F');
  assert.equal(yellowUp(two.before.corners).length, 2);
  assert.equal(yellowUp(two.after.corners).length, 1);
  assert.equal(two.after.f2l, true);
});

test('两步 OLL 的七个角情形和三条棱情形与文案一致，且不破坏前两层', () => {
  const cases = [
    ['一字', { edges: ['UL', 'UR'] }, { edges: ['UB', 'UF', 'UL', 'UR'] }],
    ['L 形', { edges: ['UB', 'UL'] }, { edges: ['UB', 'UF', 'UL', 'UR'] }],
    ['点', { edges: [] }, { edges: ['UB', 'UF', 'UL', 'UR'] }]
  ];
  for (const item of cases) {
    const got = play(findStep('oll-2look', item[0]));
    assert.deepEqual(got.before.edges, item[1].edges, item[0]);
    assert.deepEqual(got.after.edges, item[2].edges, item[0]);
    assert.equal(got.before.f2l, true, item[0]);
    assert.equal(got.after.solved, true, item[0]);
  }

  const sune = play(findStep('oll-2look', 'Sune'));
  assert.deepEqual(yellowUp(sune.before.corners), ['UFL']);
  assert.equal(sune.before.corners.UFR, 'F');
  assert.equal(sune.after.solved, true);

  const anti = play(findStep('oll-2look', 'Anti-Sune'));
  assert.deepEqual(yellowUp(anti.before.corners), ['UBR']);
  assert.equal(anti.before.corners.UFL, 'F');
  assert.equal(anti.after.solved, true);

  const h = play(findStep('oll-2look', 'H'));
  assert.deepEqual(yellowUp(h.before.corners), []);
  assert.equal(h.before.corners.UFL, 'L');
  assert.equal(h.before.corners.UBL, 'L');
  assert.equal(h.before.corners.UFR, 'R');
  assert.equal(h.before.corners.UBR, 'R');

  const pi = play(findStep('oll-2look', 'Pi'));
  assert.deepEqual(yellowUp(pi.before.corners), []);
  assert.equal(pi.before.corners.UFL, 'L');
  assert.equal(pi.before.corners.UBL, 'L');
  assert.equal(pi.before.corners.UFR, 'F');
  assert.equal(pi.before.corners.UBR, 'B');

  const u = play(findStep('oll-2look', 'U / Headlights'));
  assert.deepEqual(yellowUp(u.before.corners), ['UBL', 'UBR']);
  assert.equal(u.before.corners.UFL, 'F');
  assert.equal(u.before.corners.UFR, 'F');

  const tee = play(findStep('oll-2look', 'T'));
  assert.deepEqual(yellowUp(tee.before.corners), ['UBR', 'UFR']);
  assert.equal(tee.before.corners.UFL, 'F');
  assert.equal(tee.before.corners.UBL, 'B');

  const bow = play(findStep('oll-2look', 'L / Bowtie'));
  assert.deepEqual(yellowUp(bow.before.corners), ['UBR', 'UFL']);
  assert.equal(bow.before.corners.UFR, 'F');

  const lesson = lessons.tracks.find((track) => track.id === 'cfop').lessons.find((item) => item.id === 'oll-2look');
  for (const step of lesson.steps) {
    if (!step.algorithm) continue;
    const got = play(step);
    assert.equal(got.before.f2l, true, step.caseName);
    assert.equal(got.after.f2l, true, step.caseName);
    assert.equal(got.after.solved, true, step.caseName);
    const held = apply('U2');
    cube.applyMoves(held, notation.parse(step.algorithm));
    assert.equal(f2lOk(held), true, step.caseName + ' 在 U2 上仍保持前两层');
  }
});

test('T-perm、Y-perm、Ua/Ub/H/Z 在复原态上的效果与文案一致', () => {
  const tAlg = findStep('pll-2look', '相邻换角（T）').algorithm;
  const t = apply(tAlg);
  assert.deepEqual(moved(t, ['UF', 'UR', 'UB', 'UL']), { UR: 'UL', UL: 'UR' });
  assert.deepEqual(moved(t, ['UFR', 'UFL', 'UBR', 'UBL']), { UFR: 'UBR', UBR: 'UFR' });
  assert.equal(f2lOk(t), true);
  assert.equal(cube.isSolved(apply(repeat(tAlg, 2))), true);
  assert.equal(cube.isSolved(t), false);
  const tCase = apply(notation.inverseAlgorithm(tAlg));
  assert.deepEqual(headlights(tCase), ['L']);
  cube.applyMoves(tCase, notation.parse(tAlg));
  assert.equal(cube.isSolved(tCase), true);

  const yAlg = findStep('pll-2look', '对角换角（Y）').algorithm;
  const y = apply(yAlg);
  assert.deepEqual(moved(y, ['UF', 'UR', 'UB', 'UL']), { UB: 'UL', UL: 'UB' });
  assert.deepEqual(moved(y, ['UFR', 'UFL', 'UBR', 'UBL']), { UFR: 'UBL', UBL: 'UFR' });
  assert.equal(cube.isSolved(apply(repeat(yAlg, 2))), true);
  assert.deepEqual(headlights(apply(yAlg)), []);
  const yCase = apply(notation.inverseAlgorithm(yAlg));
  cube.applyMoves(yCase, notation.parse(yAlg));
  assert.equal(cube.isSolved(yCase), true);

  const ua = findStep('top-edges', '三棱逆时针（Ua）').algorithm;
  const uaState = apply(ua);
  assert.deepEqual(moved(uaState, ['UF', 'UR', 'UB', 'UL']), { UF: 'UR', UR: 'UL', UL: 'UF' });
  assert.deepEqual(moved(uaState, ['UFR', 'UFL', 'UBR', 'UBL']), {});
  assert.deepEqual(bars(apply(notation.inverseAlgorithm(ua))), ['B']);
  assert.equal(cube.isSolved(apply(repeat(ua, 1))), false);
  assert.equal(cube.isSolved(apply(repeat(ua, 2))), false);
  assert.equal(cube.isSolved(apply(repeat(ua, 3))), true);

  const ub = findStep('top-edges', '三棱顺时针（Ub）').algorithm;
  assert.deepEqual(moved(apply(ub), ['UF', 'UR', 'UB', 'UL']), { UF: 'UL', UL: 'UR', UR: 'UF' });
  assert.deepEqual(bars(apply(notation.inverseAlgorithm(ub))), ['B']);
  assert.equal(cube.isSolved(apply(repeat(ub, 3))), true);
  assert.equal(keyOf(ua), keyOf(findStep('pll-2look', 'Ua').algorithm));
  assert.equal(keyOf(ub), keyOf(findStep('pll-2look', 'Ub').algorithm));

  const h = findStep('pll-2look', 'H').algorithm;
  assert.deepEqual(moved(apply(h), ['UF', 'UR', 'UB', 'UL']), { UF: 'UB', UB: 'UF', UR: 'UL', UL: 'UR' });
  assert.deepEqual(bars(apply(notation.inverseAlgorithm(h))), []);
  assert.equal(cube.isSolved(apply(repeat(h, 2))), true);

  const z = findStep('pll-2look', 'Z').algorithm;
  assert.deepEqual(moved(apply(z), ['UF', 'UR', 'UB', 'UL']), { UF: 'UL', UL: 'UF', UB: 'UR', UR: 'UB' });
  assert.deepEqual(bars(apply(notation.inverseAlgorithm(z))), []);
  assert.equal(cube.isSolved(apply(repeat(z, 2))), true);

  const corners = findStep('top-corners', '有一对车灯');
  const cornerCase = apply(notation.inverseAlgorithm(corners.algorithm));
  assert.deepEqual(headlights(cornerCase), ['B']);
  cube.applyMoves(cornerCase, notation.parse(corners.algorithm));
  assert.equal(cube.isSolved(cornerCase), true);

  const none = findStep('top-corners', '没有车灯');
  assert.deepEqual(headlights(apply(none.setup)), []);
  let fixed = false;
  for (const u of ['', 'U', 'U2', "U'"]) {
    const state = apply(none.setup);
    cube.applyMoves(state, notation.parse(none.algorithm));
    if (u) cube.applyMoves(state, notation.parse(u));
    if (headlights(state).join(',') !== 'B') continue;
    cube.applyMoves(state, notation.parse(none.algorithm));
    if (headlights(state).length === 4) fixed = true;
  }
  assert.equal(fixed, true);

  for (const alg of [tAlg, yAlg, ua, ub, h, z, corners.algorithm]) {
    const held = apply('U2');
    cube.applyMoves(held, notation.parse(alg));
    assert.equal(f2lOk(held), true, alg);
  }
});

test('每条课程公式和它的逆连做都回到原状态', () => {
  let count = 0;
  const origin = cube.solvedKey();
  for (const track of lessons.tracks) {
    for (const lesson of track.lessons) {
      for (const step of lesson.steps) {
        if (step.setup) notation.parse(step.setup);
        if (!step.algorithm) continue;
        count++;
        const moves = notation.parse(step.algorithm);
        const inv = notation.invertMoves(moves);
        const forward = cube.createSolved();
        cube.applyMoves(forward, moves);
        cube.applyMoves(forward, inv);
        assert.equal(cube.stateKey(forward), origin, step.caseName || lesson.id);
        const backward = cube.createSolved();
        cube.applyMoves(backward, inv);
        cube.applyMoves(backward, moves);
        assert.equal(cube.stateKey(backward), origin, '逆先 ' + (step.caseName || lesson.id));
        assert.equal(cube.isValid(forward), true);
      }
    }
  }
  assert.equal(count, 55);
});
