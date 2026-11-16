const test = require('node:test');
const assert = require('node:assert/strict');
const cube = require('../packageCube/core/cube.js');
const notation = require('../packageCube/core/notation.js');
const glcube = require('../packageCube/components/cube-stage/glcube.js');

function mockGl(opts) {
  const link = !opts || opts.link !== false;
  const deleted = { buffer: [], program: [], shader: [] };
  let seq = 1;
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    DEPTH_TEST: 7,
    CULL_FACE: 8,
    BACK: 9,
    COLOR_BUFFER_BIT: 10,
    DEPTH_BUFFER_BIT: 11,
    TRIANGLES: 4,
    FLOAT: 5126,
    createShader: function () { return { id: seq++ }; },
    shaderSource: function () {},
    compileShader: function () {},
    getShaderParameter: function () { return true; },
    getShaderInfoLog: function () { return ''; },
    deleteShader: function (shader) { deleted.shader.push(shader); },
    createProgram: function () { return { id: seq++ }; },
    attachShader: function () {},
    bindAttribLocation: function () {},
    linkProgram: function () {},
    getProgramParameter: function () { return link; },
    getProgramInfoLog: function () { return link ? '' : 'link failed'; },
    deleteProgram: function (program) { deleted.program.push(program); },
    useProgram: function () {},
    enable: function () {},
    cullFace: function () {},
    clearColor: function () {},
    getUniformLocation: function () { return {}; },
    createBuffer: function () { return { id: seq++ }; },
    bindBuffer: function () {},
    bufferData: function () {},
    deleteBuffer: function (buf) { deleted.buffer.push(buf); },
    viewport: function () {},
    clear: function () {},
    uniformMatrix4fv: function () {},
    enableVertexAttribArray: function () {},
    vertexAttribPointer: function () {},
    drawArrays: function () {}
  };
  return { gl: gl, deleted: deleted };
}

test('模型矩阵把块的贴纸法线变到转动后的方向', () => {
  const state = cube.createSolved();
  cube.applyMoves(state, notation.parse('R'));
  let found = null;
  for (let i = 0; i < state.cubies.length; i++) {
    const c = state.cubies[i];
    if (c.home[0] === 1 && c.home[1] === 0 && c.home[2] === 1) found = c;
  }
  const m = glcube.packModel(found.ori, found.pos, new Float32Array(16));
  assert.equal(m[12], found.pos[0]);
  assert.equal(m[13], found.pos[1]);
  assert.equal(m[14], found.pos[2]);
  assert.ok(Math.abs(m[8]) < 1e-6);
  assert.ok(Math.abs(m[9] - 1) < 1e-6);
  assert.ok(Math.abs(m[10]) < 1e-6);
});

test('dispose 释放 27 个缓冲和程序，链接失败也会删掉 shader', () => {
  const ok = mockGl();
  const renderer = glcube.create(ok.gl);
  assert.equal(typeof renderer.dispose, 'function');
  assert.equal(ok.deleted.shader.length, 2);
  renderer.dispose();
  assert.equal(ok.deleted.buffer.length, 27);
  assert.equal(ok.deleted.program.length, 1);
  renderer.dispose();
  assert.equal(ok.deleted.buffer.length, 27);
  assert.equal(ok.deleted.program.length, 1);

  const bad = mockGl({ link: false });
  assert.throws(() => glcube.create(bad.gl), /链接失败/);
  assert.equal(bad.deleted.shader.length, 2);
  assert.equal(bad.deleted.program.length, 1);
  assert.equal(bad.deleted.buffer.length, 0);
});
