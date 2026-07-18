// utils/package-loader.js
export function loadPkg(name) {
  return new Promise((resolve, reject) => {
    wx.loadSubPackage({
      name,
      success: resolve,
      fail: reject
    });
  });
}

// 检查网络状态
export function checkNetworkStatus() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: r => resolve(r.networkType !== 'none'),
      fail: () => resolve(false)
    });
  });
}