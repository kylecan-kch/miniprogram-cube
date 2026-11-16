const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const cube = require('../packageCube/core/cube.js');
const notation = require('../packageCube/core/notation.js');
const catalog = require('../packageCube/data/catalog.js');
const lessons = require('../packageCube/data/lessons.json');

const root = path.join(__dirname, '..');

function applyAlg(alg) {
  const state = cube.createSolved();
  if (alg) cube.applyMoves(state, notation.parse(alg));
  return state;
}

function mapsEqual(jsMap, pyMap, label) {
  const keys = new Set(Object.keys(jsMap).concat(Object.keys(pyMap)));
  const diffs = [];
  for (const key of keys) {
    if (jsMap[key] !== pyMap[key]) diffs.push(key + ' js=' + jsMap[key] + ' py=' + pyMap[key]);
  }
  assert.equal(diffs.length, 0, label + '\n' + diffs.slice(0, 6).join('\n'));
}

test('tips 是数组，也兼容单个字符串；存储键带 cube_ 前缀', () => {
  assert.deepEqual(catalog.tipList(['别转反', '先对齐']), ['别转反', '先对齐']);
  assert.deepEqual(catalog.tipList('只有一句'), ['只有一句']);
  assert.deepEqual(catalog.tipList(''), []);
  assert.deepEqual(catalog.tipList(null), []);
  assert.equal(catalog.LAST_KEY.indexOf('cube_'), 0);
  assert.equal(catalog.getTracks().length, 2);
  assert.equal(catalog.getLesson('cfop', 'oll-2look').title, '两步 OLL');
  assert.equal(catalog.getLesson('beginner', 'missing'), null);
});

test('lessons.json 里每条公式和 setup 都能解析，缺省 setup 做完回到还原', () => {
  let algCount = 0;
  let setupCount = 0;
  for (const track of lessons.tracks) {
    assert.ok(track.id && track.title);
    for (const lesson of track.lessons) {
      assert.ok(lesson.id && lesson.title && lesson.goal);
      assert.ok(Array.isArray(lesson.steps) && lesson.steps.length > 0);
      for (const step of lesson.steps) {
        assert.equal(typeof step.text, 'string');
        if (step.tips !== undefined) assert.ok(Array.isArray(step.tips), lesson.id + ' tips 应为数组');
        if (!step.algorithm && !step.setup) continue;
        if (step.algorithm) {
          algCount++;
          const moves = notation.parse(step.algorithm);
          assert.ok(moves.length > 0, lesson.id + ' / ' + step.caseName);
        }
        if (step.setup) {
          setupCount++;
          notation.parse(step.setup);
        }
        const state = cube.createSolved();
        if (step.setup) cube.applyMoves(state, notation.parse(step.setup));
        else cube.applyMoves(state, notation.invertMoves(notation.parse(step.algorithm)));
        assert.equal(cube.isValid(state), true, lesson.id + ' setup');
        if (step.algorithm) cube.applyMoves(state, notation.parse(step.algorithm));
        assert.equal(cube.isValid(state), true, lesson.id + ' algorithm');
        if (step.algorithm && !step.setup) {
          assert.equal(cube.isSolved(state), true, lesson.id + ' / ' + (step.caseName || '') + ' 缺省 setup 应还原');
          assert.equal(cube.stateKey(state), cube.solvedKey());
        }
      }
    }
  }
  assert.equal(algCount, 55);
  assert.ok(setupCount > 0);
});

test('内核贴纸与 verify_lessons.py 的模拟器一致', () => {
  const algs = new Set(['', 'R', "R'", 'R2', "R2'", 'M', "M'", 'M2', 'f', "f'", 'S', 'E', 'x', 'y', 'z', "r R'", "M'", 'x', "R M' L'", "U E' D'", "F S B'"]);
  const sexy = Array(6).fill("R U R' U'").join(' ');
  algs.add(sexy);
  for (const track of lessons.tracks) {
    for (const lesson of track.lessons) {
      for (const step of lesson.steps) {
        if (step.algorithm) algs.add(step.algorithm);
        if (step.setup) algs.add(step.setup);
        if (step.algorithm && step.setup) algs.add((step.setup + ' ' + step.algorithm).replace(/\s+/g, ' ').trim());
      }
    }
  }
  const list = Array.from(algs);
  const py = [
    'import json, sys, importlib.util',
    'spec = importlib.util.spec_from_file_location("v", "tools/verify_lessons.py")',
    'v = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(v)',
    'algs = json.load(sys.stdin)',
    'out = {}',
    'for alg in algs:',
    '    st = v.apply(v.solved(), alg) if alg else v.solved()',
    '    out[alg] = {"%d,%d,%d|%d,%d,%d" % (p[0], p[1], p[2], n[0], n[1], n[2]): c for (p, n), c in st.items()}',
    'json.dump(out, sys.stdout)'
  ].join('\n');
  const raw = execFileSync('python3', ['-c', py], {
    cwd: root,
    input: JSON.stringify(list),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const pyMaps = JSON.parse(raw);
  for (const alg of list) {
    mapsEqual(cube.stickerMap(applyAlg(alg)), pyMaps[alg], alg || '(solved)');
  }
});
