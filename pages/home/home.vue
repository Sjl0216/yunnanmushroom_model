<template>
  <view class="container">
    <view class="header-area">
      <view class="title">野生菌智慧识别系统</view>
    </view>
    
    <!-- 状态横幅 -->
    <view class="status-banner" v-if="authBanner" :class="bannerType">
      <text class="banner-text">{{ authBanner }}</text>
    </view>
    
    <view class="content-area">
      <!-- 图片预览区域 -->
      <view class="image-preview-section" v-if="imgUrl">
        <view class="preview-header">
          <text class="section-title">检测图片</text>
        </view>
        <view class="image-wrapper">
          <image 
            :src="imgUrl" 
            mode="aspectFit" 
            class="preview-image"
            :style="{ width: imgWidth + 'px', height: imgHeight + 'px' }"
            @error="onImageError"
            @load="onImageLoad"
          ></image>
          
          <canvas canvas-id="detectCanvas" 
                  class="overlay-canvas"
                  :style="{width: imgWidth + 'px', height: imgHeight + 'px'}">
          </canvas>
        </view>
      </view>
      
      <!-- 无图片时的提示 -->
      <view class="no-image-placeholder" v-else>
        <view class="placeholder-content">
          <text class="placeholder-text">请上传图片进行识别</text>
        </view>
      </view>
      

      <view class="result-list" v-if="results.length > 0">
        <view class="result-header">
          <text class="result-title">检测结果：</text>
          <text class="result-count">共 {{results.length}} 个目标</text>
        </view>
        
        <view class="result-item" v-for="(item, index) in results" :key="index" @click="goToDetail(item)">
          <view class="item-left">
            <text class="name">{{item.className}}</text>
            <text :class="['tag', item.isPoisonous === 1 ? 'tag-danger' : (item.isPoisonous === 2 ? 'tag-warning' : 'tag-safe')]">
              {{ item.isPoisonous === 1 ? '有毒' : (item.isPoisonous === 2 ? '需谨慎' : '可食用') }}
            </text>
          </view>
          <view class="item-right">
            <text class="score">{{item.score}}</text>
          </view>
        </view>
        
        <view class="safe-tip">识别结果仅供参考，严禁采食未知野生菌！</view>
      </view>
    </view>
    
    <view class="button-area">
      <button class="identify-btn" @click="chooseImage" v-if="isModelLoaded">
        选择图片 / 拍照识别
      </button>
      
      <button class="download-btn" @click="downloadModel" v-else>
        下载AI模型（首次使用）
      </button>
      
      <view class="model-status" v-if="!isModelLoaded">
        <text class="status-text">当前为离线模式，仅支持图片显示</text>
        <text class="status-text">请联网后点击上方按钮下载AI模型</text>
      </view>
    </view>
  </view>
</template>

<script>
// 引入元数据用于毒性判断和详情页跳转
import { MUSHROOM_META } from '@/utils/mushroom-meta.js';
import { getUserIdOrDefault } from '@/utils/auth.js';
import { checkNetwork, BASE_URL } from '@/utils/request.js';

(function() {
  const keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  wx.atob = global.atob = function(input) {
    let output = "";
    let chr1, chr2, chr3;
    let enc1, enc2, enc3, enc4;
    let i = 0;
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    while (i < input.length) {
      enc1 = keyStr.indexOf(input.charAt(i++));
      enc2 = keyStr.indexOf(input.charAt(i++));
      enc3 = keyStr.indexOf(input.charAt(i++));
      enc4 = keyStr.indexOf(input.charAt(i++));
      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;
      output = output + String.fromCharCode(chr1);
      if (enc3 !== 64) output = output + String.fromCharCode(chr2);
      if (enc4 !== 64) output = output + String.fromCharCode(chr3);
    }
    return output;
  };
  wx.btoa = global.btoa = function(input) {
    let output = "";
    let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    let i = 0;
    input = unescape(encodeURIComponent(input));
    while (i < input.length) {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      if (isNaN(chr2)) enc3 = enc4 = 64;
      else if (isNaN(chr3)) enc4 = 64;
      output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }
    return output;
  };
})();

// 标准导入方案
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as tfl from '@tensorflow/tfjs-converter';
import * as fetchWechat from 'fetch-wechat';
// 新增本地模型相关导入
import { loadLocalTfjsModel, checkNetworkStatus } from '@/utils/model-loader.js';
import { cacheTfjsGraphModelFromOss, isLocalModelReady, getLocalModelDir } from '@/utils/model-cache.js';

const MODEL_KEY = 'yolo_int8_v1';
const OSS_MODEL_JSON_URL = 'https://java-springboot-yunnanmushroom.oss-cn-beijing.aliyuncs.com/model/model.json';

// 重要：将模型定义在组件外部，避免 Vue 的 Proxy 拦截导致 backend 丢失
let yolov8Model = null;

// ==============================================
// YOLOv8 后处理工具函数
// ==============================================
const MUSHROOM_CLASSES = [
  "松茸", "鸡枞", "干巴菌", "白牛肝菌", "见手青", 
  "黄牛肝菌", "松露", "青头菌", "鸡油菌", "竹荪", 
  "羊肚菌", "虎掌菌", "奶浆菌", "铜绿菌", "谷熟菌", 
  "马屁泡", "珊瑚菌/刷把菌", "毒蝇伞", "白毒伞", "鹅膏毒伞", 
  "铁锈环柄菇", "催吐红菇", "绿孢伞", "橙黄菇", "假羊肚菌", "黄褶革菌"
];

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-9);
}

function nms(boxes, iouThresh = 0.45) {
  boxes.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const box of boxes) {
    let ok = true;
    for (const k of kept) {
      if (iou(box, k) > iouThresh) {
        ok = false;
        break;
      }
    }
    if (ok) kept.push(box);
  }
  return kept;
}

function decodeYoloV8(outputData, shape, confThresh = 0.4) {
  const C = shape[1]; // 84
  const N = shape[2]; // 8400
  const numClasses = C - 4;
  const boxes = [];

  for (let i = 0; i < N; i++) {
    // YOLOv8 格式：[cx, cy, w, h, class1, class2, ...]
    const cx = outputData[0 * N + i];
    const cy = outputData[1 * N + i];
    const w = outputData[2 * N + i];
    const h = outputData[3 * N + i];

    let bestScore = 0;
    let bestClass = -1;
    for (let c = 0; c < numClasses; c++) {
      const score = outputData[(4 + c) * N + i];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore > confThresh) {
      boxes.push({
        x1: cx - w / 2,
        y1: cy - h / 2,
        x2: cx + w / 2,
        y2: cy + h / 2,
        score: bestScore,
        class: bestClass
      });
    }
  }
  return boxes;
}

let tfInitialized = false;
async function initTensorFlow() {
  if (tfInitialized) return true;
  try {
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('TFJS 2.8.6 初始化成功 后端:', tf.getBackend());
    tfInitialized = true;
    return true;
  } catch (e) {
    console.error('TFJS 初始化失败:', e);
    return false;
  }
}

export default {
  data() {
    return {
      imgUrl: '',
      imgWidth: 0,
      imgHeight: 0,
      isModelLoaded: false,
      results: [],
      userId: getUserIdOrDefault(),
      // 认证状态相关
      authBanner: '',
      bannerType: ''
    };
  },
  // 页面加载生命周期：初始化 TensorFlow 并加载 YOLOv8 AI 模型
  // 策略：优先本地缓存，支持离线使用；网络异常时自动降级处理
  async onLoad() {
    uni.showLoading({ title: '加载模型中...' }); // 显示加载提示
    try {
      // 步骤 1: 初始化 TensorFlow.js 运行时环境
      // 配置后端、内存管理等底层依赖，为模型推理做准备
      await initTensorFlow();
          
      // 步骤 2: 检测当前网络状态和本地模型就绪情况
      const online = await checkNetworkStatus(); // true=在线，false=离线
      const ready = isLocalModelReady(MODEL_KEY); // 检查本地是否已有缓存模型
      const dir = getLocalModelDir(MODEL_KEY); // 获取本地模型存储路径
      console.log('网络状态:', online);
      console.log('本地模型就绪:', ready);
      console.log('本地模型目录:', dir);
          
      // 步骤 3: 本地模型未就绪时的处理逻辑
      if (!ready) {
        // 场景 A: 离线模式且无本地模型缓存
        if (!online) {
          // 降级策略：无法进行 AI 识别，仅保留基础图片显示功能
          console.log('离线模式且无本地模型，仅支持图片显示');
          this.isModelLoaded = false; // 标记模型未加载
          uni.hideLoading(); // 关闭加载提示
          uni.showToast({ title: '离线模式：仅支持图片显示', icon: 'none', duration: 3000 });
          return; // 提前返回，不执行后续加载流程
        }
        // 场景 B: 在线模式但首次使用（无本地缓存）
        // 处理：从 OSS 对象存储下载并缓存模型文件到本地
        console.log('开始缓存模型...');
        await cacheTfjsGraphModelFromOss({
          modelJsonUrl: OSS_MODEL_JSON_URL, // 模型 JSON 结构文件的 OSS 地址
          modelKey: MODEL_KEY // 模型唯一标识符，用于本地存储索引
        });
        console.log('模型缓存完成'); // 缓存成功日志
      }
          
      // 步骤 4: 从本地文件系统加载模型到内存
      // 无论在线/离线，只要执行到这里，本地应该有缓存模型
      console.log('开始加载本地模型...');
      try {
        // 从本地存储加载 TensorFlow.js 图模型
        // 加载成功后赋值给全局变量 yolov8Model，供后续推理使用
        yolov8Model = await loadLocalTfjsModel(MODEL_KEY);
        console.log('本地模型加载成功');
        this.isModelLoaded = true; // 更新组件状态：模型已就绪
        uni.showToast({ title: '模型加载成功', icon: 'success' }); // 成功提示
      } catch (modelError) {
        // 子级异常捕获：本地模型加载失败（文件损坏、版本不兼容等）
        console.error('本地模型加载失败:', modelError);
        this.isModelLoaded = false; // 标记模型不可用
        // 降级提示：告知用户功能受限
        uni.showToast({ title: '模型加载失败，仅支持图片显示', icon: 'none', duration: 3000 });
      }
          
      // 步骤 5: 初始化流程正常结束
      uni.hideLoading(); // 关闭加载提示框
      console.log('页面加载完成'); // 完成日志
    } catch (e) {
      // 外层全局异常捕获：处理任何未预料的错误
      uni.hideLoading(); // 确保关闭加载提示
      this.isModelLoaded = false; // 强制标记为未加载状态
          
      console.error('完整错误信息:', e);
      console.error('错误堆栈:', e.stack);
          
      // 兜底降级提示：确保用户知晓功能限制
      uni.showToast({ title: '初始化失败，仅支持图片显示', icon: 'none', duration: 3000 });
    }
  },
  async onShow() {
    // 更新认证状态横幅
    this.updateAuthBanner();
    
    // 每次回到首页，自动尝试同步一次挂起的记录
    console.log('首页 onShow - 检查待同步队列');
    this.syncQueue();
  },
  onUnload() {
    // 内存释放 
    try {
      if (yolov8Model?.dispose) {
        yolov8Model.dispose();
        yolov8Model = null;
      }
      // 兼容：这些 API 不一定存在
      if (tf?.disposeVariables) tf.disposeVariables();
      // if (tf?.resetBackend) tf.resetBackend();
    } catch (e) {
      console.warn('onUnload cleanup error:', e);
    }
  },
  methods: {
    async downloadModel() {
      try {
        uni.showLoading({ title: '下载模型中...' });
        
        const online = await checkNetworkStatus();
        if (!online) {
          uni.showToast({ title: '请连接网络后重试', icon: 'none' });
          return;
        }
        
        console.log('开始下载AI模型...');
        await cacheTfjsGraphModelFromOss({
          modelJsonUrl: OSS_MODEL_JSON_URL,
          modelKey: MODEL_KEY
        });
        
        // 下载完成后尝试加载模型
        console.log('模型下载完成，尝试加载...');
        try {
          yolov8Model = await loadLocalTfjsModel(MODEL_KEY);
          this.isModelLoaded = true;
          uni.hideLoading();
          uni.showToast({ title: '模型下载并加载成功！', icon: 'success' });
          console.log('模型准备就绪');
        } catch (loadModelError) {
          console.error('模型加载失败，但仍可使用基础功能:', loadModelError);
          this.isModelLoaded = false;
          uni.hideLoading();
          uni.showToast({ 
            title: '模型下载完成，但加载失败。可使用图片功能', 
            icon: 'none',
            duration: 3000
          });
        }
        
      } catch (error) {
        uni.hideLoading();
        console.error('模型下载失败:', error);
        uni.showToast({ title: '模型下载失败：' + error.message, icon: 'none' });
      }
    },
    
    async chooseImage() {
      // 清空之前的结果
      this.results = [];
      
      uni.chooseImage({
        count: 1, 
        sizeType: ['original'], 
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0];
          this.imgUrl = tempFilePath;
          
          // 核心逻辑：网络分流
          const network = await checkNetwork();
          
          if (network.isGood) {
            // 网络良好：优先走云端推理
            console.log('网络良好，调用云端推理');
            await this.cloudPredict(tempFilePath);
          } else {
            // 网络不佳：走本地模型
            console.log('网络不佳，使用本地模型');
            // 即使模型未加载，也要显示图片
            await this.getImageInfo();
            await this.drawImage();
            // 如果模型已加载，则进行本地识别
            if (this.isModelLoaded) {
              await this.localPredict();
            } else {
              // 模型未加载，只显示图片不进行识别
              uni.showToast({ title: '模型未加载，仅显示图片', icon: 'none', duration: 2000 });
            }
          }
        }
      });
    },
    getImageInfo() {
      return new Promise(resolve => {
        uni.getImageInfo({
          src: this.imgUrl,
          success: (info) => {
            // 原有图片自适应逻辑 完全保留 适配屏幕宽度
            const sys = uni.getSystemInfoSync();
            const displayW = sys.windowWidth - 40;
            const ratio = info.width / displayW;
            this.imgWidth = displayW;
            this.imgHeight = info.height / ratio;
            
            console.log('图片原始尺寸:', info.width, 'x', info.height);
            console.log('计算后尺寸:', this.imgWidth, 'x', this.imgHeight);
            
            resolve();
          }
        });
      });
    },
    drawImage() {
      return new Promise(resolve => {
        const canvasCtx = wx.createCanvasContext('detectCanvas');
        canvasCtx.drawImage(this.imgUrl, 0, 0, this.imgWidth, this.imgHeight);
        canvasCtx.draw(false, () => {
          // 延迟确保绘制完成 防止取色失败
          setTimeout(resolve, 200);
        });
      });
    },
    // 云端识别：将图片上传至服务器进行 AI 推理
    // 流程：上传图片 -> 后端处理 -> 返回识别结果 -> 本地缓存 -> 绘制显示
    async cloudPredict(tempFilePath) {
      uni.showLoading({ title: '云端识别中...' });
      
      return new Promise((resolve, reject) => {
        // 调用微信文件上传接口，发送图片到后端服务器
        uni.uploadFile({
          url: BASE_URL + '/api/recognition/predict', // 后端识别 API 端点
          filePath: tempFilePath, // 本地图片临时路径
          name: 'image', // 表单字段名
          formData: {
            userId: this.userId, // 用户 ID，用于关联记录
            inferModel: 1, // 1 = 云端推理模式
            deviceInfo: uni.getSystemInfoSync().model || 'unknown' // 设备型号信息
          },
          success: async (res) => {
            uni.hideLoading();
            try {
              // 解析后端返回的 JSON 数据
              const response = JSON.parse(res.data);
              if (response.code === 0 && response.data) {
                const record = response.data;
                console.log('云端识别成功:', record);
                
                // 在页面显示识别结果（UI 展示）
                this.displayCloudResult(record);
                
                // 持久化存储到本地缓存，支持离线查看
                this.saveCloudResultToCache(record);
                
                // 获取图片尺寸信息并在 Canvas 上绘制图片
                await this.getImageInfo();
                await this.drawImage();
                
                uni.showToast({ title: '识别完成', icon: 'success' });
                resolve(record); // 返回识别记录
              } else {
                throw new Error(response.msg || '识别失败');
              }
            } catch (e) {
              console.error('云端识别失败:', e);
              uni.showToast({ title: e.message || '识别异常', icon: 'none' });
              reject(e); // 抛出异常
            }
          },
          fail: (err) => {
            uni.hideLoading();
            console.error('上传失败:', err);
            uni.showToast({ title: '网络请求失败', icon: 'none' });
            reject(err); // 网络错误处理
          }
        });
      });
    },
    
    // 本地识别：使用 TensorFlow.js 模型在设备端进行 AI 推理
    // 流程：OffscreenCanvas 预处理 -> 张量转换 -> 模型推理 -> NMS 后处理 -> 坐标映射 -> 缓存同步
    async localPredict() {
      uni.showLoading({ title: '正在识别...' });
      try {
        // 步骤 1: 创建离屏 Canvas 获取图片像素数据
        // 避免直接在可见 Canvas 操作，提升性能且不影响 UI 渲染
        const canvas = wx.createOffscreenCanvas({ type: '2d' });
        const ctx = canvas.getContext('2d');
        const img = canvas.createImage();
        
        // 等待图片加载完成
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = this.imgUrl;
        });

        // 设置 Canvas 尺寸与图片一致
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // 提取 RGBA 像素数据（Uint8Array 格式）
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 步骤 2: 构建并预处理输入张量
        // 转换流程：RGBA -> RGB（移除 Alpha 通道）-> Resize 640x640 -> 归一化 [0,1]
        const inputTensor = tf.tidy(() => {
          const rgba = tf.tensor3d(new Uint8Array(data), [height, width, 4], 'int32');
          return rgba.slice([0, 0, 0], [height, width, 3]) // 截取 RGB 三通道
            .resizeBilinear([640, 640]) // 双线性插值缩放到模型输入尺寸
            .expandDims(0) // 添加 batch 维度 [1, 640, 640, 3]
            .toFloat() // 转换为浮点类型
            .div(255.0); // 像素值归一化到 [0, 1]
        });

        // 步骤 3: 执行模型推理
        console.log('执行推理...');
        const predictResult = await yolov8Model.executeAsync(inputTensor);
        const outputTensor = Array.isArray(predictResult) ? predictResult[0] : predictResult;
        
        // 步骤 4: 提取原始预测数据
        const rawData = await outputTensor.data(); // 获取张量数据数组
        const shape = outputTensor.shape; // 张量维度形状
        console.log('原始数据形态:', shape);

        // 步骤 5: YOLOv8 解码与非极大值抑制（NMS）
        // decodeYoloV8: 将模型输出转换为边界框坐标
        // nms: 去除重叠度高的冗余检测框，保留最优框
        let boxes = decodeYoloV8(rawData, shape, 0.4); // 置信度阈值 0.4
        boxes = nms(boxes, 0.45); // IoU 阈值 0.45
        
        console.log('本地识别到', boxes.length, '个目标');
        
        // 步骤 6: 坐标映射与信息补全
        // 将 640x640 标准化坐标映射回原图尺寸，并补充菌类元数据（名称、毒性等）
        const finalBoxes = boxes.map(b => {
          const classId = b.class; // 类别索引
          const meta = MUSHROOM_META[String(classId)]; // 从元数据表查询菌类信息
          
          // 核心逻辑：业务 ID 兜底策略
          // 判定标准：meta 不存在、meta.id 不存在、或 meta.id 为 -1 时，视为无效数据
          const isInvalid = !meta || !meta.id || meta.id === -1;
          
          // 无效数据处理：ID 置 0，名称设为"未知菌类"，毒性标记为 2（未知）
          const mushroomId = isInvalid ? 0 : meta.id;
          const className = isInvalid ? '未知菌类' : meta.name;
          const isPoisonous = isInvalid ? 2 : meta.isPoisonous;

          // 坐标变换：将 640 基准坐标缩放回实际图片尺寸
          return {
            x: (b.x1 + (b.x2 - b.x1) / 2) * (this.imgWidth / 640), // 中心点 X
            y: (b.y1 + (b.y2 - b.y1) / 2) * (this.imgHeight / 640), // 中心点 Y
            w: (b.x2 - b.x1) * (this.imgWidth / 640), // 宽度
            h: (b.y2 - b.y1) * (this.imgHeight / 640), // 高度
            score: (b.score * 100).toFixed(1) + '%', // 置信度百分比
            className: className, // 菌类名称
            classIndex: classId, // 类别索引
            isPoisonous: isPoisonous, // 毒性标识（0=无毒，1=有毒，2=未知）
            mushroomId: mushroomId // 业务数据库 ID
          };
        });

        // 步骤 7: 在 Canvas 上绘制识别框和标签
        this.results = finalBoxes; // 保存结果到组件状态
        this.drawDetectBoxes(finalBoxes); // 调用绘制方法

        // 步骤 8: 本地识别完成后的数据持久化与同步
        // 仅当检测到目标时才保存记录
        if (finalBoxes.length > 0) {
          // 选取置信度最高的检测框作为主要结果
          const best = [...finalBoxes].sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0];
          await this.saveLocalRecordToCache({
            imgTempPath: this.imgUrl, // 图片临时路径
            best: best, // 最佳检测结果
            allResults: finalBoxes // 全部检测结果
          });
          // 立即尝试将待同步队列上传至服务器（网络可用时自动同步）
          this.syncQueue();
        }

        // 步骤 9: 释放 TensorFlow 张量内存，防止内存泄漏
        inputTensor.dispose(); // 释放输入张量
        if (Array.isArray(predictResult)) {
          predictResult.forEach(t => t.dispose()); // 释放多个输出张量
        } else {
          predictResult.dispose(); // 释放单个输出张量
        }

        uni.hideLoading();
        uni.showToast({ title: `检测到 ${finalBoxes.length} 个目标`, icon: 'success' });
        console.log(`推理完成，找到 ${finalBoxes.length} 个结果`);
      } catch (error) {
        uni.hideLoading();
        console.error('识别失败:', error);
        uni.showToast({ title: '识别异常', icon: 'none' });
      }
    },
    
    // 显示云端识别结果
    displayCloudResult(record) {
      // 构造显示格式
      const displayItem = {
        className: record.mushroomName || '未知菌类',
        score: `${record.confidence}%`,
        isPoisonous: record.isPoisonous,
        mushroomId: record.mushroomId,
        recordId: record.recordId, // 保存 recordId 用于跳转
        imageUrl: record.imageUrl, // 保存图片 URL
        isCloudResult: true // 标记为云端识别结果
      };
      
      this.results = [displayItem];
      
      // 设置图片URL用于显示
      if (record.imageUrl) {
        this.imgUrl = record.imageUrl;
        console.log('设置云端图片URL:', this.imgUrl);
      }
      
      // 保存为最近一次结果
      uni.setStorageSync(`last_result_${this.userId}`, {
        ...record,
        displayTime: Date.now()
      });
    },
    
    // 云端结果写入本地缓存
    saveCloudResultToCache(record) {
      const cacheKey = `mushroom_records_${this.userId}`;
      const records = uni.getStorageSync(cacheKey) || [];
      
      // 转换为统一格式
      const cacheItem = {
        rid: `cloud_${record.recordId}`,
        recordId: record.recordId,
        userId: this.userId,
        imageUrl: record.imageUrl,
        mushroomId: record.mushroomId,
        mushroomName: record.mushroomName,
        confidence: record.confidence,
        isPoisonous: record.isPoisonous,
        recognizeTime: Date.now(),
        source: 'cloud'
      };
      
      records.unshift(cacheItem);
      uni.setStorageSync(cacheKey, records.slice(0, 200));
      console.log('云端记录已写入缓存');
    },
    
    // 绘制识别框
    drawDetectBoxes(boxes) {
      const ctx = wx.createCanvasContext('detectCanvas');
      // 先清空画布
      ctx.clearRect(0, 0, this.imgWidth, this.imgHeight);
      
      boxes.forEach(box => {
        const left = box.x - box.w / 2;
        const top = box.y - box.h / 2;
        ctx.setStrokeStyle('#ff0000');
        ctx.setLineWidth(2);
        ctx.strokeRect(left, top, box.w, box.h);
        
        ctx.setFillStyle('#ff0000');
        ctx.fillRect(left, top - 20, 160, 20);
        ctx.setFillStyle('#ffffff');
        ctx.setFontSize(12);
        ctx.fillText(`${box.className} ${box.score}`, left + 5, top - 5);
      });
      ctx.draw(false); // 不保留之前内容，因为我们每次都清空重画
    },
    //  本地识别结果写入缓存 + 入队
    async saveLocalRecordToCache({ imgTempPath, best, allResults }) {
      const now = Date.now();
      const rid = `${now}_${Math.random().toString(16).slice(2)}`;
      
      let savedPath = imgTempPath;
      try {
        // 固化图片路径，防止临时文件被清理
        const saveRes = await new Promise((resolve, reject) => {
          wx.saveFile({
            tempFilePath: imgTempPath,
            success: resolve,
            fail: reject
          });
        });
        savedPath = saveRes.savedFilePath;
      } catch (e) {
        console.warn('图片持久化失败:', e);
      }

      // 核心安全校验逻辑：锁定"未知/不可靠"结果
      const isUnknown = 
        !best.mushroomId || 
        best.mushroomId <= 0 || 
        best.className === '未知菌类';

      const safeMushroomId = isUnknown ? 0 : best.mushroomId;
      const safePoison = isUnknown ? 2 : best.isPoisonous;
      const safeName = isUnknown ? '未知菌类' : best.className;
      const safeConfidence = Number(parseFloat(best.score).toFixed(2));

      const record = {
        rid,
        recordId: null,
        userId: this.userId,
        imageUrl: savedPath,
        mushroomId: safeMushroomId, // 强制业务 ID 兜底
        mushroomName: safeName,
        confidence: safeConfidence,
        isPoisonous: safePoison,
        recognizeTime: now,
        createTime: now,
        results: allResults,
        source: 'local_history'
      };

      // 1. 写入 records_cache（展示用）
      const cacheKey = `mushroom_records_${this.userId}`;
      const records = uni.getStorageSync(cacheKey) || [];
      records.unshift(record);
      uni.setStorageSync(cacheKey, records.slice(0, 200));
      
      // 2. 写入 sync_queue（待同步）
      this.enqueueLocalRecord(record);
      
      // 3. 保存为 last_result
      uni.setStorageSync(`last_result_${this.userId}`, {
        ...record,
        displayTime: Date.now()
      });
      
      console.log('本地记录已写入缓存+队列, 安全ID:', safeMushroomId);
    },
    
    //  本地记录入队（仅本地推理）
    enqueueLocalRecord(record) {
      const key = `pending_queue_${this.userId}`;
      const queue = uni.getStorageSync(key) || [];
      
      // 构造同步专用的结构
      const syncItem = {
        localId: record.rid,
        userId: this.userId,
        mushroomId: record.mushroomId,
        mushroomName: record.mushroomName, // 新增：保留识别名称，用于无感显示
        confidence: record.confidence,
        isPoisonous: record.isPoisonous,
        deviceInfo: uni.getSystemInfoSync().model || '',
        imagePath: record.imageUrl,
        createTime: record.createTime,
        tryCount: 0
      };
      
      queue.push(syncItem);
      uni.setStorageSync(key, queue);
      console.log('记录已入同步队列');
    },
    // 尝试同步队列
    async syncQueue() {
      const network = await checkNetwork();
      if (!network.isGood) {
        console.log('当前网络环境不佳，跳过自动同步');
        return;
      }
      console.log('网络环境良好，开始同步队列...');
      await this.uploadQueue(this.userId);
    },
    // 执行队列上传
    async uploadQueue(userId) {
      const key = `pending_queue_${userId}`;
      const list = uni.getStorageSync(key) || [];
      if (!list.length) return;

      const remain = [];
      for (const item of list) {
        try {
          await this.uploadLocalRecord(item);
          console.log('同步成功:', item.localId);
        } catch (e) {
          console.error('同步失败:', item.localId, e);
          item.tryCount = (item.tryCount || 0) + 1;
          if (item.tryCount < 3) remain.push(item);
        }
      }
      uni.setStorageSync(key, remain);
      console.log('同步完成，剩余待同步记录:', remain.length);
    },
    // 上传单条本地记录到服务器（同步接口）
    uploadLocalRecord(item) {
      return new Promise((resolve, reject) => {
        // 确保数值为纯数字字符串，不带百分号
        const pureConfidence = typeof item.confidence === 'string' 
          ? parseFloat(item.confidence.replace('%', '')) 
          : item.confidence;

        uni.uploadFile({
          url: BASE_URL + '/api/recognition/report', // 上报本地识别结果 
          filePath: item.imagePath,
          name: 'image',
          formData: {
            userId: item.userId,
            mushroomId: item.mushroomId, //  关键：把前端锁定的 ID 0 传回后端
            confidence: pureConfidence,  //  关键：把前端的置信度传回后端
            isPoisonous: item.isPoisonous,
            inferModel: 0, 
            deviceInfo: item.deviceInfo || 'offline_sync'
          },
          success: (res) => {
            console.log('同步接口原始返回:', res.data);
            try {
              const data = JSON.parse(res.data);
              // 兼容性判定：如果 code 为 0，或者直接返回了包含 ID 的对象，都视为成功
              const isSuccess = data.code === 0 || data.recordId || data.id || data.success === true;
              
              if (isSuccess) {
                resolve(data.data || data);
              } else {
                reject(new Error(data.msg || '后端业务报错'));
              }
            } catch (e) {
              // 容错：如果解析失败但状态码是 200，也尝试视为成功（针对非包装返回）
              if (res.statusCode === 200 && res.data && res.data.length < 500) {
                resolve(res.data);
              } else {
                reject(new Error(`服务器响应异常(${res.statusCode})`));
              }
            }
          },
          fail: (err) => {
            console.error('上传网络失败:', err);
            reject(err);
          }
        });
      });
    },
    // 跳转到识别记录详情页面
    goToDetail(item) {
      console.log('点击跳转，数据:', item);
      
      // 使用应用的安全跳转方法
      const app = getApp();
      if (app && app.safeNavigateTo) {
        // 判断是云端识别还是本地识别
        if (item.isCloudResult && item.recordId) {
          // 云端识别：跳转到识别记录详情页
          const url = `/pages/record-detail/record-detail?recordId=${item.recordId}`;
          console.log('云端识别，跳转到记录详情页:', url);
          app.safeNavigateTo(url);
        } else {
          // 本地识别：跳转到菌类详情页
          const url = `/pages/mushroom-detail/mushroom-detail?mushroomName=${encodeURIComponent(item.className)}&classId=${item.classIndex}&imgUrl=${encodeURIComponent(this.imgUrl)}`;
          console.log('本地识别，跳转到菌类详情页:', url);
          app.safeNavigateTo(url);
        }
      } else {
        // 降级处理
        console.warn('安全跳转方法不可用，使用普通跳转');
        this.performNavigation(item);
      }
    },
    
    // 执行实际跳转（降级处理）
    performNavigation(item) {
      // 判断是云端识别还是本地识别
      if (item.isCloudResult && item.recordId) {
        // 云端识别：跳转到识别记录详情页
        const url = `/pages/record-detail/record-detail?recordId=${item.recordId}`;
        console.log('云端识别，跳转到记录详情页:', url);
        
        uni.navigateTo({
          url: url,
          fail: (err) => {
            console.error('跳转失败:', err);
            uni.showToast({ title: '无法打开详情页', icon: 'none' });
          }
        });
      } else {
        // 本地识别：跳转到菌类详情页（原有逻辑）
        const url = `/pages/mushroom-detail/mushroom-detail?mushroomName=${encodeURIComponent(item.className)}&classId=${item.classIndex}&imgUrl=${encodeURIComponent(this.imgUrl)}`;
        console.log(' 本地识别，跳转到菌类详科页:', url);
        
        uni.navigateTo({
          url: url,
          fail: (err) => {
            console.error('跳转失败:', err);
            uni.showToast({ title: '无法打开详情页', icon: 'none' });
          }
        });
      }
    },
    
    // 图片加载失败处理
    onImageError(e) {
      console.error('图片加载失败:', this.imgUrl, e);
      uni.showToast({
        title: '图片加载失败',
        icon: 'none'
      });
    },
    
    // 图片加载成功处理
    onImageLoad() {
      console.log('图片加载成功');
    },
    
    // 更新认证状态横幅
    updateAuthBanner() {
      const app = getApp();
      const state = app.globalData.authState;
      const pendingCount = (uni.getStorageSync('pendingQueue') || []).length;
      
      switch (state) {
        case 'OFFLINE_CACHED':
          this.authBanner = `离线可用：待同步 ${pendingCount} 条`;
          this.bannerType = 'info';
          break;
        case 'OFFLINE_GUEST':
          this.authBanner = '离线游客模式：联网后可登录同步';
          this.bannerType = 'warning';
          break;
        case 'ONLINE_NEED_LOGIN':
          this.authBanner = '登录失败：可先离线识别，稍后重试';
          this.bannerType = 'error';
          break;
        default:
          this.authBanner = '';
          this.bannerType = '';
      }
    },
    
    // 手动重试登录
    async retryLogin() {
      const app = getApp();
      // 触发网络恢复逻辑
      await onNetworkBack(app);
      this.updateAuthBanner();
    }
  }
};
</script>

<style scoped>
/* 认证状态横幅样式 */
.status-banner {
  padding: 20rpx 30rpx;
  text-align: center;
  font-size: 26rpx;
}

.status-banner.info {
  background: #E7F7ED;
  color: #52C41A;
}

.status-banner.warning {
  background: #FFFBE6;
  color: #FAAD14;
}

.status-banner.error {
  background: #FFF2F0;
  color: #FF4D4F;
}

.banner-text {
  font-weight: 500;
}

.container {
  min-height: 100vh;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}

.header-area {
  padding: 40rpx 30rpx 30rpx;
  background: linear-gradient(180deg, #B8C5F2 0%, #D4DBF5 100%);
}

.title {
  font-size: 38rpx;
  font-weight: 600;
  text-align: center;
  color: #fff;
  letter-spacing: 2rpx;
}

.content-area {
  flex: 1;
  padding: 30rpx;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.canvas-box {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;
}

/* 图片预览区域样式 */
.image-preview-section {
  background: #fff;
  padding: 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(184, 197, 242, 0.1);
  margin-bottom: 30rpx;
}

.preview-header {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  position: relative;
  padding-left: 20rpx;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6rpx;
  height: 32rpx;
  background: #87CEEB;
  border-radius: 3rpx;
}

.image-wrapper {
  position: relative;
  display: inline-block; /* 让容器按内容撑开 */
  background: #f5f7fa;
  border-radius: 16rpx;
  overflow: hidden;
}

.preview-image {
  display: block;
  width: 100%;
  height: 100%;
}

.overlay-canvas {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 10;
  pointer-events: none;
  background-color: transparent; /* 防止某些机型出现不透明 */
}

/* 无图片占位符样式 */
.no-image-placeholder {
  background: #fff;
  padding: 60rpx 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(184, 197, 242, 0.1);
  margin-bottom: 30rpx;
  text-align: center;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.placeholder-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}

canvas {
  border-radius: 16rpx;
  background: #f5f7fa;
  box-shadow: 0 2rpx 16rpx rgba(184, 197, 242, 0.1);
}

.button-area {
  padding: 30rpx;
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.identify-btn {
  width: 100%;
  height: 96rpx;
  background: #87CEEB;
  border-radius: 48rpx;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 96rpx;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(135, 206, 235, 0.3);
  border: none;
  letter-spacing: 2rpx;
}

.identify-btn::after {
  border: none;
}

.identify-btn:active {
  opacity: 0.9;
  transform: scale(0.98);
}

.download-btn {
  width: 100%;
  height: 96rpx;
  background: #FFA500;
  border-radius: 48rpx;
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  line-height: 96rpx;
  box-shadow: 0 8rpx 24rpx rgba(255, 165, 0, 0.3);
  border: none;
  letter-spacing: 2rpx;
  margin-bottom: 30rpx;
}

.download-btn::after {
  border: none;
}

.download-btn:active {
  opacity: 0.9;
  transform: scale(0.98);
}

.model-status {
  background: #fff3cd;
  border: 2rpx solid #ffeaa7;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  margin-top: 20rpx;
}

.status-text {
  display: block;
  color: #856404;
  font-size: 28rpx;
  margin: 10rpx 0;
}

.result-list {
  background: #fff;
  padding: 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 16rpx rgba(184, 197, 242, 0.1);
  width: 100%;
  max-width: 600rpx;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #F0F2F5;
}

.result-title {
  font-weight: 600;
  font-size: 32rpx;
  color: #333;
}

.result-count {
  font-size: 24rpx;
  color: #999;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.2s;
}

.result-item:last-of-type {
  border-bottom: none;
}

.result-item:active {
  background-color: #F8F9FA;
}

.item-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.name {
  color: #333;
  font-size: 30rpx;
  font-weight: 500;
}

.tag {
  margin-left: 16rpx;
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 12rpx;
  font-weight: 500;
}

.tag-safe {
  background: #E7F7ED;
  color: #52C41A;
}

.tag-danger {
  background: #B8E0F2;
  color: #1E1E1E;
}

.tag-warning {
  background: #B8E0F2;
  color: #1E1E1E;
}

.item-right {
  display: flex;
  align-items: center;
}

.score {
  color: #2894FA;
  font-weight: 600;
  font-size: 28rpx;
  margin-right: 12rpx;
}

.arrow {
  color: #C8CCD4;
  font-size: 32rpx;
  font-weight: 300;
}

.safe-tip {
  margin-top: 30rpx;
  font-size: 24rpx;
  color: #FF6B6B;
  text-align: center;
  background: #FFF5F5;
  padding: 20rpx;
  border-radius: 16rpx;
  line-height: 1.6;
}
</style>