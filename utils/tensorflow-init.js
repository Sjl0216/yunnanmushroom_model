// utils/tensorflow-init.js
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';

let tfInitialized = false;

export async function initTensorFlow() {
  if (tfInitialized) return true;
  try {
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('TFJS 2.8.6 初始化成功 后端:', tf.getBackend());
    tfInitialized = true;
    return true;
  } catch (error) {
    console.error('TFJS 初始化失败:', error);
    throw error;
  }
}