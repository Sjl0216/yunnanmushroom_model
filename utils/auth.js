/**
 * 用户认证相关工具函数
 */

// 认证状态枚举
export const AUTH_STATES = {
  ONLINE_OK: 'ONLINE_OK',           // 在线且登录成功
  OFFLINE_CACHED: 'OFFLINE_CACHED', // 离线但有缓存
  OFFLINE_GUEST: 'OFFLINE_GUEST',   // 离线游客模式
  ONLINE_NEED_LOGIN: 'ONLINE_NEED_LOGIN' // 在线但登录失败
}

/**
 * 获取用户ID，如果无效则抛出错误
 * @returns {number} 用户ID
 * @throws {Error} 如果用户ID无效
 */
export function getUserIdOrThrow() {
  const raw = uni.getStorageSync('userId');
  const userId = Number(raw);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error(`userId 无效：${raw}`);
  }
  return userId;
}

/**
 * 获取用户ID，如果无效则返回默认值
 * @param {number} defaultValue 默认值
 * @returns {number} 用户ID或默认值
 */
export function getUserIdOrDefault(defaultValue = 1) {
  try {
    return getUserIdOrThrow();
  } catch (error) {
    console.warn('获取用户ID失败，使用默认值:', defaultValue);
    return defaultValue;
  }
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
export function isLoggedIn() {
  try {
    getUserIdOrThrow();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取当前认证状态
 * @returns {string} 认证状态
 */
export function getCurrentAuthState() {
  const app = getApp();
  return app?.globalData?.authState || AUTH_STATES.OFFLINE_GUEST;
}

/**
 * 检查是否处于离线模式
 * @returns {boolean} 是否离线
 */
export function isOfflineMode() {
  const state = getCurrentAuthState();
  return state === AUTH_STATES.OFFLINE_CACHED || state === AUTH_STATES.OFFLINE_GUEST;
}

/**
 * 检查是否可以使用云端功能
 * @returns {boolean} 是否可以使用云端功能
 */
export function canUseCloudFeatures() {
  const state = getCurrentAuthState();
  return state === AUTH_STATES.ONLINE_OK;
}
