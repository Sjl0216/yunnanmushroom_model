// utils/makeLocalFetch.js
const fs = wx.getFileSystemManager();

// ArrayBuffer -> string（兼容小程序真机）
function ab2str(buffer) {
  // buffer 是 ArrayBuffer
  const uint8 = new Uint8Array(buffer);
  let s = '';
  const chunk = 0x8000; // 防止 call stack overflow
  for (let i = 0; i < uint8.length; i += chunk) {
    s += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return s;
}

export function makeUsrFetch(baseDir) {
  // baseDir 例：wxfile://usr/models/yolo_int8_v1
  return async function (url) {
    const name = String(url).split('/').pop();
    const filePath = `${baseDir}/${name}`;

    console.log('Local fetch reading:', filePath);
    
    try {
      const buffer = fs.readFileSync(filePath); // ArrayBuffer
      console.log('File read success, size:', buffer.byteLength);
      
      // 对于 JSON 文件，额外验证内容
      if (name === 'model.json') {
        const content = ab2str(buffer);
        console.log('model.json content first 100 chars:', content.slice(0, 100));
        try {
          JSON.parse(content);
          console.log('model.json content validation OK');
        } catch (e) {
          console.error('model.json content invalid:', e);
          console.error('Full content:', content);
        }
      }
      
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => buffer,
        text: async () => ab2str(buffer),
        json: async () => {
          const content = ab2str(buffer);
          return JSON.parse(content);
        }
      };
    } catch (error) {
      console.error('Local fetch failed for:', filePath, error);
      throw error;
    }
  };
}