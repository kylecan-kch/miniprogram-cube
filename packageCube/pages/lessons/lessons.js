var catalog = require('../../data/catalog.js');

Page({
  data: {
    missing: false,
    title: '',
    lessons: []
  },

  onLoad: function (query) {
    var trackId = query.track ? decodeURIComponent(query.track) : '';
    var track = catalog.getTrack(trackId);
    if (!track) {
      this.setData({ missing: true });
      return;
    }
    this.trackId = trackId;
    wx.setNavigationBarTitle({ title: track.title });
    this.setData({
      title: track.title,
      lessons: (track.lessons || []).map(function (lesson) {
        return {
          id: lesson.id,
          title: lesson.title,
          goal: lesson.goal || '',
          steps: (lesson.steps || []).length
        };
      })
    });
  },

  openLesson: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/packageCube/pages/lesson/lesson?track=' + encodeURIComponent(this.trackId) + '&id=' + encodeURIComponent(id)
    });
  },

  goHome: function () {
    wx.navigateBack({
      fail: function () {
        wx.redirectTo({ url: '/packageCube/pages/home/home' });
      }
    });
  }
});
