App({
  onLaunch: function () {
    // 课程进度存在分包自己的本地存储里，不挂到 App 上
    if (wx.canIUse && wx.canIUse('getUpdateManager')) {
      var um = wx.getUpdateManager();
      um.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: function (res) { if (res.confirm) um.applyUpdate(); }
        });
      });
    }
  }
});
