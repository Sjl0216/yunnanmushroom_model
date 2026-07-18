// utils/network-detector.js
// 网络状态检测工具

/**
 * 检测当前网络是否在线
 * @returns {Promise<boolean>} 是否在线
 */
export function getNetworkOnline() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (r) => {
        const isOnline = r.networkType !== 'none';
        console.log('网络状态检测:', r.networkType, '在线:', isOnline);
        resolve(isOnline);
      },
      fail: () => {
        console.warn('网络状态检测失败，默认离线');
        resolve(false);
      }
    });
  });
}

/**
 * 获取详细的网络状态信息
 * @returns {Promise<Object>} 网络状态详情
 */
export function getNetworkDetail() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (r) => {
        resolve({
          networkType: r.networkType,
          isConnected: r.networkType !== 'none',
          timestamp: Date.now()
        });
      },
      fail: () => {
        resolve({
          networkType: 'unknown',
          isConnected: false,
          timestamp: Date.now()
        });
      }
    });
  });
}

/**
 * 等待网络连接恢复
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否连接成功
 */
export async function waitForNetwork(timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isOnline = await getNetworkOnline();
    if (isOnline) {
      return true;
    }
    // 等待1秒后重试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

/**
 * 网络状态监听器
 */
export class NetworkMonitor {
  constructor() {
    this.callbacks = [];
    this.currentStatus = null;
  }
  
  /**
   * 添加网络状态变化回调
   * @param {Function} callback - 回调函数
   */
  onNetworkChange(callback) {
    this.callbacks.push(callback);
  }
  
  /**
   * 开始监听网络变化
   */
  startMonitoring() {
    wx.onNetworkStatusChange((res) => {
      const newStatus = {
        isConnected: res.isConnected,
        networkType: res.networkType,
        timestamp: Date.now()
      };
      
      console.log('网络状态变更:', newStatus);
      
      // 通知所有回调
      this.callbacks.forEach(cb => {
        try {
          cb(newStatus, this.currentStatus);
        } catch (e) {
          console.error('网络状态回调执行错误:', e);
        }
      });
      
      this.currentStatus = newStatus;
    });
  }
  
  /**
   * 停止监听
   */
  stopMonitoring() {
    wx.offNetworkStatusChange();
    this.callbacks = [];
  }
}