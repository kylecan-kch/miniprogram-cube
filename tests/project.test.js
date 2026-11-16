const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function balanceWxml(text, file) {
  const cleaned = text.replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned.charAt(i) !== '<') { i++; continue; }
    if (cleaned.startsWith('</', i)) {
      const close = /^<\/([A-Za-z][\w-]*)\s*>/.exec(cleaned.slice(i));
      assert.ok(close, file + ' 有坏的闭合标签');
      assert.equal(stack.pop(), close[1], file + ' 闭合不匹配');
      i += close[0].length;
      continue;
    }
    const open = /^<([A-Za-z][\w-]*)/.exec(cleaned.slice(i));
    assert.ok(open, file + ' 有坏的标签');
    i += open[0].length;
    let selfClose = false;
    while (i < cleaned.length && cleaned.charAt(i) !== '>') {
      const q = cleaned.charAt(i);
      if (q === '"' || q === "'") {
        i++;
        while (i < cleaned.length && cleaned.charAt(i) !== q) i++;
        i++;
      } else {
        if (q === '/' && cleaned.charAt(i + 1) === '>') selfClose = true;
        i++;
      }
    }
    if (cleaned.charAt(i) === '>') i++;
    if (!selfClose) stack.push(open[1]);
  }
  assert.deepEqual(stack, [], file + ' 有未闭合标签');
}

test('小程序配置、页面和分包可以独立拷走', () => {
  const app = JSON.parse(read('app.json'));
  const project = JSON.parse(read('project.config.json'));
  assert.equal(project.libVersion, '2.32.3');
  assert.equal(project.appid, 'touristappid');
  assert.equal(app.style, 'v2');
  assert.deepEqual(app.pages, ['pages/index/index']);
  assert.equal(app.subpackages.length, 1);
  assert.equal(app.subpackages[0].root, 'packageCube');
  const ignored = project.packOptions.ignore.map((item) => item.value);
  for (const value of ['tests', 'tools', 'node_modules']) {
    assert.ok(ignored.indexOf(value) !== -1, 'packOptions 应忽略 ' + value);
  }
  const pages = app.pages.concat(app.subpackages[0].pages.map((page) => 'packageCube/' + page));
  for (const page of pages) {
    for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
      assert.equal(fs.existsSync(path.join(root, page + ext)), true, page + ext);
    }
  }
  assert.equal(fs.existsSync(path.join(root, 'packageCube/data/lessons.json')), true);
  assert.equal(fs.existsSync(path.join(root, 'packageCube/data/README.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'tools/verify_lessons.py')), true);
  JSON.parse(read('packageCube/data/lessons.json'));
  JSON.parse(read('sitemap.json'));
});

test('分包不依赖 app，类名使用 cube- 前缀', () => {
  const files = walk(root, []);
  const appJs = read('app.js');
  assert.equal(appJs.indexOf('globalData'), -1);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const rel = path.relative(root, file);
    if (rel.startsWith('packageCube' + path.sep)) {
      const text = fs.readFileSync(file, 'utf8');
      assert.equal(text.indexOf('getApp'), -1, rel + ' 不应调用 getApp');
    }
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  for (const file of files) {
    const rel = path.relative(root, file);
    if (file.endsWith('.wxml')) balanceWxml(fs.readFileSync(file, 'utf8'), rel);
    if (file.endsWith('.wxss')) {
      const css = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/@import[^;]*;/g, '');
      const classes = css.match(/\.([A-Za-z_][\w-]*)/g) || [];
      for (const cls of classes) {
        assert.equal(cls.slice(1).startsWith('cube-'), true, rel + ' 类名 ' + cls);
      }
    }
    if (file.endsWith('.wxml')) {
      const text = fs.readFileSync(file, 'utf8');
      const re = /class="([^"]*)"/g;
      let match;
      while ((match = re.exec(text))) {
        const raw = match[1].replace(/\{\{[\s\S]*?\}\}/g, ' ');
        for (const cls of raw.split(/\s+/)) {
          if (!cls) continue;
          assert.equal(cls.startsWith('cube-'), true, rel + ' 类名 ' + cls);
        }
      }
    }
  }
});

test('课程页的公式播放绑定了组件方法', () => {
  const wxml = read('packageCube/pages/lesson/lesson.wxml');
  const stageWxml = read('packageCube/components/cube-stage/cube-stage.wxml');
  const js = read('packageCube/pages/lesson/lesson.js');
  assert.match(wxml, /<cube-stage/);
  assert.match(stageWxml, /type="webgl"/);
  for (const name of ['onToggle', 'onBack', 'onForward', 'onReset', 'onStatus']) {
    assert.ok(js.indexOf(name + ': function') !== -1, 'lesson.js 缺少 ' + name);
  }
  const stage = read('packageCube/components/cube-stage/cube-stage.js');
  for (const name of ['toggle', 'stepForward', 'stepBack', 'reset']) {
    assert.ok(stage.indexOf(name + ': function') !== -1, '组件缺少 ' + name);
  }
});
