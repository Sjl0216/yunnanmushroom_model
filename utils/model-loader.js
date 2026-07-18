// utils/model-loader.js
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfc from '@tensorflow/tfjs-converter';
import { makeUsrFetch } from './makeLocalFetch';

export async function loadLocalTfjsModel(modelKey) {
  const ready = wx.getStorageSync(`localModelReady:${modelKey}`);
  const baseDir = wx.getStorageSync(`localModelDir:${modelKey}`);
  if (!ready || !baseDir) throw new Error('LOCAL_MODEL_NOT_READY');

  // 校验文件是否存在（避免"标记有但文件被系统清理"）
  const fs = wx.getFileSystemManager();
  fs.accessSync(`${baseDir}/model.json`);
  
  console.log('准备加载模型，目录:', baseDir);
  
  // 预加载验证：检查 model.json 内容
  try {
    const modelJsonPath = `${baseDir}/model.json`;
    const jsonContent = fs.readFileSync(modelJsonPath, 'utf8');
    console.log('预加载验证 - model.json 前100字符:', jsonContent.slice(0, 100));
    JSON.parse(jsonContent);
    console.log('预加载验证 - model.json 格式正确');
  } catch (validateError) {
    console.error('预加载验证失败:', validateError);
    throw new Error('模型文件损坏或格式错误');
  }
  
  try {
    // 确保 backend 已就绪
    await tf.ready();
    await tf.setBackend('cpu');
    
    const fetchFunc = makeUsrFetch(baseDir);
    
    // 这里 url 随便写一个"看起来像 model.json 的地址"
    // 真正读取由 fetchFunc 决定
    const model = await tfc.loadGraphModel(`${baseDir}/model.json`, { fetchFunc });
    
    console.log('模型加载成功');
    return model;
  } catch (error) {
    console.error('模型加载具体错误:', error);
    console.error('错误类型:', typeof error);
    console.error('错误消息:', error.message);
    throw error;
  }
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