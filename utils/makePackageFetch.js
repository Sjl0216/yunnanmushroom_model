// utils/makePackageFetch.js
const fs = wx.getFileSystemManager();

function bufToText(buf) {
  return new TextDecoder('utf-8').decode(new Uint8Array(buf));
}

export function makePackageFetch(baseDir) {
  // baseDir 示例：/pkg-ai/models/yolov8n_int8
  return async function(url) {
    const name = String(url).split('/').pop();
    const filePath = `${baseDir}/${name}`;

    const buffer = fs.readFileSync(filePath); // ✅ 直接读分包内文件
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => buffer,
      text: async () => bufToText(buffer),
      json: async () => JSON.parse(bufToText(buffer))
    };
  };
}