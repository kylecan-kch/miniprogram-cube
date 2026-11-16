var catalog = require('../../data/catalog.js');

Page({
  data: {
    tracks: [],
    last: null
  },

  onShow: function () {
    var tracks = catalog.getTracks().map(function (t) {
      return {
        id: t.id,
        title: t.title,
        count: (t.lessons || []).length
      };
    });
    var last = catalog.readLast();
    if (last && !catalog.getLesson(last.track, last.id)) last = null;
    this.setData({ tracks: tracks, last: last });
  },

  openTrack: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/packageCube/pages/lessons/lessons?track=' + encodeURIComponent(id) });
  },

  resume: function () {
    var last = this.data.last;
    if (!last) return;
    wx.navigateTo({
      url: '/packageCube/pages/lesson/lesson?track=' + encodeURIComponent(last.track) + '&id=' + encodeURIComponent(last.id)
    });
  },

  openNotation: function () {
    wx.navigateTo({ url: '/packageCube/pages/notation/notation' });
  },

  onShareAppMessage: function () {
    return { title: '魔方教学：层先法与 CFOP', path: '/packageCube/pages/home/home' };
  }
});
