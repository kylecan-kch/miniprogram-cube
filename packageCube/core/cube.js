/**
 * 三阶魔方状态（块级模型，纯 JS，不依赖小程序 API）。
 *
 * 坐标：+x 右、+y 上、+z 前。拿法固定为白底黄顶（D 白、U 黄、F 绿、B 蓝、R 红、L 橙），
 * 颜色只影响显示；本文件用面字母 U D F B R L。
 *
 * 转动与 tools/verify_lessons.py 的贴纸模拟器一致：
 * 绕正轴的一步是右手系 +90°（从正方向看为逆时针），
 * (x,y,z) 在 X/Y/Z 上分别变成 (x,-z,y) / (z,y,-x) / (-y,x,z)。
 * 字母的方向系数 d 与该脚本的 _BASE / _WIDE 相同，实际步数是 (d * 后缀) mod 4。
 */

var IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** 绕 +X / +Y / +Z 的右手 +90°，行主序，作用在列向量上 */
var PLUS90 = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1]
];

function mod4(q) {
  return ((q % 4) + 4) % 4;
}

function mulMat(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
  ];
}

function mulVec(m, x, y, z) {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z
  ];
}

var POW = [[null, null, null, null], [null, null, null, null], [null, null, null, null]];
(function buildPow() {
  for (var axis = 0; axis < 3; axis++) {
    var m = IDENT.slice();
    POW[axis][0] = IDENT.slice();
    for (var step = 1; step <= 3; step++) {
      m = mulMat(PLUS90[axis], m);
      POW[axis][step] = m;
    }
  }
})();

function faceOf(x, y, z) {
  if (x === 1) return 'R';
  if (x === -1) return 'L';
  if (y === 1) return 'U';
  if (y === -1) return 'D';
  if (z === 1) return 'F';
  if (z === -1) return 'B';
  return '';
}

function createSolved() {
  var cubies = [];
  for (var x = -1; x <= 1; x++) {
    for (var y = -1; y <= 1; y++) {
      for (var z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        cubies.push({
          home: [x, y, z],
          pos: [x, y, z],
          ori: IDENT.slice()
        });
      }
    }
  }
  return { cubies: cubies };
}

/**
 * 执行一步。move: { axis:0|1|2, layers:number[], q:number }
 * q 为带符号的四分之一圈数（与 verify_lessons.py 相同），2 与 -2 都是 180°。
 */
function applyMove(state, move) {
  var steps = mod4(move.q);
  if (!steps) return state;
  var rot = POW[move.axis][steps];
  var axis = move.axis;
  var layers = move.layers;
  var cubies = state.cubies;
  for (var i = 0; i < cubies.length; i++) {
    var c = cubies[i];
    var coord = c.pos[axis];
    var on = false;
    for (var k = 0; k < layers.length; k++) {
      if (layers[k] === coord) { on = true; break; }
    }
    if (!on) continue;
    var p = mulVec(rot, c.pos[0], c.pos[1], c.pos[2]);
    c.pos[0] = p[0];
    c.pos[1] = p[1];
    c.pos[2] = p[2];
    c.ori = mulMat(rot, c.ori);
  }
  return state;
}

function applyMoves(state, moves) {
  for (var i = 0; i < moves.length; i++) applyMove(state, moves[i]);
  return state;
}

/** 含中心块朝向在内的完整状态，用来判断“做 4 次回到原状”这种严格恒等 */
function stateKey(state) {
  var parts = [];
  var cubies = state.cubies;
  for (var i = 0; i < cubies.length; i++) {
    var c = cubies[i];
    parts.push(c.home.join(',') + ':' + c.pos.join(',') + ':' + c.ori.join(','));
  }
  parts.sort();
  return parts.join(';');
}

/**
 * 贴纸：键为 "px,py,pz|nx,ny,nz"，值为面字母颜色。
 * 中心块绕自身法线的扭转不会改变贴纸，因此还原判断以贴纸为准。
 */
function stickerMap(state) {
  var out = {};
  var cubies = state.cubies;
  for (var i = 0; i < cubies.length; i++) {
    var c = cubies[i];
    for (var a = 0; a < 3; a++) {
      if (c.home[a] === 0) continue;
      var sx = 0;
      var sy = 0;
      var sz = 0;
      if (a === 0) sx = c.home[0] > 0 ? 1 : -1;
      else if (a === 1) sy = c.home[1] > 0 ? 1 : -1;
      else sz = c.home[2] > 0 ? 1 : -1;
      var n = mulVec(c.ori, sx, sy, sz);
      var color = faceOf(sx, sy, sz);
      out[c.pos[0] + ',' + c.pos[1] + ',' + c.pos[2] + '|' + n[0] + ',' + n[1] + ',' + n[2]] = color;
    }
  }
  return out;
}

var SOLVED_KEY = null;
var SOLVED_STICKERS = null;

function solvedKey() {
  if (!SOLVED_KEY) SOLVED_KEY = stateKey(createSolved());
  return SOLVED_KEY;
}

function isSolved(state) {
  if (!SOLVED_STICKERS) SOLVED_STICKERS = stickerMap(createSolved());
  var now = stickerMap(state);
  var keys = Object.keys(SOLVED_STICKERS);
  if (Object.keys(now).length !== keys.length) return false;
  for (var i = 0; i < keys.length; i++) {
    if (now[keys[i]] !== SOLVED_STICKERS[keys[i]]) return false;
  }
  return true;
}

/** 位置不重复、坐标仍是 -1/0/1，用来确认打乱公式没有把状态算坏 */
function isValid(state) {
  if (!state || !state.cubies || state.cubies.length !== 26) return false;
  var seen = {};
  for (var i = 0; i < state.cubies.length; i++) {
    var p = state.cubies[i].pos;
    if (p[0] < -1 || p[0] > 1 || p[1] < -1 || p[1] > 1 || p[2] < -1 || p[2] > 1) return false;
    if ((p[0] | 0) !== p[0] || (p[1] | 0) !== p[1] || (p[2] | 0) !== p[2]) return false;
    var k = p.join(',');
    if (seen[k] || (p[0] === 0 && p[1] === 0 && p[2] === 0)) return false;
    seen[k] = true;
  }
  return Object.keys(seen).length === 26;
}

module.exports = {
  IDENT: IDENT,
  PLUS90: PLUS90,
  POW: POW,
  mod4: mod4,
  mulMat: mulMat,
  mulVec: mulVec,
  faceOf: faceOf,
  createSolved: createSolved,
  applyMove: applyMove,
  applyMoves: applyMoves,
  stateKey: stateKey,
  stickerMap: stickerMap,
  solvedKey: solvedKey,
  isSolved: isSolved,
  isValid: isValid
};
