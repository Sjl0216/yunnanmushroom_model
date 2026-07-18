// utils/bootstrap-auth.js
// 统一启动认证流程

import { getNetworkOnline } from './network-detector.js';
import { getAuthState, AUTH_STATES } from './auth-manager.js';
import { AUTH_STATE_DESC } from './auth-states.js';

/**
 * 启动认证流程（核心入口）
 * @param {Object} options - 选项
 * @param {boolean} options.forceLogin - 是否强制重新登录
 * @param {boolean} options.silent - 是否静默模式（不显示提示）
 * @returns {Promise<Object>} 认证结果
 */
export async function bootstrapAuth({ forceLogin = false, silent = false } = {}) {
  try {
    // 1. 检测网络状态
    const online = await getNetworkOnline();
    console.log('启动认证流程 - 网络状态:', online ? '在线' : '离线');
    
    // 2. 获取认证状态
    const authState = getAuthState(online);
    console.log('认证状态:', authState.desc, '状态码:', authState.state);
    
    // 3. 强制登录检查
    if (forceLogin && online) {
      console.log('强制重新登录模式');
      return {
        mode: AUTH_STATES.NEED_ONLINE_LOGIN,
        user: null,
        online: true,
        desc: AUTH_STATE_DESC[AUTH_STATES.NEED_ONLINE_LOGIN]
      };
    }
    
    // 4. 根据不同状态返回相应结果
    switch (authState.state) {
      case AUTH_STATES.ONLINE_AUTHED:
        if (!silent) {
          console.log('✅ 在线已登录，正常使用');
        }
        return {
          mode: AUTH_STATES.ONLINE_AUTHED,
          user: authState.user,
          online: true,
          desc: authState.desc
        };
        
      case AUTH_STATES.OFFLINE_CACHED:
        if (!silent) {
          console.log('📱 离线模式 - 使用缓存身份');
          uni.showToast({ 
            title: '离线模式 - 可正常使用本地功能', 
            icon: 'none',
            duration: 2000
          });
        }
        return {
          mode: AUTH_STATES.OFFLINE_CACHED,
          user: authState.user,
          online: false,
          desc: authState.desc
        };
        
      case AUTH_STATES.OFFLINE_GUEST:
        if (!silent) {
          console.log('👤 离线访客模式 - 功能受限');
          uni.showToast({ 
            title: '离线访客模式 - 部分功能受限', 
            icon: 'none',
            duration: 2000
          });
        }
        return {
          mode: AUTH_STATES.OFFLINE_GUEST,
          user: null,
          online: false,
          desc: authState.desc
        };
        
      case AUTH_STATES.NEED_ONLINE_LOGIN:
        if (!silent) {
          console.log('⚠️ 需要在线登录');
        }
        return {
          mode: AUTH_STATES.NEED_ONLINE_LOGIN,
          user: null,
          online: true,
          desc: authState.desc
        };
        
      default:
        console.warn('未知认证状态:', authState.state);
        return {
          mode: AUTH_STATES.NEED_ONLINE_LOGIN,
          user: null,
          online: online,
          desc: '未知状态'
        };
    }
    
  } catch (error) {
    console.error('启动认证流程失败:', error);
    // 发生错误时，默认返回需要登录状态
    return {
      mode: AUTH_STATES.NEED_ONLINE_LOGIN,
      user: null,
      online: false,
      desc: '认证流程异常',
      error: error.message
    };
  }
}

/**
 * 快速检查是否可以免登录进入
 * @returns {Promise<boolean>} 是否可以直接进入
 */
export async function canEnterWithoutLogin() {
  const result = await bootstrapAuth({ silent: true });
  return result.mode !== AUTH_STATES.NEED_ONLINE_LOGIN;
}

/**
 * 获取用户友好的状态描述
 * @param {string} mode - 认证模式
 * @returns {string} 描述文本
 */
export function getFriendlyStatusDesc(mode) {
  const descMap = {
    [AUTH_STATES.ONLINE_AUTHED]: '在线已登录',
    [AUTH_STATES.OFFLINE_CACHED]: '离线可用模式',
    [AUTH_STATES.OFFLINE_GUEST]: '离线访客模式',
    [AUTH_STATES.NEED_ONLINE_LOGIN]: '需要登录',
    [AUTH_STATES.ONLINE_EXPIRED]: '登录已过期'
  };
  
  return descMap[mode] || '未知状态';
}

/**
 * 认证状态钩子 - 用于页面生命周期
 */
export class AuthHook {
  constructor() {
    this.currentPage = null;
  }
  
  /**
   * 页面显示时的认证检查
   * @param {Object} pageInstance - 页面实例
   * @param {Function} onAuthSuccess - 认证成功回调
   * @param {Function} onNeedLogin - 需要登录回调
   */
  async onPageShow(pageInstance, { onAuthSuccess, onNeedLogin }) {
    this.currentPage = pageInstance;
    
    const authResult = await bootstrapAuth();
    
    // 更新页面数据
    if (pageInstance.$data) {
      pageInstance.authMode = authResult.mode;
      pageInstance.currentUser = authResult.user;
      pageInstance.isOnline = authResult.online;
    }
    
    // 根据结果执行相应逻辑
    if (authResult.mode === AUTH_STATES.NEED_ONLINE_LOGIN) {
      if (onNeedLogin) {
        onNeedLogin(authResult);
      } else {
        // 默认跳转到登录页
        uni.reLaunch({ url: '/pages/login/login' });
      }
    } else {
      if (onAuthSuccess) {
        onAuthSuccess(authResult);
      }
    }
    
    return authResult;
  }
  
  /**
   * 检查特定功能的可用性
   * @param {string} feature - 功能名称
   * @returns {Object} 可用性检查结果
   */
  checkFeatureAvailability(feature) {
    const mode = this.currentPage?.authMode;
    
    const featureRules = {
      'local_recognition': [AUTH_STATES.ONLINE_AUTHED, AUTH_STATES.OFFLINE_CACHED, AUTH_STATES.OFFLINE_GUEST],
      'cloud_sync': [AUTH_STATES.ONLINE_AUTHED],
      'user_profile': [AUTH_STATES.ONLINE_AUTHED, AUTH_STATES.OFFLINE_CACHED],
      'record_upload': [AUTH_STATES.ONLINE_AUTHED],
      'offline_browse': [AUTH_STATES.ONLINE_AUTHED, AUTH_STATES.OFFLINE_CACHED, AUTH_STATES.OFFLINE_GUEST]
    };
    
    const allowedModes = featureRules[feature] || [];
    const isAvailable = allowedModes.includes(mode);
    
    return {
      feature,
      isAvailable,
      currentMode: mode,
      allowedModes
    };
  }
}