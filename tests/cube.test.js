const test = require('node:test');
const assert = require('node:assert/strict');
const cube = require('../packageCube/core/cube.js');
const notation = require('../packageCube/core/notation.js');
const glcube = require('../packageCube/components/cube-stage/glcube.js');

const LETTERS = ['R', 'L', 'U', 'D', 'F', 'B', 'r', 'l', 'u', 'd', 'f', 'b', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw', 'M', 'E', 'S', 'x', 'y', 'z'];

function keyOf(alg) {
  const state = cube.createSolved();
  if (alg) cube.applyMoves(state, notation.parse(alg));
  return cube.stateKey(state);
}

function solvedKey() {
  return cube.solvedKey();
}

test('复原状态：26 块、54 张贴纸、判定为已还原', () => {
  const state = cube.createSolved();
  assert.equal(state.cubies.length, 26);
  assert.equal(Object.keys(cube.stickerMap(state)).length, 54);
  assert.equal(cube.isSolved(state), true);
  assert.equal(cube.isValid(state), true);
});

test('每种转动做 4 次回到原状，X 与 X\' 抵消', () => {
  for (const base of LETTERS) {
    for (const suf of ['', "'", '2', "2'"]) {
      const alg = base + suf;
      const once = notation.parse(alg);
      assert.equal(once.length, 1, alg);
      const state = cube.createSolved();
      const origin = cube.stateKey(state);
      for (let i = 0; i < 4; i++) cube.applyMove(state, once[0]);
      assert.equal(cube.stateKey(state), origin, alg + ' ×4');
      assert.equal(keyOf(alg + ' ' + notation.formatMoves(notation.invertMoves(once))), origin, alg + ' 与逆抵消');
    }
  }
});

test('2\' 与 2 相同', () => {
  for (const base of ['R', 'U', 'M', 'f', 'x', 'Rw']) {
    assert.equal(keyOf(base + '2'), keyOf(base + "2'"));
  }
});

test('已知恒等式', () => {
  const sexy = "(R U R' U')6";
  const sexyFlat = Array(6).fill("R U R' U'").join(' ');
  assert.equal(keyOf(sexy), solvedKey());
  assert.equal(keyOf(sexyFlat), solvedKey());
  assert.equal(cube.isSolved(cube.applyMoves(cube.createSolved(), notation.parse(sexy))), true);

  // 标准定义：r = R M'，所以 r R' = M'。M 方向同 L，不是同 R。
  assert.equal(keyOf("r R'"), keyOf("M'"));
  assert.equal(keyOf("Rw R'"), keyOf("M'"));
  assert.equal(keyOf("l L'"), keyOf('M'));
  assert.equal(keyOf('x'), keyOf("R M' L'"));
  assert.equal(keyOf('y'), keyOf("U E' D'"));
  assert.equal(keyOf('z'), keyOf("F S B'"));
  assert.equal(keyOf('f'), keyOf('F S'));
  assert.equal(keyOf('b'), keyOf("B S'"));
  assert.equal(keyOf("M2"), keyOf('M M'));
  assert.equal(keyOf("M' M"), solvedKey());
});

test('求逆后 algorithm + inverse 与 inverse + algorithm 都是恒等', () => {
  const samples = [
    'R',
    "R'",
    'R2',
    'M2',
    "M'",
    'f',
    "r U R' U' r' F R F'",
    "F R U R' U' F' f R U R' U' f'",
    "M2 U M2 U2 M2 U M2",
    "M' U M2 U M2 U M' U2 M2 U'",
    "(R U)3",
    "(R U R' U')2"
  ];
  for (const alg of samples) {
    const moves = notation.parse(alg);
    const inv = notation.invertMoves(moves);
    const state = cube.createSolved();
    cube.applyMoves(state, moves);
    cube.applyMoves(state, inv);
    assert.equal(cube.stateKey(state), solvedKey(), alg + ' + inv');
    const state2 = cube.createSolved();
    cube.applyMoves(state2, inv);
    cube.applyMoves(state2, moves);
    assert.equal(cube.stateKey(state2), solvedKey(), 'inv + ' + alg);
  }
});

test('解析器容错：空格、无空格、括号、重复、宽层两种写法', () => {
  assert.deepEqual(notation.formatMoves(notation.parse('  R   U\tR\'  ')), "R U R'");
  assert.deepEqual(notation.formatMoves(notation.parse('RU')), 'R U');
  assert.deepEqual(notation.formatMoves(notation.parse("R2U'")), "R2 U'");
  assert.deepEqual(notation.formatMoves(notation.parse('(R U R\' U\')')), "R U R' U'");
  assert.deepEqual(notation.formatMoves(notation.parse('(R U)3')), 'R U R U R U');
  assert.deepEqual(notation.formatMoves(notation.parse('(R U) 2')), 'R U R U');
  assert.deepEqual(notation.formatMoves(notation.parse('((R U)2 R\')')), "R U R U R'");
  assert.deepEqual(notation.formatMoves(notation.parse('()')), '');
  assert.deepEqual(notation.formatMoves(notation.parse('(R)0')), '');
  assert.equal(keyOf('Rw'), keyOf('r'));
  assert.equal(keyOf("Fw'"), keyOf("f'"));
  assert.equal(keyOf('R′'), keyOf("R'"));
  assert.equal(notation.parse('').length, 0);
  assert.equal(notation.inverseAlgorithm("R U R' U'"), "U R U' R'");
});

test('无法识别的记号会报错', () => {
  for (const bad of ['Q', 'R3', '(R U', 'R)', '[R, U]', '(R U)99']) {
    assert.throws(() => notation.parse(bad), (err) => err instanceof Error);
  }
});

test('动画用的右手旋转与整数矩阵一致', () => {
  const samples = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, -1, 1]];
  for (let axis = 0; axis < 3; axis++) {
    for (let steps = 1; steps <= 3; steps++) {
      const theta = (steps === 3 ? -1 : steps) * Math.PI / 2;
      for (const v of samples) {
        const got = glcube.spinVector(axis, theta, v[0], v[1], v[2]);
        const exp = cube.mulVec(cube.POW[axis][steps], v[0], v[1], v[2]);
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(got[i] - exp[i]) < 1e-6, 'axis ' + axis + ' steps ' + steps);
        }
      }
    }
  }
});
