/**
 * 自写 WebGL1 魔方渲染。不引入 three.js：26 个块、一个着色器、初始化时建好顶点缓冲，
 * 每帧只更新复用的矩阵，避免在低端安卓上频繁分配。
 * dispose 删掉 buffer 和 program（没有 texture）。
 *
 * 颜色：白底黄顶，前绿后蓝、右红左橙（数据说明只规定了相对色，前面具体颜色见项目 README）。
 * 动画旋转用右手系，角度与 cube.js 的整数矩阵一致（R 为绕 +X 的 -90°，等等）。
 */

var cube = require('../../core/cube.js');

var COLORS = {
  U: [0.96, 0.80, 0.08],
  D: [0.94, 0.94, 0.95],
  F: [0.00, 0.61, 0.27],
  B: [0.00, 0.31, 0.72],
  R: [0.80, 0.09, 0.14],
  L: [1.00, 0.45, 0.04]
};
var PLASTIC = [0.07, 0.075, 0.085];

var VS = [
  'precision mediump float;',
  'attribute vec3 aPos;',
  'attribute vec3 aNrm;',
  'attribute vec3 aCol;',
  'uniform mat4 uVP;',
  'uniform mat4 uModel;',
  'varying vec3 vCol;',
  'varying vec3 vNrm;',
  'void main(){',
  '  gl_Position = uVP * uModel * vec4(aPos, 1.0);',
  '  vNrm.x = dot(vec3(uModel[0].x, uModel[1].x, uModel[2].x), aNrm);',
  '  vNrm.y = dot(vec3(uModel[0].y, uModel[1].y, uModel[2].y), aNrm);',
  '  vNrm.z = dot(vec3(uModel[0].z, uModel[1].z, uModel[2].z), aNrm);',
  '  vCol = aCol;',
  '}'
].join('\n');

var FS = [
  'precision mediump float;',
  'varying vec3 vCol;',
  'varying vec3 vNrm;',
  'void main(){',
  '  vec3 n = normalize(vNrm);',
  '  float lam = max(dot(n, normalize(vec3(0.32, 0.78, 0.52))), 0.0);',
  '  float shade = 0.64 + 0.36 * lam;',
  '  gl_FragColor = vec4(vCol * shade, 1.0);',
  '}'
].join('\n');

function tangents(n) {
  var u = n[0] === 0 ? [1, 0, 0] : [0, 1, 0];
  var v = [
    n[1] * u[2] - n[2] * u[1],
    n[2] * u[0] - n[0] * u[2],
    n[0] * u[1] - n[1] * u[0]
  ];
  return [u, v];
}

function pushV(dst, p, n, color) {
  dst.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2]);
}

function addFace(dst, n, lift, extent, color) {
  var tv = tangents(n);
  var u = tv[0];
  var v = tv[1];
  var c = [n[0] * lift, n[1] * lift, n[2] * lift];
  function corner(su, sv) {
    return [
      c[0] + su * u[0] * extent + sv * v[0] * extent,
      c[1] + su * u[1] * extent + sv * v[1] * extent,
      c[2] + su * u[2] * extent + sv * v[2] * extent
    ];
  }
  var p00 = corner(-1, -1);
  var p10 = corner(1, -1);
  var p11 = corner(1, 1);
  var p01 = corner(-1, 1);
  pushV(dst, p00, n, color);
  pushV(dst, p10, n, color);
  pushV(dst, p11, n, color);
  pushV(dst, p00, n, color);
  pushV(dst, p11, n, color);
  pushV(dst, p01, n, color);
}

function compile(gl, type, src) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('着色器编译失败: ' + log);
  }
  return shader;
}

function axisAngle(out, axis, theta) {
  var x = axis === 0 ? 1 : 0;
  var y = axis === 1 ? 1 : 0;
  var z = axis === 2 ? 1 : 0;
  var c = Math.cos(theta);
  var s = Math.sin(theta);
  var t = 1 - c;
  var r00 = t * x * x + c;
  var r01 = t * x * y - s * z;
  var r02 = t * x * z + s * y;
  var r10 = t * x * y + s * z;
  var r11 = t * y * y + c;
  var r12 = t * y * z - s * x;
  var r20 = t * x * z - s * y;
  var r21 = t * y * z + s * x;
  var r22 = t * z * z + c;
  out[0] = r00; out[1] = r10; out[2] = r20; out[3] = 0;
  out[4] = r01; out[5] = r11; out[6] = r21; out[7] = 0;
  out[8] = r02; out[9] = r12; out[10] = r22; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
}

function mul4(out, a, b) {
  var a00 = a[0], a01 = a[4], a02 = a[8], a03 = a[12];
  var a10 = a[1], a11 = a[5], a12 = a[9], a13 = a[13];
  var a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  var a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];
  var b0, b1, b2, b3;
  for (var i = 0; i < 4; i++) {
    b0 = b[i * 4]; b1 = b[i * 4 + 1]; b2 = b[i * 4 + 2]; b3 = b[i * 4 + 3];
    out[i * 4] = a00 * b0 + a01 * b1 + a02 * b2 + a03 * b3;
    out[i * 4 + 1] = a10 * b0 + a11 * b1 + a12 * b2 + a13 * b3;
    out[i * 4 + 2] = a20 * b0 + a21 * b1 + a22 * b2 + a23 * b3;
    out[i * 4 + 3] = a30 * b0 + a31 * b1 + a32 * b2 + a33 * b3;
  }
}

function perspective(out, fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2);
  var nf = 1 / (near - far);
  out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
  out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
}

function lookAt(out, eye) {
  var zx = eye[0];
  var zy = eye[1];
  var zz = eye[2];
  var len = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
  zx /= len; zy /= len; zz /= len;
  // right = normalize(cross(up, forward))，up 固定为 +Y，注视原点
  var xx = zz;
  var xy = 0;
  var xz = -zx;
  len = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
  xx /= len; xy /= len; xz /= len;
  var yx = zy * xz - zz * xy;
  var yy = zz * xx - zx * xz;
  var yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
}

function bufferFrom(gl, verts) {
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  return { buf: buf, count: verts.length / 9 };
}

/** 行主序 3×3 朝向 + 平移，写成 WebGL 列主序 4×4。 */
function packModel(ori, pos, out) {
  out[0] = ori[0]; out[1] = ori[3]; out[2] = ori[6]; out[3] = 0;
  out[4] = ori[1]; out[5] = ori[4]; out[6] = ori[7]; out[7] = 0;
  out[8] = ori[2]; out[9] = ori[5]; out[10] = ori[8]; out[11] = 0;
  out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
  return out;
}

function homeKey(home) {
  return (home[0] + 1) + (home[1] + 1) * 3 + (home[2] + 1) * 9;
}

function create(gl) {
  var shaders = [];
  var buffers = [];
  var program = null;

  function dispose() {
    for (var i = 0; i < buffers.length; i++) {
      if (!buffers[i]) continue;
      try { gl.deleteBuffer(buffers[i]); } catch (e) { /* 上下文可能已经没了 */ }
      buffers[i] = null;
    }
    if (program) {
      try { gl.deleteProgram(program); } catch (e) {}
      program = null;
    }
    for (var s = 0; s < shaders.length; s++) {
      if (!shaders[s]) continue;
      try { gl.deleteShader(shaders[s]); } catch (e) {}
      shaders[s] = null;
    }
  }

  try {
    var vs = compile(gl, gl.VERTEX_SHADER, VS);
    shaders.push(vs);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    shaders.push(fs);
    var prog = gl.createProgram();
    program = prog;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.bindAttribLocation(prog, 1, 'aNrm');
    gl.bindAttribLocation(prog, 2, 'aCol');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('着色器链接失败: ' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    shaders[0] = null;
    shaders[1] = null;
    gl.useProgram(prog);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.91, 0.94, 0.97, 1);

    var bodyVerts = [];
    var normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (var f = 0; f < normals.length; f++) addFace(bodyVerts, normals[f], 0.45, 0.45, PLASTIC);
    var body = bufferFrom(gl, bodyVerts);
    buffers.push(body.buf);

    var stickers = {};
    var solved = cube.createSolved();
    for (var i = 0; i < solved.cubies.length; i++) {
      var home = solved.cubies[i].home;
      var sv = [];
      for (var a = 0; a < 3; a++) {
        if (home[a] === 0) continue;
        var n = [0, 0, 0];
        n[a] = home[a] > 0 ? 1 : -1;
        var name = cube.faceOf(n[0], n[1], n[2]);
        addFace(sv, n, 0.478, 0.34, COLORS[name]);
      }
      var mesh = bufferFrom(gl, sv);
      buffers.push(mesh.buf);
      stickers[homeKey(home)] = mesh;
    }

    var uVP = gl.getUniformLocation(prog, 'uVP');
    var uModel = gl.getUniformLocation(prog, 'uModel');
    var vp = new Float32Array(16);
    var proj = new Float32Array(16);
    var view = new Float32Array(16);
    var model = new Float32Array(16);
    var spun = new Float32Array(16);
    var spin = new Float32Array(16);
    var eye = [0, 0, 0];

    function bindMesh(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      gl.enableVertexAttribArray(0);
      gl.enableVertexAttribArray(1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    }

    function modelOf(out, c) {
      packModel(c.ori, c.pos, out);
    }

    function draw(state, yaw, pitch, spinInfo, width, height) {
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var aspect = width / Math.max(1, height);
      perspective(proj, 34 * Math.PI / 180, aspect, 0.1, 40);
      var cp = Math.cos(pitch);
      var dist = 8.2;
      eye[0] = dist * cp * Math.sin(yaw);
      eye[1] = dist * Math.sin(pitch);
      eye[2] = dist * cp * Math.cos(yaw);
      lookAt(view, eye);
      mul4(vp, proj, view);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(uVP, false, vp);

      var useSpin = spinInfo && spinInfo.theta;
      if (useSpin) axisAngle(spin, spinInfo.axis, spinInfo.theta);

      var cubies = state.cubies;
      for (var ci = 0; ci < cubies.length; ci++) {
        var c = cubies[ci];
        modelOf(model, c);
        var m = model;
        if (useSpin) {
          var coord = c.pos[spinInfo.axis];
          var layers = spinInfo.layers;
          var hit = false;
          for (var k = 0; k < layers.length; k++) {
            if (layers[k] === coord) { hit = true; break; }
          }
          if (hit) {
            mul4(spun, spin, model);
            m = spun;
          }
        }
        gl.uniformMatrix4fv(uModel, false, m);
        bindMesh(body);
        gl.drawArrays(gl.TRIANGLES, 0, body.count);
        var sticker = stickers[homeKey(c.home)];
        bindMesh(sticker);
        gl.drawArrays(gl.TRIANGLES, 0, sticker.count);
      }
    }

    return { draw: draw, dispose: dispose };
  } catch (err) {
    dispose();
    throw err;
  }
}

/** 把向量按右手系绕坐标轴旋转，供测试对照整数矩阵 */
function spinVector(axis, theta, x, y, z) {
  var m = new Float32Array(16);
  axisAngle(m, axis, theta);
  return [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z
  ];
}

module.exports = {
  create: create,
  spinVector: spinVector,
  packModel: packModel,
  COLORS: COLORS
};
