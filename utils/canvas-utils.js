/**
 * 画布工具函数
 */

// 绘制检测框
export function drawDetectionBoxes(canvasId, imgPath, imgWidth, imgHeight, boxes) {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext(canvasId);
    
    // 先绘制背景图片
    ctx.drawImage(imgPath, 0, 0, imgWidth, imgHeight);
    
    // 绘制每个检测框
    boxes.forEach(box => {
      const left = box.x1;
      const top = box.y1;
      const width = box.x2 - box.x1;
      const height = box.y2 - box.y1;
      
      // 绘制红色边框
      ctx.setStrokeStyle('#ff0000');
      ctx.setLineWidth(2);
      ctx.rect(left, top, width, height);
      ctx.stroke();
      
      // 绘制标签背景
      ctx.setFillStyle('#ff0000');
      ctx.fillRect(left, top - 20, 120, 20);
      
      // 绘制标签文字
      ctx.setFillStyle('#ffffff');
      ctx.setFontSize(12);
      const labelText = `${box.name} ${(box.score || 0).toFixed(1)}%`;
      ctx.fillText(labelText, left + 5, top - 5);
    });
    
    // 绘制到画布
    ctx.draw(false, () => {
      resolve();
    });
  });
}

// 根据图片尺寸计算合适的画布尺寸
export function calculateCanvasSize(imageWidth, imageHeight, maxWidth = 700, maxHeight = 700) {
  const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
  return {
    width: imageWidth * ratio,
    height: imageHeight * ratio,
    ratio: ratio
  };
}