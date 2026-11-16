/**
 * 魔方公式解析与求逆。
 * 记号与 packageCube/data/README.md、tools/verify_lessons.py 一致：
 *   R L U D F B，后缀 ' 与 2（2' 与 2 相同）；
 *   宽层 r l u d f b 以及 Rw Lw Uw Dw Fw Bw；
 *   中层 M E S；整体 x y z。
 * 另外容错：多余空白、不写空格、括号分组、(R U)3 这种重复。
 * 方向系数 d 与校验脚本相同，保证同一串公式得到同一状态。
 */

var cube = require('./cube.js');

/**
 * d：绕对应正轴的四分之一圈数（正数 = 右手 +90° 的次数，见 cube.js）。
 * 单次顺时针的实际 q = d * 1，再对 4 取模。
 */
var DEFS = {
  R: { axis: 0, layers: [1], d: -1 },
  L: { axis: 0, layers: [-1], d: 1 },
  M: { axis: 0, layers: [0], d: 1 },
  x: { axis: 0, layers: [-1, 0, 1], d: -1 },
  U: { axis: 1, layers: [1], d: -1 },
  D: { axis: 1, layers: [-1], d: 1 },
  E: { axis: 1, layers: [0], d: 1 },
  y: { axis: 1, layers: [-1, 0, 1], d: -1 },
  F: { axis: 2, layers: [1], d: -1 },
  B: { axis: 2, layers: [-1], d: 1 },
  S: { axis: 2, layers: [0], d: -1 },
  z: { axis: 2, layers: [-1, 0, 1], d: -1 },
  r: { axis: 0, layers: [0, 1], d: -1 },
  l: { axis: 0, layers: [-1, 0], d: 1 },
  u: { axis: 1, layers: [0, 1], d: -1 },
  d: { axis: 1, layers: [-1, 0], d: 1 },
  f: { axis: 2, layers: [0, 1], d: -1 },
  b: { axis: 2, layers: [-1, 0], d: 1 }
};

var WIDE_NAME = { R: 'r', L: 'l', U: 'u', D: 'd', F: 'f', B: 'b' };
var MAX_REPEAT = 24;

function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

function textOf(base, d, q) {
  var mul = cube.mod4(q * d);
  if (mul === 1) return base;
  if (mul === 2) return base + '2';
  if (mul === 3) return base + "'";
  return base + '2';
}

function makeMove(base, def, q) {
  return {
    base: base,
    axis: def.axis,
    layers: def.layers,
    d: def.d,
    q: q,
    text: textOf(base, def.d, q)
  };
}

function cloneMove(m) {
  return {
    base: m.base,
    axis: m.axis,
    layers: m.layers,
    d: m.d,
    q: m.q,
    text: m.text
  };
}

function parseError(src, index, msg) {
  var err = new Error(msg + '（位置 ' + index + '）');
  err.index = index;
  err.source = src;
  return err;
}

/**
 * @param {string} input
 * @returns {Array<{base:string,axis:number,layers:number[],d:number,q:number,text:string}>}
 */
function parse(input) {
  var src = input == null ? '' : String(input);
  var i = 0;
  var n = src.length;

  function skip() {
    while (i < n && isSpace(src.charAt(i))) i++;
  }

  function readRepeat() {
    skip();
    if (i >= n || src.charAt(i) < '0' || src.charAt(i) > '9') return 1;
    var num = 0;
    while (i < n && src.charAt(i) >= '0' && src.charAt(i) <= '9') {
      num = num * 10 + (src.charCodeAt(i) - 48);
      i++;
      if (num > MAX_REPEAT) throw parseError(src, i, '重复次数过大（最多 ' + MAX_REPEAT + '）');
    }
    return num;
  }

  function readSuffix() {
    var two = src.slice(i, i + 2);
    if (two === "2'" || two === '2′' || two === "2’") { i += 2; return 2; }
    var ch = src.charAt(i);
    if (ch === '2') { i += 1; return 2; }
    if (ch === "'" || ch === '′' || ch === '’') {
      i += 1;
      if (src.charAt(i) === '2') { i += 1; return 2; }
      return -1;
    }
    return 1;
  }

  function readOne() {
    var two = src.slice(i, i + 2);
    var base;
    var def;
    if (/^[RLUDFB]w$/.test(two)) {
      base = two;
      def = DEFS[WIDE_NAME[two.charAt(0)]];
      i += 2;
    } else {
      var ch = src.charAt(i);
      def = DEFS[ch];
      if (!def) throw parseError(src, i, '无法识别的记号 "' + (ch || '结尾') + '"');
      base = ch;
      i += 1;
    }
    var mul = readSuffix();
    return makeMove(base, def, def.d * mul);
  }

  function readSeq(stopChar) {
    var moves = [];
    skip();
    while (i < n && src.charAt(i) !== stopChar) {
      if (src.charAt(i) === '(') {
        var openAt = i;
        i++;
        var inner = readSeq(')');
        if (src.charAt(i) !== ')') throw parseError(src, openAt, '括号没有闭合');
        i++;
        var rep = readRepeat();
        for (var r = 0; r < rep; r++) {
          for (var k = 0; k < inner.length; k++) moves.push(cloneMove(inner[k]));
        }
      } else if (src.charAt(i) === ')') {
        break;
      } else {
        moves.push(readOne());
      }
      skip();
    }
    return moves;
  }

  var moves = readSeq('');
  skip();
  if (i < n) throw parseError(src, i, '公式没有解析完，剩余 "' + src.slice(i, i + 12) + '"');
  return moves;
}

function invertMove(m) {
  return makeMove(m.base, { axis: m.axis, layers: m.layers, d: m.d }, -m.q);
}

function invertMoves(moves) {
  var out = [];
  for (var i = moves.length - 1; i >= 0; i--) out.push(invertMove(moves[i]));
  return out;
}

function formatMoves(moves) {
  var parts = [];
  for (var i = 0; i < moves.length; i++) parts.push(moves[i].text);
  return parts.join(' ');
}

/** 没有 setup 时，用公式的逆把复原状态打乱到该情形 */
function inverseAlgorithm(input) {
  return formatMoves(invertMoves(parse(input)));
}

module.exports = {
  DEFS: DEFS,
  parse: parse,
  invertMove: invertMove,
  invertMoves: invertMoves,
  formatMoves: formatMoves,
  inverseAlgorithm: inverseAlgorithm
};
