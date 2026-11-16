/**
 * 课程目录。源数据是 lessons.json，页面不要硬编码课程内容。
 * 小程序和 Node 测试都用 require 读取 JSON。
 */

var data = require('./lessons.json');

/** 本地存储键，合并进其他小程序时避免和主包冲突 */
var LAST_KEY = 'cube_last_lesson';

function getTracks() {
  return (data && data.tracks) || [];
}

function getTrack(id) {
  var tracks = getTracks();
  for (var i = 0; i < tracks.length; i++) {
    if (tracks[i].id === id) return tracks[i];
  }
  return null;
}

function getLesson(trackId, lessonId) {
  var track = getTrack(trackId);
  if (!track || !track.lessons) return null;
  for (var i = 0; i < track.lessons.length; i++) {
    if (track.lessons[i].id === lessonId) return track.lessons[i];
  }
  return null;
}

/** tips 在数据里是字符串数组；单个字符串也照列表显示 */
function tipList(tips) {
  if (!tips) return [];
  if (typeof tips === 'string') return tips ? [tips] : [];
  if (!Array.isArray(tips)) return [];
  var out = [];
  for (var i = 0; i < tips.length; i++) {
    if (tips[i]) out.push(String(tips[i]));
  }
  return out;
}

function readLast() {
  try {
    if (typeof wx === 'undefined' || !wx.getStorageSync) return null;
    var v = wx.getStorageSync(LAST_KEY);
    if (!v || typeof v !== 'object' || !v.track || !v.id) return null;
    return v;
  } catch (e) {
    return null;
  }
}

function writeLast(trackId, lesson) {
  try {
    if (typeof wx === 'undefined' || !wx.setStorageSync || !lesson) return;
    wx.setStorageSync(LAST_KEY, {
      track: trackId,
      id: lesson.id,
      title: lesson.title || ''
    });
  } catch (e) { /* 存储满了也不影响看课 */ }
}

module.exports = {
  LAST_KEY: LAST_KEY,
  getTracks: getTracks,
  getTrack: getTrack,
  getLesson: getLesson,
  tipList: tipList,
  readLast: readLast,
  writeLast: writeLast
};
