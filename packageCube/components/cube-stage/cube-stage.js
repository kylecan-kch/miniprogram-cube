var cube = require('../../core/cube.js');
var notation = require('../../core/notation.js');
var glcube = require('./glcube.js');

var QUARTER_MS = 280;
var HALF_MS = 420;

Component({
  properties: {
    algorithm: { type: String, value: '' },
    setup: { type: String, value: '' },
    resetKey: { type: Number, value: 0 }
  },

  data: {
    error: ''
  },

  lifetimes: {
    attached: function () {
      this._dead = false;
      this._yaw = 0.62;
      this._pitch = 0.42;
    },
    ready: function () {
      this._cursor = 0;
      this._moves = [];
      this._state = cube.createSolved();
      this._playing = false;
      this._anim = null;
      this._initGl(0);
    },
    // 页面 onUnload 会拆掉组件，走到这里。停掉帧循环和初始化重试，并删掉 GPU 资源。
    detached: function () {
      this._dead = true;
      this._anim = null;
      this._playing = false;
      if (this._initTimer) {
        clearTimeout(this._initTimer);
        this._initTimer = 0;
      }
      this._stopRaf();
      this._releaseGl();
    }
  },

  pageLifetimes: {
    show: function () {
      if (!this._dead && this._renderer) this._draw();
    }
  },

  observers: {
    'algorithm, setup, resetKey': function () {
      if (this._glReady) this._loadCase();
    }
  },

  methods: {
    _initGl: function (attempt) {
      var self = this;
      this.createSelectorQuery().select('#cube-gl').fields({ node: true, size: true }).exec(function (res) {
        if (self._dead) return;
        var info = res && res[0];
        if (!info || !info.node || !info.width || !info.height) {
          if (attempt < 12) {
            self._initTimer = setTimeout(function () {
              self._initTimer = 0;
              if (!self._dead) self._initGl(attempt + 1);
            }, 40);
          } else {
            self._fail('画布还没准备好');
          }
          return;
        }
        var canvas = info.node;
        var gl = canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: false
        });
        if (!gl) {
          self._fail('当前设备不支持 WebGL');
          return;
        }
        var dpr = 1;
        try {
          var win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          dpr = win.pixelRatio || 1;
        } catch (e) { dpr = 1; }
        if (dpr > 2) dpr = 2;
        if (dpr < 1) dpr = 1;
        canvas.width = Math.max(2, Math.round(info.width * dpr));
        canvas.height = Math.max(2, Math.round(info.height * dpr));
        try {
          self._renderer = glcube.create(gl);
        } catch (err) {
          self._fail(err && err.message ? err.message : 'WebGL 初始化失败');
          return;
        }
        self._canvas = canvas;
        self._viewW = canvas.width;
        self._viewH = canvas.height;
        self._glReady = true;
        self._loadCase();
      });
    },

    _releaseGl: function () {
      var renderer = this._renderer;
      this._renderer = null;
      this._glReady = false;
      this._canvas = null;
      if (renderer && renderer.dispose) {
        try { renderer.dispose(); } catch (e) {}
      }
    },

    _fail: function (msg) {
      if (this._dead) return;
      this._error = msg;
      this.setData({ error: msg });
      this._emit();
    },

    _loadCase: function () {
      if (this._dead) return;
      this._anim = null;
      this._playing = false;
      this._stopRaf();
      var alg = this.properties.algorithm || '';
      var setup = this.properties.setup || '';
      try {
        var moves = notation.parse(alg);
        var state = cube.createSolved();
        if (setup) cube.applyMoves(state, notation.parse(setup));
        else if (moves.length) cube.applyMoves(state, notation.invertMoves(moves));
        this._moves = moves;
        this._state = state;
        this._cursor = 0;
        this._error = '';
        if (this.data.error) this.setData({ error: '' });
      } catch (e) {
        this._moves = [];
        this._state = cube.createSolved();
        this._cursor = 0;
        this._error = e && e.message ? e.message : '公式无法解析';
        this.setData({ error: this._error });
      }
      this._emit();
      this._draw();
    },

    _emit: function () {
      if (this._dead) return;
      this.triggerEvent('status', {
        cursor: this._cursor || 0,
        total: this._moves ? this._moves.length : 0,
        playing: !!this._playing,
        busy: !!this._anim,
        solved: this._state ? cube.isSolved(this._state) : false,
        error: this._error || ''
      });
    },

    _requestFrame: function (fn) {
      var canvas = this._canvas;
      if (canvas && canvas.requestAnimationFrame) {
        this._rafNative = true;
        return canvas.requestAnimationFrame(fn);
      }
      this._rafNative = false;
      return setTimeout(fn, 16);
    },

    _stopRaf: function () {
      if (!this._rafId) return;
      if (this._rafNative && this._canvas && this._canvas.cancelAnimationFrame) {
        this._canvas.cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
      this._rafId = 0;
    },

    _draw: function () {
      if (this._dead || !this._renderer || !this._state) return;
      var spin = null;
      if (this._anim) {
        var p = (Date.now() - this._anim.t0) / this._anim.dur;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        var e = p * p * (3 - 2 * p);
        if (!this._spinView) this._spinView = { axis: 0, layers: null, theta: 0 };
        spin = this._spinView;
        spin.axis = this._anim.axis;
        spin.layers = this._anim.layers;
        spin.theta = this._anim.angle * e;
      }
      this._renderer.draw(this._state, this._yaw, this._pitch, spin, this._viewW, this._viewH);
    },

    _loop: function () {
      var self = this;
      if (this._rafId || !this._anim) return;
      var tick = function () {
        self._rafId = 0;
        if (self._dead) return;
        if (!self._anim) {
          self._draw();
          return;
        }
        self._draw();
        if (Date.now() - self._anim.t0 >= self._anim.dur) {
          var done = self._anim.done;
          self._anim = null;
          if (done && !self._dead) done();
          return;
        }
        self._rafId = self._requestFrame(tick);
      };
      this._rafId = this._requestFrame(tick);
    },

    _animate: function (move, dir, done) {
      var q = dir > 0 ? move.q : -move.q;
      var steps = cube.mod4(q);
      if (!steps) { done(); return; }
      var signed = steps === 3 ? -1 : steps;
      this._anim = {
        axis: move.axis,
        layers: move.layers,
        angle: signed * Math.PI / 2,
        t0: Date.now(),
        dur: Math.abs(signed) === 2 ? HALF_MS : QUARTER_MS,
        done: done
      };
      this._emit();
      this._loop();
    },

    _kick: function () {
      if (!this._playing || this._anim) return;
      if (!this._moves || this._cursor >= this._moves.length) {
        this._playing = false;
        this._emit();
        this._draw();
        return;
      }
      this._step(1);
    },

    _step: function (dir) {
      var self = this;
      if (this._anim || this._error) return;
      if (dir > 0) {
        if (this._cursor >= this._moves.length) {
          this._playing = false;
          this._emit();
          return;
        }
        var move = this._moves[this._cursor];
        this._animate(move, 1, function () {
          cube.applyMove(self._state, move);
          self._cursor++;
          self._draw();
          self._emit();
          if (self._playing) self._kick();
        });
      } else {
        if (this._cursor <= 0) {
          this._emit();
          return;
        }
        var prev = this._moves[this._cursor - 1];
        this._animate(prev, -1, function () {
          cube.applyMove(self._state, notation.invertMove(prev));
          self._cursor--;
          self._draw();
          self._emit();
        });
      }
    },

    toggle: function () {
      if (this._error || !this._moves || !this._moves.length) return;
      if (this._playing) {
        this._playing = false;
        this._emit();
        return;
      }
      if (this._cursor >= this._moves.length) this._loadCase();
      this._playing = true;
      this._emit();
      this._kick();
    },

    stepForward: function () {
      this._playing = false;
      this._step(1);
    },

    stepBack: function () {
      this._playing = false;
      this._step(-1);
    },

    reset: function () {
      this._loadCase();
    },

    _readTouch: function (touch, out) {
      var x = touch.clientX;
      var y = touch.clientY;
      if (x == null) x = touch.x;
      if (y == null) y = touch.y;
      out.x = x;
      out.y = y;
      return out;
    },

    onTouchStart: function (e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      if (!this._drag) this._drag = { x: 0, y: 0 };
      this._readTouch(t, this._drag);
    },

    onTouchMove: function (e) {
      var t = e.touches && e.touches[0];
      if (!t || !this._drag) return;
      if (!this._pt) this._pt = { x: 0, y: 0 };
      this._readTouch(t, this._pt);
      var dx = this._pt.x - this._drag.x;
      var dy = this._pt.y - this._drag.y;
      this._drag.x = this._pt.x;
      this._drag.y = this._pt.y;
      this._yaw -= dx * 0.012;
      this._pitch -= dy * 0.012;
      var turn = Math.PI * 2;
      if (this._yaw > turn || this._yaw < -turn) this._yaw = this._yaw % turn;
      if (this._pitch > 1.25) this._pitch = 1.25;
      if (this._pitch < -1.15) this._pitch = -1.15;
      this._draw();
    },

    onTouchEnd: function () {
      this._drag = null;
    }
  }
});
