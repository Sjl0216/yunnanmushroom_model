// utils/model-cache.js
const fs = wx.getFileSystemManager();

function now() { return Date.now(); }

function ensureDir(dir) {
  try { 
    fs.accessSync(dir); 
  } catch { 
    fs.mkdirSync(dir, true); 
  }
}

// 下载到持久目录（不要用 tempFilePath 直接当缓存）
async function downloadToFile(url, targetPath) {
  try {
    console.log('开始下载文件:', url);
    
    // 使用 uni.downloadFile 替代 wx.downloadFile
    const downloadResult = await new Promise((resolve, reject) => {
      uni.downloadFile({
        url: url,
        success: resolve,
        fail: reject
      });
    });
    
    console.log('下载结果:', downloadResult);
    
    // 检查下载状态
    if (downloadResult.statusCode !== 200) {
      throw new Error(`下载失败：HTTP状态码 ${downloadResult.statusCode}`);
    }
    
    if (!downloadResult || !downloadResult.tempFilePath) {
      throw new Error('下载失败：未获得临时文件路径');
    }
    
    const tempFilePath = downloadResult.tempFilePath;
    console.log('临时文件路径:', tempFilePath);
    console.log('目标路径:', targetPath);
    
    // 对于 model.json 文件，添加内容验证
    if (targetPath.endsWith('model.json')) {
      const jsonContent = fs.readFileSync(tempFilePath, 'utf8');
      console.log('model.json 前200字符:', jsonContent.slice(0, 200));
      
      try {
        JSON.parse(jsonContent);
        console.log('model.json JSON.parse 校验通过');
      } catch (parseError) {
        console.error('model.json JSON解析失败:', parseError);
        console.error('实际内容:', jsonContent.slice(0, 500));
        throw new Error('下载的 model.json 不是有效JSON格式');
      }
    }
    
    // copy 到 USER_DATA_PATH，保证离线还能访问
    fs.copyFileSync(tempFilePath, targetPath);
    console.log('文件复制成功');
  } catch (error) {
    console.error('下载文件错误:', error);
    console.error('请求URL:', url);
    throw error;
  }
}

// 读取 JSON
function readJson(path) {
  const txt = fs.readFileSync(path, 'utf8');
  return JSON.parse(txt);
}

export async function cacheTfjsGraphModelFromOss({
  modelJsonUrl,
  modelKey, // 比如 yolo_int8_v1
}) {
  const baseDir = `${wx.env.USER_DATA_PATH}/models/${modelKey}`;
  ensureDir(baseDir);

  const localJsonPath = `${baseDir}/model.json`;

  // 1) 下载 model.json
  await downloadToFile(modelJsonUrl, localJsonPath);

  // 2) 解析 shards 列表
  const json = readJson(localJsonPath);
  const shardFiles = [];
  for (const wm of (json.weightsManifest || [])) {
    for (const p of (wm.paths || [])) shardFiles.push(p);
  }

  // 3) 下载所有 shard
  const shardBaseUrl = modelJsonUrl.replace(/\/model\.json(\?.*)?$/, '/');
  for (const f of shardFiles) {
    await downloadToFile(shardBaseUrl + f, `${baseDir}/${f}`);
  }

  // 4) 写入就绪标记
  wx.setStorageSync(`localModelReady:${modelKey}`, true);
  wx.setStorageSync(`localModelDir:${modelKey}`, baseDir);
  wx.setStorageSync(`localModelCachedAt:${modelKey}`, now());

  return { baseDir, localJsonPath, shardCount: shardFiles.length };
}

// 检查本地模型是否就绪
export function isLocalModelReady(modelKey) {
  return wx.getStorageSync(`localModelReady:${modelKey}`) === true;
}

// 获取本地模型目录
export function getLocalModelDir(modelKey) {
  return wx.getStorageSync(`localModelDir:${modelKey}`);
}