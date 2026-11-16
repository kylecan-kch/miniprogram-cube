Page({
  data: {
    failed: false,
    retrying: false
  },

  onLoad: function () {
    this.go();
  },

  retry: function () {
    this.go();
  },

  go: function () {
    if (this._opening) return;
    this._opening = true;
    var self = this;
    this.setData({ retrying: true });
    wx.redirectTo({
      url: '/packageCube/pages/home/home',
      success: function () {
        self._opening = false;
      },
      fail: function () {
        self._opening = false;
        self.setData({ failed: true, retrying: false });
      }
    });
  }
});
