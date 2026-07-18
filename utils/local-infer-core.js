const DEFAULT_LOCAL_INFER_CONFIG = Object.freeze({
  inputSize: 640,
  padValue: 114,
  preprocessMode: 'direct_resize',
  confThreshold: 0.25,
  iouThreshold: 0.65,
  nmsMode: 'global',
  enableFallback: false,
  fallbackConfThreshold: 0.15,
  maxDetections: 50,
  boxFormat: 'xyxy',
  debug: false
});

const ENGLISH_CLASS_NAMES = [
  'matsutake',
  'termitomyces',
  'ganba_mushroom',
  'bolete_white',
  'bolete_bluebury',
  'bolete_yellow',
  'truffle',
  'russula_green',
  'chanterelle',
  'bamboo_fungus',
  'morel',
  'black_tiger_mushroom',
  'lactarius_milkcap',
  'lactarius_green',
  'cereal_mushroom',
  'puffball',
  'coral_mushroom_mix',
  'amanita_muscaria',
  'amanita_exitialis',
  'amanita_phalloides',
  'amanita_bisulcata',
  'russula_emetica',
  'chlorophyllum_molybdites',
  'omphalotus_olearius',
  'gyromitra_esculenta',
  'entoloma_sinuatum'
];

const EXPECTED_LOCAL_CLASS_COUNT = ENGLISH_CLASS_NAMES.length;

function normalizeLocalInferConfig(overrides) {
  const config = Object.assign({}, DEFAULT_LOCAL_INFER_CONFIG, overrides || {});

  if (!['direct_resize', 'letterbox'].includes(config.preprocessMode)) {
    config.preprocessMode = DEFAULT_LOCAL_INFER_CONFIG.preprocessMode;
  }
  if (!['global', 'class_wise'].includes(config.nmsMode)) {
    config.nmsMode = DEFAULT_LOCAL_INFER_CONFIG.nmsMode;
  }
  if (config.boxFormat !== 'xyxy') {
    config.boxFormat = DEFAULT_LOCAL_INFER_CONFIG.boxFormat;
  }

  config.inputSize = Number(config.inputSize) || DEFAULT_LOCAL_INFER_CONFIG.inputSize;
  config.padValue = Number(config.padValue);
  config.confThreshold = Number(config.confThreshold);
  config.iouThreshold = Number(config.iouThreshold);
  config.fallbackConfThreshold = Number(config.fallbackConfThreshold);
  config.maxDetections = Number(config.maxDetections) || DEFAULT_LOCAL_INFER_CONFIG.maxDetections;
  config.enableFallback = Boolean(config.enableFallback);
  config.debug = Boolean(config.debug);

  return config;
}

function createLocalModelOutputMismatchError({
  shape,
  expectedClassCount,
  actualClassChannels,
  reason
}) {
  const shapeText = Array.isArray(shape) ? JSON.stringify(shape) : String(shape);
  const detail = [
    `outputShape=${shapeText}`,
    `expectedClassCount=${expectedClassCount}`,
    actualClassChannels === null || actualClassChannels === undefined
      ? null
      : `actualClassChannels=${actualClassChannels}`,
    `reason=${reason}`
  ].filter(Boolean).join(', ');

  const error = new Error(`LOCAL_MODEL_OUTPUT_MISMATCH: ${detail}`);
  error.code = 'LOCAL_MODEL_OUTPUT_MISMATCH';
  error.outputShape = Array.isArray(shape) ? shape.slice() : shape;
  error.expectedClassCount = expectedClassCount;
  error.actualClassChannels = actualClassChannels;
  error.reason = reason;
  return error;
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundNumber(value, digits = 6) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value;
  }
  return Number(value.toFixed(digits));
}

function toXyxyBox(box, boxFormat = 'xyxy') {
  if (!box) return null;
  if (boxFormat !== 'xyxy') {
    throw new Error(`Unsupported box format: ${boxFormat}`);
  }

  if (Array.isArray(box)) {
    return {
      x1: Number(box[0]),
      y1: Number(box[1]),
      x2: Number(box[2]),
      y2: Number(box[3])
    };
  }

  if (typeof box === 'object') {
    return {
      x1: Number(box.x1),
      y1: Number(box.y1),
      x2: Number(box.x2),
      y2: Number(box.y2)
    };
  }

  return null;
}

function compareBoxesIoU(boxA, boxB, boxFormat = 'xyxy') {
  const a = toXyxyBox(boxA, boxFormat);
  const b = toXyxyBox(boxB, boxFormat);

  if (!a || !b) {
    return 0;
  }

  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - inter;

  if (union <= 0) {
    return 0;
  }
  return inter / union;
}

function buildInputTensorFromRgbData(tf, rgbData, width, height, configInput) {
  const config = normalizeLocalInferConfig(configInput);
  const inputSize = config.inputSize;

  const preprocessMeta = {
    preprocessMode: config.preprocessMode,
    origWidth: width,
    origHeight: height,
    inputSize,
    padValue: config.padValue,
    scale: null,
    padX: 0,
    padY: 0,
    resizedWidth: inputSize,
    resizedHeight: inputSize,
    boxFormat: config.boxFormat
  };

  const inputTensor = tf.tidy(() => {
    const rgb = tf.tensor3d(new Uint8Array(rgbData), [height, width, 3], 'int32');

    if (config.preprocessMode === 'letterbox') {
      const scale = Math.min(inputSize / width, inputSize / height);
      const resizedWidth = Math.max(1, Math.round(width * scale));
      const resizedHeight = Math.max(1, Math.round(height * scale));
      const padX = Math.floor((inputSize - resizedWidth) / 2);
      const padY = Math.floor((inputSize - resizedHeight) / 2);
      const padRight = inputSize - resizedWidth - padX;
      const padBottom = inputSize - resizedHeight - padY;

      preprocessMeta.scale = scale;
      preprocessMeta.padX = padX;
      preprocessMeta.padY = padY;
      preprocessMeta.resizedWidth = resizedWidth;
      preprocessMeta.resizedHeight = resizedHeight;

      return rgb
        .resizeBilinear([resizedHeight, resizedWidth])
        .pad([[padY, padBottom], [padX, padRight], [0, 0]], config.padValue)
        .expandDims(0)
        .toFloat()
        .div(255.0);
    }

    preprocessMeta.scale = null;
    return rgb
      .resizeBilinear([inputSize, inputSize])
      .expandDims(0)
      .toFloat()
      .div(255.0);
  });

  return {
    inputTensor,
    inputShape: inputTensor.shape ? inputTensor.shape.slice() : [1, inputSize, inputSize, 3],
    preprocessMeta
  };
}

function resolveModelOutputContract(shape, expectedClassCount = EXPECTED_LOCAL_CLASS_COUNT) {
  if (!Array.isArray(shape) || shape.length !== 3) {
    throw createLocalModelOutputMismatchError({
      shape,
      expectedClassCount,
      actualClassChannels: null,
      reason: 'shape_must_be_rank3'
    });
  }

  const [batch, dim1, dim2] = shape.map((value) => Number(value));
  const expectedChannels = expectedClassCount + 4;

  if (batch !== 1) {
    throw createLocalModelOutputMismatchError({
      shape,
      expectedClassCount,
      actualClassChannels: null,
      reason: 'batch_must_be_1'
    });
  }

  if (dim1 === expectedChannels && dim2 > 0) {
    return {
      layout: 'BCN',
      channels: dim1,
      candidates: dim2,
      expectedClassCount,
      hasObjectness: false,
      classScoreActivated: true,
      boxEncoding: 'cxcywh'
    };
  }

  if (dim2 === expectedChannels && dim1 > 0) {
    return {
      layout: 'BNC',
      channels: dim2,
      candidates: dim1,
      expectedClassCount,
      hasObjectness: false,
      classScoreActivated: true,
      boxEncoding: 'cxcywh'
    };
  }

  const probableChannels = Math.min(dim1, dim2);
  const probableClassChannels = probableChannels > 4 ? (probableChannels - 4) : null;
  let reason = 'channel_count_unexpected';

  if (probableChannels === expectedChannels + 1) {
    reason = 'unexpected_objectness_channel';
  } else if (probableClassChannels === 80) {
    reason = 'looks_like_80_class_export';
  }

  throw createLocalModelOutputMismatchError({
    shape,
    expectedClassCount,
    actualClassChannels: probableClassChannels,
    reason
  });
}

function decodeCurrentModelOutput(outputData, shape, configInput) {
  const config = normalizeLocalInferConfig(configInput);
  const boxes = [];
  const outputContract = resolveModelOutputContract(shape);
  const { layout, channels, candidates, expectedClassCount } = outputContract;

  for (let i = 0; i < candidates; i++) {
    const rowOffset = layout === 'BCN' ? i : (i * channels);
    const cx = layout === 'BCN' ? outputData[i] : outputData[rowOffset];
    const cy = layout === 'BCN' ? outputData[candidates + i] : outputData[rowOffset + 1];
    const w = layout === 'BCN' ? outputData[(2 * candidates) + i] : outputData[rowOffset + 2];
    const h = layout === 'BCN' ? outputData[(3 * candidates) + i] : outputData[rowOffset + 3];

    let bestScore = 0;
    let bestClass = -1;
    for (let c = 0; c < expectedClassCount; c++) {
      const score = layout === 'BCN'
        ? outputData[((4 + c) * candidates) + i]
        : outputData[rowOffset + 4 + c];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }

    if (bestScore >= config.confThreshold) {
      boxes.push({
        x1: cx - w / 2,
        y1: cy - h / 2,
        x2: cx + w / 2,
        y2: cy + h / 2,
        score: bestScore,
        classId: bestClass,
        boxFormat: config.boxFormat
      });
    }
  }

  return boxes;
}

function sortBoxesByScore(boxes) {
  return boxes.slice().sort((a, b) => b.score - a.score);
}

function applyGlobalNms(boxes, iouThreshold, boxFormat = 'xyxy') {
  const sorted = sortBoxesByScore(boxes);
  const kept = [];

  for (const box of sorted) {
    let keep = true;
    for (const accepted of kept) {
      if (compareBoxesIoU(box, accepted, boxFormat) > iouThreshold) {
        keep = false;
        break;
      }
    }
    if (keep) {
      kept.push(box);
    }
  }

  return kept;
}

function applyClassWiseNms(boxes, iouThreshold, boxFormat = 'xyxy') {
  const grouped = new Map();
  for (const box of boxes) {
    const key = String(box.classId);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(box);
  }

  const kept = [];
  for (const bucket of grouped.values()) {
    kept.push(...applyGlobalNms(bucket, iouThreshold, boxFormat));
  }

  return sortBoxesByScore(kept);
}

function applyConfiguredNms(boxes, configInput) {
  const config = normalizeLocalInferConfig(configInput);
  const nmsResult = config.nmsMode === 'class_wise'
    ? applyClassWiseNms(boxes, config.iouThreshold, config.boxFormat)
    : applyGlobalNms(boxes, config.iouThreshold, config.boxFormat);

  return nmsResult.slice(0, config.maxDetections);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mapBoxesToOriginalImage(boxes, preprocessMeta, configInput) {
  const config = normalizeLocalInferConfig(configInput);
  const mapped = [];
  const { origWidth, origHeight, inputSize } = preprocessMeta;

  for (const box of boxes) {
    let x1;
    let y1;
    let x2;
    let y2;

    if (config.preprocessMode === 'letterbox' && preprocessMeta.scale) {
      const scale = preprocessMeta.scale;
      x1 = (box.x1 - preprocessMeta.padX) / scale;
      y1 = (box.y1 - preprocessMeta.padY) / scale;
      x2 = (box.x2 - preprocessMeta.padX) / scale;
      y2 = (box.y2 - preprocessMeta.padY) / scale;
    } else {
      const scaleX = origWidth / inputSize;
      const scaleY = origHeight / inputSize;
      x1 = box.x1 * scaleX;
      y1 = box.y1 * scaleY;
      x2 = box.x2 * scaleX;
      y2 = box.y2 * scaleY;
    }

    x1 = clamp(x1, 0, origWidth);
    y1 = clamp(y1, 0, origHeight);
    x2 = clamp(x2, 0, origWidth);
    y2 = clamp(y2, 0, origHeight);

    if (x2 <= x1 || y2 <= y1) {
      continue;
    }

    mapped.push({
      x1,
      y1,
      x2,
      y2,
      score: box.score,
      classId: box.classId,
      boxFormat: config.boxFormat
    });
  }

  return mapped;
}

function mapDetectionsToDisplay(detections, originalWidth, originalHeight, displayWidth, displayHeight, boxFormat = 'xyxy') {
  const scaleX = displayWidth / originalWidth;
  const scaleY = displayHeight / originalHeight;

  return detections.map((item) => {
    const displayX1 = item.x1 * scaleX;
    const displayY1 = item.y1 * scaleY;
    const displayX2 = item.x2 * scaleX;
    const displayY2 = item.y2 * scaleY;

    return Object.assign({}, item, {
      boxFormat,
      boxOriginal: {
        x1: item.x1,
        y1: item.y1,
        x2: item.x2,
        y2: item.y2
      },
      boxDisplay: {
        x1: displayX1,
        y1: displayY1,
        x2: displayX2,
        y2: displayY2
      },
      x: (displayX1 + displayX2) / 2,
      y: (displayY1 + displayY2) / 2,
      w: displayX2 - displayX1,
      h: displayY2 - displayY1
    });
  });
}

function summarizeDetections(detections, maxItems = 5) {
  return sortBoxesByScore(detections).slice(0, maxItems).map((item) => ({
    classId: item.classId,
    score: roundNumber(item.score, 6),
    box: [
      roundNumber(item.x1, 3),
      roundNumber(item.y1, 3),
      roundNumber(item.x2, 3),
      roundNumber(item.y2, 3)
    ],
    boxFormat: item.boxFormat || 'xyxy',
    englishClassName: ENGLISH_CLASS_NAMES[item.classId] || null
  }));
}

async function runTfjsYoloDetection({
  tf,
  model,
  rgbData,
  imageWidth,
  imageHeight,
  config: configInput
}) {
  const forwardResult = await runTfjsModelForward({
    tf,
    model,
    rgbData,
    imageWidth,
    imageHeight,
    config: configInput
  });
  return postprocessTfjsYoloDetections(forwardResult);
}

async function runTfjsModelForward({
  tf,
  model,
  rgbData,
  imageWidth,
  imageHeight,
  config: configInput
}) {
  const config = normalizeLocalInferConfig(configInput);
  const startedAt = Date.now();
  const { inputTensor, inputShape, preprocessMeta } = buildInputTensorFromRgbData(
    tf,
    rgbData,
    imageWidth,
    imageHeight,
    config
  );

  let predictResult = null;
  let outputTensor = null;

  try {
    if (model.execute) {
      predictResult = model.execute(inputTensor);
    } else {
      predictResult = await model.executeAsync(inputTensor);
    }
    outputTensor = Array.isArray(predictResult) ? predictResult[0] : predictResult;
    const tensorData = await outputTensor.data();
    const outputData = typeof tensorData.slice === 'function'
      ? tensorData.slice()
      : Array.from(tensorData);
    const outputShape = outputTensor.shape ? outputTensor.shape.slice() : [];
    return {
      configSnapshot: clonePlain(config),
      inputShape,
      outputShape,
      preprocessMeta: clonePlain(preprocessMeta),
      outputData,
      boxFormat: config.boxFormat,
      expectedClassCount: EXPECTED_LOCAL_CLASS_COUNT,
      modelElapsedMs: Date.now() - startedAt
    };
  } finally {
    if (inputTensor && inputTensor.dispose) {
      inputTensor.dispose();
    }
    if (predictResult) {
      if (Array.isArray(predictResult)) {
        predictResult.forEach((item) => item && item.dispose && item.dispose());
      } else if (predictResult.dispose) {
        predictResult.dispose();
      }
    }
  }
}

function postprocessTfjsYoloDetections(forwardResult, configOverride) {
  const config = normalizeLocalInferConfig(Object.assign({}, forwardResult.configSnapshot, configOverride || {}));
  const outputShape = forwardResult.outputShape || [];
  let outputContract = null;
  try {
    outputContract = resolveModelOutputContract(outputShape, forwardResult.expectedClassCount || EXPECTED_LOCAL_CLASS_COUNT);
  } catch (error) {
    if (error && error.code === 'LOCAL_MODEL_OUTPUT_MISMATCH') {
      return {
        configSnapshot: clonePlain(config),
        inputShape: forwardResult.inputShape,
        outputShape,
        preprocessMeta: clonePlain(forwardResult.preprocessMeta),
        rawCandidateCount: 0,
        thresholdCandidateCount: 0,
        nmsCount: 0,
        detectionCount: 0,
        thresholdUsed: config.confThreshold,
        fallbackUsed: false,
        elapsedMs: forwardResult.modelElapsedMs,
        modelElapsedMs: forwardResult.modelElapsedMs,
        boxFormat: config.boxFormat,
        expectedClassCount: forwardResult.expectedClassCount || EXPECTED_LOCAL_CLASS_COUNT,
        decodeError: {
          code: error.code,
          reason: error.reason,
          expectedClassCount: error.expectedClassCount,
          actualClassChannels: error.actualClassChannels,
          outputShape: error.outputShape
        },
        detections: [],
        top5: []
      };
    }
    throw error;
  }

  const rawCandidateCount = outputContract.candidates;

  let thresholdBoxes = decodeCurrentModelOutput(forwardResult.outputData, outputShape, config);
  let thresholdUsed = config.confThreshold;
  let fallbackUsed = false;

  if (!thresholdBoxes.length && config.enableFallback) {
    fallbackUsed = true;
    thresholdUsed = config.fallbackConfThreshold;
    thresholdBoxes = decodeCurrentModelOutput(
      forwardResult.outputData,
      outputShape,
      Object.assign({}, config, { confThreshold: config.fallbackConfThreshold })
    );
  }

  const nmsBoxes = applyConfiguredNms(thresholdBoxes, config);
  const detections = mapBoxesToOriginalImage(nmsBoxes, forwardResult.preprocessMeta, config);

  return {
    configSnapshot: clonePlain(config),
    inputShape: forwardResult.inputShape,
    outputShape,
    preprocessMeta: clonePlain(forwardResult.preprocessMeta),
    rawCandidateCount,
    thresholdCandidateCount: thresholdBoxes.length,
    nmsCount: nmsBoxes.length,
    detectionCount: detections.length,
    thresholdUsed,
    fallbackUsed,
    elapsedMs: forwardResult.modelElapsedMs,
    modelElapsedMs: forwardResult.modelElapsedMs,
    boxFormat: config.boxFormat,
    expectedClassCount: forwardResult.expectedClassCount || EXPECTED_LOCAL_CLASS_COUNT,
    decodeError: null,
    detections: detections.map((item) => ({
      x1: roundNumber(item.x1, 6),
      y1: roundNumber(item.y1, 6),
      x2: roundNumber(item.x2, 6),
      y2: roundNumber(item.y2, 6),
      score: roundNumber(item.score, 6),
      classId: item.classId,
      boxFormat: item.boxFormat || config.boxFormat
    })),
    top5: summarizeDetections(detections, 5)
  };
}

module.exports = {
  DEFAULT_LOCAL_INFER_CONFIG,
  ENGLISH_CLASS_NAMES,
  EXPECTED_LOCAL_CLASS_COUNT,
  normalizeLocalInferConfig,
  compareBoxesIoU,
  buildInputTensorFromRgbData,
  decodeCurrentModelOutput,
  applyConfiguredNms,
  mapBoxesToOriginalImage,
  mapDetectionsToDisplay,
  summarizeDetections,
  runTfjsModelForward,
  postprocessTfjsYoloDetections,
  runTfjsYoloDetection
};
