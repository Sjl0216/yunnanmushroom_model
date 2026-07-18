// utils/auth-states.js
// 认证状态枚举定义

export const AUTH_STATES = {
  // 在线已登录（后端已校验）
  ONLINE_AUTHED: 'ONLINE_AUTHED',
  
  // 离线访客（从未在线登录过）
  OFFLINE_GUEST: 'OFFLINE_GUEST',
  
  // 离线可用（曾在线登录过，缓存过用户身份）
  OFFLINE_CACHED: 'OFFLINE_CACHED',
  
  // 在线但 token 过期/被踢，需要重新登录
  ONLINE_EXPIRED: 'ONLINE_EXPIRED',
  
  // 需要在线登录
  NEED_ONLINE_LOGIN: 'NEED_ONLINE_LOGIN'
};

// 状态描述映射
export const AUTH_STATE_DESC = {
  [AUTH_STATES.ONLINE_AUTHED]: '在线已登录',
  [AUTH_STATES.OFFLINE_GUEST]: '离线访客模式',
  [AUTH_STATES.OFFLINE_CACHED]: '离线可用模式',
  [AUTH_STATES.ONLINE_EXPIRED]: '在线但需重新登录',
  [AUTH_STATES.NEED_ONLINE_LOGIN]: '需要在线登录'
};