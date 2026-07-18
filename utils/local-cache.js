/**
 * 本地识别记录缓存管理
 */

const CACHE_KEY_PREFIX = 'mushroom_records_';
const UNSYNCED_KEY_PREFIX = 'pending_queue_';

/**
 * 获取用户的所有本地缓存记录
 */
export const getLocalCache = (userId) => {
  const key = `${CACHE_KEY_PREFIX}${userId}`;
  return uni.getStorageSync(key) || [];
};

/**
 * 获取未同步的本地记录
 */
export const getUnsyncedRecords = (userId) => {
  const key = `${UNSYNCED_KEY_PREFIX}${userId}`;
  return uni.getStorageSync(key) || [];
};

/**
 * 将本地记录标记为已同步
 */
export const markAsSynced = (userId, localId) => {
  const key = `${UNSYNCED_KEY_PREFIX}${userId}`;
  let list = uni.getStorageSync(key) || [];
  list = list.filter(item => item.localId !== localId);
  uni.setStorageSync(key, list);
};

/**
 * 合并云端记录和本地未同步记录
 */
export const mergeRecords = (cloudRecords, localUnsynced) => {
  // 这里可以根据业务逻辑进行合并，通常本地未同步的排在最前面
  if (!localUnsynced || localUnsynced.length === 0) return cloudRecords;
  
  // 排除重复（如果 localId 已经在云端存在）
  const cloudIds = new Set(cloudRecords.map(r => r.id || r.recordId));
  const filteredLocal = localUnsynced.filter(l => !cloudIds.has(l.recordId));
  
  return [...filteredLocal, ...cloudRecords];
};

/**
 * 清理已同步的老旧记录
 */
export const cleanSyncedRecords = (userId, beforeTimestamp) => {
  const key = `${CACHE_KEY_PREFIX}${userId}`;
  let list = uni.getStorageSync(key) || [];
  list = list.filter(item => item.createTime > beforeTimestamp);
  uni.setStorageSync(key, list);
};

export default {
  getLocalCache,
  getUnsyncedRecords,
  markAsSynced,
  mergeRecords,
  cleanSyncedRecords
};
