var catalog = require('../../data/catalog.js');
var notation = require('../../core/notation.js');

function markTokens(tokens, cursor, total) {
  var out = [];
  for (var i = 0; i < tokens.length; i++) {
    var cls = 'cube-tok';
    if (cursor === tokens[i].i && cursor < total) cls += ' cube-tok-on';
    else if (cursor > tokens[i].i) cls += ' cube-tok-done';
    out.push({ text: tokens[i].text, i: tokens[i].i, cls: cls });
  }
  return out;
}

Page({
  data: {
    missing: false,
    title: '',
    goal: '',
    stepIndex: 0,
    stepCount: 0,
    text: '',
    caseName: '',
    tips: [],
    algorithm: '',
    setup: '',
    rawAlg: '',
    rawShown: false,
    tokens: [],
    cursor: 0,
    moveCount: 0,
    playing: false,
    busy: false,
    solved: false,
    hasAlg: false,
    playError: ''
  },

  onLoad: function (query) {
    var trackId = query.track ? decodeURIComponent(query.track) : '';
    var lessonId = query.id ? decodeURIComponent(query.id) : '';
    var lesson = catalog.getLesson(trackId, lessonId);
    if (!lesson) {
      this.setData({ missing: true });
      return;
    }
    this.trackId = trackId;
    this.lesson = lesson;
    catalog.writeLast(trackId, lesson);
    wx.setNavigationBarTitle({ title: lesson.title });
    this.showStep(0);
  },

  showStep: function (index) {
    var steps = this.lesson.steps || [];
    if (index < 0) index = 0;
    if (index > steps.length - 1) index = steps.length - 1;
    var step = steps[index] || {};
    var alg = step.algorithm || '';
    var tokens = [];
    var playError = '';
    try {
      if (alg) {
        var parsed = notation.parse(alg).map(function (m, i) {
          return { text: m.text, i: i };
        });
        tokens = markTokens(parsed, 0, parsed.length);
      }
    } catch (e) {
      playError = e && e.message ? e.message : '公式无法解析';
      tokens = [];
    }
    var joined = tokens.map(function (t) { return t.text; }).join(' ');
    var compact = String(alg).replace(/\s+/g, ' ').trim();
    this.setData({
      title: this.lesson.title,
      goal: this.lesson.goal || '',
      stepIndex: index,
      stepCount: steps.length,
      text: step.text || '',
      caseName: step.caseName || '',
      tips: catalog.tipList(step.tips),
      algorithm: alg,
      setup: step.setup || '',
      rawAlg: alg,
      rawShown: !!(alg && compact !== joined),
      tokens: tokens,
      cursor: 0,
      moveCount: tokens.length,
      playing: false,
      busy: false,
      solved: false,
      hasAlg: tokens.length > 0,
      playError: playError
    });
  },

  onStatus: function (e) {
    var s = e.detail || {};
    var cursor = s.cursor || 0;
    var total = s.total || 0;
    this.setData({
      cursor: cursor,
      moveCount: total,
      playing: !!s.playing,
      busy: !!s.busy,
      solved: !!s.solved,
      playError: s.error || '',
      tokens: markTokens(this.data.tokens || [], cursor, total)
    });
  },

  stage: function () {
    return this.selectComponent('#stage');
  },

  onToggle: function () {
    var stage = this.stage();
    if (stage) stage.toggle();
  },

  onForward: function () {
    var stage = this.stage();
    if (stage) stage.stepForward();
  },

  onBack: function () {
    var stage = this.stage();
    if (stage) stage.stepBack();
  },

  onReset: function () {
    var stage = this.stage();
    if (stage) stage.reset();
  },

  prevStep: function () {
    if (this.data.stepIndex <= 0) return;
    this.showStep(this.data.stepIndex - 1);
  },

  nextStep: function () {
    if (this.data.stepIndex >= this.data.stepCount - 1) return;
    this.showStep(this.data.stepIndex + 1);
  },

  openNotation: function () {
    wx.navigateTo({ url: '/packageCube/pages/notation/notation' });
  },

  goHome: function () {
    wx.reLaunch({ url: '/packageCube/pages/home/home' });
  },

  onShareAppMessage: function () {
    var title = this.lesson ? this.lesson.title : '魔方教学';
    return {
      title: title,
      path: '/packageCube/pages/lesson/lesson?track=' + encodeURIComponent(this.trackId || '') + '&id=' + encodeURIComponent(this.lesson ? this.lesson.id : '')
    };
  }
});
