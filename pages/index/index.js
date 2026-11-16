Page({
  data: {
    failed: false
  },

  onLoad: function () {
    this.go();
  },

  go: function () {
    var self = this;
    wx.redirectTo({
      url: '/packageCube/pages/home/home',
      fail: function () { self.setData({ failed: true }); }
    });
  }
});
