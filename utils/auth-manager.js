// utils/auth-manager.js
// 认证状态管理核心

import { AUTH_STATES } from './auth-states.js';

// 存储键名定义
const K_TOKEN = 'AUTH_TOKEN';
const K_USER = 'AUTH_USER';
const K_LAST = 'AUTH_LAST_LOGIN_AT';
const K_OFF = 'AUTH_OFFLINE_ENABLED';

// 离线会话有效期：30天
const OFFLINE_TTL_MS = 30 * 24 * 3600 * 1000;

/**
 * 获取缓存的用户信息
 * @returns {Object|null} 用户信息对象或null
 */
export function getCachedUser() {
  try {
    const userData = uni.getStorageSync(K_USER);
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    console.error('getCachedUser error:', e);
    return null;
  }
}

/**
 * 检查离线会话是否有效
 * @returns {boolean} 是否有效
 */
export function isOfflineSessionValid() {
  try {
    const enabled = uni.getStorageSync(K_OFF) === true;
    const lastLogin = uni.getStorageSync(K_LAST);
    
    if (!enabled || !lastLogin) {
      return false;
    }
    
    const timeDiff = Date.now() - parseInt(lastLogin);
    return timeDiff < OFFLINE_TTL_MS;
  } catch (e) {
    console.error('isOfflineSessionValid error:', e);
    return false;
  }
}

/**
 * 保存登录会话
 * @param {Object} sessionData - 会话数据
 * @param {string} sessionData.token - 认证令牌
 * @param {Object} sessionData.user - 用户信息
 */
export function saveLoginSession({ token, user }) {
  try {
    if (token) {
      uni.setStorageSync(K_TOKEN, token);
    }
    
    // 存储用户信息为字符串（避免序列化问题）
    uni.setStorageSync(K_USER, JSON.stringify(user));
    uni.setStorageSync(K_LAST, Date.now().toString());
    uni.setStorageSync(K_OFF, true); // 激活离线会话
    
    console.log('登录会话保存成功:', { 
      hasToken: !!token, 
      userId: user?.userId,
      nickname: user?.nickname 
    });
  } catch (e) {
    console.error('saveLoginSession error:', e);
  }
}

/**
 * 清除所有认证会话数据
 */
export function clearSession() {
  try {
    uni.removeStorageSync(K_TOKEN);
    uni.removeStorageSync(K_USER);
    uni.removeStorageSync(K_LAST);
    uni.removeStorageSync(K_OFF);
    console.log('认证会话已清除');
  } catch (e) {
    console.error('clearSession error:', e);
  }
}

/**
 * 获取认证令牌
 * @returns {string} 令牌字符串
 */
export function getToken() {
  try {
    return uni.getStorageSync(K_TOKEN) || '';
  } catch (e) {
    console.error('getToken error:', e);
    return '';
  }
}

/**
 * 获取认证状态
 * @param {boolean} online - 当前网络状态
 * @returns {Object} 状态对象 {state, user, isValid}
 */
export function getAuthState(online) {
  const user = getCachedUser();
  const offlineValid = isOfflineSessionValid();
  
  // 离线状态判断
  if (!online) {
    if (user && offlineValid) {
      return {
        state: AUTH_STATES.OFFLINE_CACHED,
        user: user,
        isValid: true,
        desc: '离线可用模式'
      };
    }
    return {
      state: AUTH_STATES.OFFLINE_GUEST,
      user: null,
      isValid: true, // 访客模式也算有效
      desc: '离线访客模式'
    };
  }
  
  // 在线状态判断
  if (user) {
    // TODO: 这里可以添加token有效性检查逻辑
    return {
      state: AUTH_STATES.ONLINE_AUTHED,
      user: user,
      isValid: true,
      desc: '在线已登录'
    };
  }
  
  return {
    state: AUTH_STATES.NEED_ONLINE_LOGIN,
    user: null,
    isValid: false,
    desc: '需要在线登录'
  };
}

/**
 * 检查是否需要强制重新登录
 * @returns {boolean} 是否需要重新登录
 */
export function needForceRelogin() {
  const user = getCachedUser();
  if (!user) return true;
  
  // 检查离线会话是否过期
  if (!isOfflineSessionValid()) {
    return true;
  }
  
  // TODO: 可以添加更多检查逻辑，如token过期等
  return false;
}