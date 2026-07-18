// utils/local-fetch.js
const fs = wx.getFileSystemManager();

function arrayBufferToText(buf) {
  // ArrayBuffer -> string
  return new TextDecoder('utf-8').decode(new Uint8Array(buf));
}

export function makeLocalFetch(baseDir) {
  return async function(url) {
    // url 可能是 'model.json' 或 'group1-shard1ofX.bin' 或带路径
    const name = String(url).split('/').pop();
    const path = `${baseDir}/${name}`;

    const buffer = fs.readFileSync(path); // 返回 ArrayBuffer

    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => buffer,
      text: async () => arrayBufferToText(buffer),
      json: async () => JSON.parse(arrayBufferToText(buffer)),
    };
  };
}