/**
 * 离线认证核心工具
 * 实现离线放行 + 本地登录态缓存 + 联网自动补登 + 待同步队列
 */

import { request } from './request.js'
import { AUTH_STATES } from './auth.js'

// 当前时间戳（秒）
function nowSec() {
  return Math.floor(Date.now() / 1000)
}

// 检查网络状态
async function isOnline() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        resolve(res.networkType !== 'none')
      },
      fail: () => resolve(false)
    })
  })
}

/**
 * 在线登录（调用后端接口）
 * @returns {Promise<Object>} 认证信息
 */
export async function loginOnline() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: async (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('获取微信 code 失败'))
          return
        }

        try {
          // 调用后端登录接口
          const result = await request('/api/user/login', 'POST', { code: loginRes.code })
          
          // 构造认证缓存对象
          const authCache = {
            userId: result.userId,
            token: result.token,
            openid: result.openid,
            nickname: result.nickname,
            avatarUrl: result.avatarUrl,
            gender: result.gender,
            lastOnlineAt: nowSec(),
            offlinePermitUntil: nowSec() + 7 * 24 * 3600 // 7天有效期
          }
          
          // 保存到本地存储
          uni.setStorageSync('authCache', authCache)
          resolve(authCache)
        } catch (error) {
          reject(error)
        }
      },
      fail: (error) => {
        reject(new Error('微信登录失败: ' + error.errMsg))
      }
    })
  })
}

/**
 * 启动认证引导器
 * @param {Object} app - 全局 app 对象
 */
export async function bootstrapAuth(app) {
  console.log('启动认证引导器...')
  
  const online = await isOnline()
  app.globalData.networkOnline = online
  
  const cache = uni.getStorageSync('authCache')
  const currentTime = nowSec()
  
  if (online) {
    try {
      console.log('在线模式：尝试登录...')
      const auth = await loginOnline()
      app.globalData.authState = AUTH_STATES.ONLINE_OK
      app.globalData.userId = auth.userId
      app.globalData.token = auth.token
      app.globalData.userProfile = auth
      
      console.log('在线登录成功:', {
        userId: auth.userId,
        nickname: auth.nickname
      })
      
      // 登录成功后尝试刷新待同步队列
      await flushPendingQueue(app)
      return
    } catch (error) {
      console.warn('在线登录失败:', error.message)
      // 在线但登录失败：不阻塞进入
      app.globalData.authState = AUTH_STATES.ONLINE_NEED_LOGIN
      app.globalData.userId = cache?.userId || null
      app.globalData.token = cache?.token || null
      app.globalData.userProfile = cache || null
      return
    }
  }
  
  // 离线模式处理
  if (cache?.offlinePermitUntil && cache.offlinePermitUntil > currentTime) {
    console.log('离线模式：使用缓存认证')
    app.globalData.authState = AUTH_STATES.OFFLINE_CACHED
    app.globalData.userId = cache.userId
    app.globalData.token = cache.token
    app.globalData.userProfile = cache
  } else {
    console.log('离线模式：游客模式')
    app.globalData.authState = AUTH_STATES.OFFLINE_GUEST
    app.globalData.userId = null
    app.globalData.token = null
    app.globalData.userProfile = null
  }
}

/**
 * 网络恢复回调
 * @param {Object} app - 全局 app 对象
 */
export async function onNetworkBack(app) {
  console.log('网络恢复，尝试自动补登...')
  
  try {
    const auth = await loginOnline()
    app.globalData.authState = AUTH_STATES.ONLINE_OK
    app.globalData.userId = auth.userId
    app.globalData.token = auth.token
    app.globalData.userProfile = auth
    
    console.log('网络恢复后登录成功')
    
    // 补传待同步队列
    await flushPendingQueue(app)
  } catch (error) {
    console.warn('网络恢复后登录失败:', error.message)
    app.globalData.authState = AUTH_STATES.ONLINE_NEED_LOGIN
  }
}

/**
 * 添加待同步项到队列
 * @param {string} type - 类型 ('RECORD' | 'FEEDBACK')
 * @param {Object} payload - 数据负载
 */
export function pushPending(type, payload) {
  const queue = uni.getStorageSync('pendingQueue') || []
  const item = {
    type,
    payload,
    createdAt: Date.now()
  }
  queue.push(item)
  uni.setStorageSync('pendingQueue', queue)
  console.log('添加待同步项:', type, payload.id)
}

/**
 * 刷新待同步队列
 * @param {Object} app - 全局 app 对象
 */
export async function flushPendingQueue(app) {
  if (!app.globalData.networkOnline) {
    console.log('网络离线，暂不处理待同步队列')
    return
  }
  
  if (app.globalData.authState !== AUTH_STATES.ONLINE_OK) {
    console.log('未登录成功，暂不处理待同步队列')
    return
  }
  
  const queue = uni.getStorageSync('pendingQueue') || []
  if (queue.length === 0) {
    return
  }
  
  console.log('开始刷新待同步队列，数量:', queue.length)
  
  const remaining = []
  
  for (const item of queue) {
    try {
      if (item.type === 'RECORD') {
        // 同步识别记录
        await request('/api/record/add', 'POST', item.payload)
        console.log('同步识别记录成功:', item.payload.id)
      } else if (item.type === 'FEEDBACK') {
        // 同步反馈记录
        await request('/api/feedback/add', 'POST', item.payload)
        console.log('同步反馈记录成功:', item.payload.id)
      } else {
        console.warn('未知的同步类型:', item.type)
        remaining.push(item)
      }
    } catch (error) {
      console.warn('同步失败，保留在队列中:', item.type, error.message)
      remaining.push(item)
    }
  }
  
  // 保存剩余未同步的项
  uni.setStorageSync('pendingQueue', remaining)
  console.log('待同步队列刷新完成，剩余:', remaining.length)
}

/**
 * 获取待同步队列状态
 * @returns {Object} 队列状态信息
 */
export function getPendingQueueStatus() {
  const queue = uni.getStorageSync('pendingQueue') || []
  const recordCount = queue.filter(item => item.type === 'RECORD').length
  const feedbackCount = queue.filter(item => item.type === 'FEEDBACK').length
  
  return {
    total: queue.length,
    records: recordCount,
    feedbacks: feedbackCount
  }
}

/**
 * 清空待同步队列
 */
export function clearPendingQueue() {
  uni.setStorageSync('pendingQueue', [])
  console.log('待同步队列已清空')
}