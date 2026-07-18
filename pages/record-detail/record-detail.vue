<template>
	<view class="container">
		<!-- 识别图片 -->
		<view class="image-section">
			<image 
				v-if="detail.imageUrl" 
				:src="detail.imageUrl" 
				mode="aspectFit" 
				class="record-image"
				@error="onImageError"
			></image>
			<view v-else class="no-image">
				<text>暂无图片</text>
			</view>
		</view>
		
		<!-- 识别结果信息 -->
		<view class="info-section">
			<view class="main-info">
				<view class="mushroom-name">{{ detail.mushroomName || '未知菌类' }}</view>
				<view :class="['poison-tag', poisonTagClass]" v-if="poisonText">{{ poisonText }}</view>
			</view>
			
			<view class="detail-info">
				<view class="info-row">
					<text class="label">置信度：</text>
					<text class="value">{{ formatConfidence(detail.confidence) }}</text>
				</view>
				<view class="info-row" v-if="detail.recognizeTime">
					<text class="label">识别时间：</text>
					<text class="value">{{ formatTime(detail.recognizeTime) }}</text>
				</view>
				<view class="info-row" v-if="detail.deviceInfo">
					<text class="label">识别设备：</text>
					<text class="value">{{ detail.deviceInfo }}</text>
				</view>
				<view class="info-row">
					<text class="label">识别方式：</text>
					<text class="value">{{ detail.inferModel === 0 ? '本地模型' : '云端推理' }}</text>
				</view>
			</view>
		</view>
		
		<!-- 反馈按钮（在菌类百科上方） -->
		<view class="feedback-section">
			<button class="feedback-btn" @click="goToFeedback">
				<text class="feedback-icon"></text>
				<text class="feedback-text">反馈识别结果</text>
			</button>
		</view>
		
		<!-- 菌类百科详情（仅当 mushroomId 有效时显示） -->
		<view class="encyclopedia-section" v-if="hasMushroomDetail">
			<text class="section-title">菌类百科</text>
			
			<view class="encyclopedia-content">
				<view class="info-row" v-if="mushroom.scientificName">
					<text class="label">学名：</text>
					<text class="value">{{ mushroom.scientificName }}</text>
				</view>
				
				<view class="info-row" v-if="mushroom.category">
					<text class="label">分类：</text>
					<text class="value">{{ mushroom.category }}</text>
				</view>
				
				<view class="description-box" v-if="mushroom.description">
					<view class="box-title">形态特征</view>
					<text class="description-text">{{ mushroom.description }}</text>
				</view>
				
				<view class="description-box" v-if="mushroom.edibleTips">
					<view class="box-title">食用建议</view>
					<text class="description-text">{{ mushroom.edibleTips }}</text>
				</view>
				
				<view class="description-box warning-box" v-if="mushroom.toxicityLevel">
					<view class="box-title">毒性等级</view>
					<text class="description-text">{{ mushroom.toxicityLevel }}</text>
				</view>
			</view>
		</view>
		
		<!-- 未知菌类提示 -->
		<view class="unknown-section" v-else-if="detail.mushroomName">
			<text class="section-title">未知菌类</text>
			<view class="unknown-content">
				<text class="unknown-text">暂无该菌类的百科信息</text>
				<text class="unknown-tips">建议咨询专业人士或上传更清晰的图片重新识别</text>
			</view>
		</view>
	</view>
</template>

<script>
import { recordDetail, mushroomDetail } from '@/utils/api.js'
import { getUserIdOrDefault } from '@/utils/auth.js'
import { BASE_URL } from '@/utils/request.js'

export default {
	data() {
		return {
			recordId: null,
			userId: getUserIdOrDefault(),
			// 识别记录详情
			detail: {
				mushroomName: '',
				confidence: 0,
				isPoisonous: 2,
				imageUrl: '',
				recognizeTime: '',
				deviceInfo: '',
				inferModel: 1
			},
			// 菌类百科详情（可能为空）
			mushroom: {
				scientificName: '',
				category: '',
				description: '',
				edibleTips: '',
				toxicityLevel: ''
			},
			poisonText: '',
			poisonTagClass: ''
		}
	},
	computed: {
		// 是否有菌类详情（mushroomId 不为 null/0）
		hasMushroomDetail() {
			const result = this.detail.mushroomId && this.detail.mushroomId > 0;
			console.log('hasMushroomDetail 计算:', {
				mushroomId: this.detail.mushroomId,
				result: result
			});
			return result;
		}
	},
	onLoad(options) {
		this.recordId = options.recordId;
		if (!this.recordId) {
			uni.showToast({ title: '缺少记录ID', icon: 'none' });
			setTimeout(() => uni.navigateBack(), 1500);
			return;
		}
		
		// 判断是本地记录还是云端记录
		const isLocalRecord = String(this.recordId).includes('_') || isNaN(Number(this.recordId));
		
		if (isLocalRecord) {
			// 本地记录：从本地缓存读取
			console.log('本地记录，从缓存加载:', this.recordId);
			this.loadLocalRecord();
		} else {
			// 云端记录：调用后端接口
			console.log('云端记录，调用接口:', this.recordId);
			this.loadRecordDetail();
		}
	},
	methods: {
		// 图片加载失败处理
		onImageError(e) {
			console.error('图片加载失败:', this.detail.imageUrl, e);
		},
		
		// 从本地缓存加载未同步的识别记录详情
		// 应用场景：用户查看本地暂存、待同步的识别记录时调用此方法
		async loadLocalRecord() {
			try {
				// 步骤 1: 构建本地存储键名，优先使用带用户 ID 的隔离存储
				// 兼容旧版本：如果新键名无数据，降级读取旧的 'records' 键
				const historyKey = `mushroom_records_${this.userId}`;
				const records = uni.getStorageSync(historyKey) || uni.getStorageSync('records') || [];
				
				// 步骤 2: 根据记录 ID（rid）查找目标记录
				// rid 是本地记录的唯一标识符，用于区分不同时间的识别结果
				const record = records.find(r => r.rid === this.recordId);
				
				// 步骤 3: 记录不存在时的错误处理
				if (!record) {
					// 提示用户并延迟返回上一页，避免停留在无效页面
					uni.showToast({ title: '本地记录不存在', icon: 'none' });
					setTimeout(() => uni.navigateBack(), 1500);
					return;
				}
				
				// 步骤 4: 数据结构适配与字段映射
				// 将本地缓存的原始记录格式转换为页面展示所需的标准结构
				this.detail = {
					recordId: null, // 本地记录无服务端 ID，置为 null
					mushroomId: record.mushroomId || 0, // 菌类业务 ID，缺失时兜底为 0
					mushroomName: record.mushroomName || record.className || '未知菌类', // 菌类名称，多字段容错
					confidence: record.confidence || (record.score ? parseFloat(record.score) : 0), // 置信度，兼容 score 字段（字符串转浮点数）
					isPoisonous: record.isPoisonous, // 毒性标识（0=无毒，1=有毒，2=未知）
					imageUrl: record.imageUrl, // 图片路径（本地临时路径或云端 URL）
					recognizeTime: record.recognizeTime || record.createTime, // 识别时间，多字段兼容
					deviceInfo: record.deviceInfo || '未知设备', // 识别设备型号，缺失时默认值
					inferModel: record.inferModel || 0 // 推理模式：0=本地推理，1=云端推理
				};
				
				// 步骤 5: 根据毒性标识设置 UI 展示信息（颜色、图标、文本）
				this.setPoisonInfo();
				console.log('本地记录加载成功:', this.detail);
				
				// 步骤 6: 加载菌类百科详情（可选增强功能）
				// 判定条件：mushroomId 存在且大于 0（非未知菌类）
				if (this.detail.mushroomId && this.detail.mushroomId > 0) {
					console.log('有 mushroomId，加载菌类百科详情:', this.detail.mushroomId);
					// 调用后端百科接口，获取菌类的详细介绍、形态特征等科普信息
					await this.loadMushroomDetail(this.detail.mushroomId);
				} else {
					// 未知菌类或无效 ID：清空百科模块，避免显示空数据
					this.mushroom = {};
					console.log('未知菌类，无百科详情');
				}
				
			} catch (error) {
				// 步骤 7: 全局异常捕获与错误处理
				// 记录详细错误日志，便于开发调试和问题排查
				console.error('加载本地记录失败:', error);
				// 用户提示 + 自动返回上一页，形成完整的错误处理闭环
				uni.showToast({ title: '加载失败', icon: 'none' });
				setTimeout(() => uni.navigateBack(), 1500);
			}
		},
		
		// 新增：加载菌类百科详情（通过 mushroomId 查询）
		async loadMushroomDetail(mushroomId) {
			try {
				console.log('开始加载菌类百科:', mushroomId);
				
				const response = await mushroomDetail({
					mushroomId: mushroomId
				});
				
				console.log('百科接口响应:', response);
				
				// 兼容响应格式
				let data = null;
				if (response.code === 0 && response.data) {
					data = response.data;
				} else if (response.mushroomId) {
					data = response;
				}
				
				if (data) {
					this.mushroom = {
						scientificName: data.latinName || data.scientificName || '',
						category: data.category || '',
						description: data.description || '',
						edibleTips: data.edibleTips || '',
						toxicityLevel: data.toxicityLevel || ''
					};
					console.log('百科详情加载成功:', this.mushroom);
					console.log('百科字段检查:', {
						scientificName: this.mushroom.scientificName,
						category: this.mushroom.category,
						description: this.mushroom.description ? `有内容(${this.mushroom.description.length}字)` : '空',
						edibleTips: this.mushroom.edibleTips ? `有内容(${this.mushroom.edibleTips.length}字)` : '空',
						toxicityLevel: this.mushroom.toxicityLevel
					});
				} else {
					console.warn('百科接口返回为空');
					this.mushroom = {};
				}
			} catch (error) {
				console.error('加载菌类百科失败:', error);
				this.mushroom = {};
			}
		},
		
		// 核心方法：通过 recordId + userId 查询详情（仅用于云端记录）
		async loadRecordDetail() {
			uni.showLoading({ title: '加载中...' });
			
			try {
				console.log('开始请求详情:', { recordId: this.recordId, userId: this.userId });
				
				const response = await recordDetail({
					recordId: this.recordId,
					userId: this.userId
				});
				
				console.log('原始响应:', response);
				
				// 兼容两种响应格式：
				// 1. { code: 0, data: {...} } - 标准格式
				// 2. { recordId: ..., mushroomId: ... } - 直接数据格式
				let data = null;
				
				if (response.code === 0 && response.data) {
					// 标准格式：{ code: 0, data: {...} }
					data = response.data;
					console.log('标准响应格式');
				} else if (response.recordId) {
					// 直接数据格式：{ recordId: ..., mushroomId: ... }
					data = response;
					console.log('直接数据响应格式');
				}
				
				if (data) {
					console.log('后端返回数据:', data);
					console.log('检查关键字段:', {
						mushroomId: data.mushroomId,
						latinName: data.latinName,
						scientificName: data.scientificName,
						category: data.category,
						description: data.description ? '存在' : '不存在',
						edibleTips: data.edibleTips ? '存在' : '不存在',
						toxicityLevel: data.toxicityLevel
					});
					
					// 1. 识别记录信息
					this.detail = {
						recordId: data.recordId,
						mushroomId: data.mushroomId,
						mushroomName: data.mushroomName || '未知菌类',
						confidence: data.confidence,
						isPoisonous: data.isPoisonous,
						imageUrl: this.normalizeImageUrl(data.imageUrl),
						recognizeTime: data.recognizeTime,
						deviceInfo: data.deviceInfo,
						inferModel: data.inferModel
					};
					
					console.log('detail 已赋值:', this.detail);
					
					// 2. 菌类百科信息（后端返回扁平化结构，需要手动映射）
					// 判断是否有有效的 mushroomId 且有百科数据
					if (data.mushroomId && data.mushroomId > 0) {
						this.mushroom = {
							scientificName: data.latinName || data.scientificName || '',
							category: data.category || '',
							description: data.description || '',
							edibleTips: data.edibleTips || '',
							toxicityLevel: data.toxicityLevel || ''
						};
						console.log('百科详情:', this.mushroom);
						console.log('百科字段检查:', {
							scientificName: this.mushroom.scientificName,
							category: this.mushroom.category,
							description: this.mushroom.description ? `有内容(${this.mushroom.description.length}字)` : '空',
							edibleTips: this.mushroom.edibleTips ? `有内容(${this.mushroom.edibleTips.length}字)` : '空',
							toxicityLevel: this.mushroom.toxicityLevel
						});
					} else {
						// 未知菌类，清空百科信息
						this.mushroom = {};
						console.log('未知菌类，无百科详情');
					}
					
					// 3. 设置毒性标签样式
					this.setPoisonInfo();
					
					console.log('详情加载成功:', this.detail);
					console.log('hasMushroomDetail:', this.hasMushroomDetail);
					
					uni.hideLoading();
					uni.showToast({ title: '加载成功', icon: 'success', duration: 1000 });
				} else {
					uni.hideLoading();
					console.error('接口返回错误:', response);
					uni.showToast({ title: response.msg || '加载失败', icon: 'none' });
					setTimeout(() => uni.navigateBack(), 1500);
				}
			} catch (error) {
				uni.hideLoading();
				console.error('加载记录详情失败:', error);
				uni.showToast({ title: '加载失败，请重试', icon: 'none' });
				setTimeout(() => uni.navigateBack(), 1500);
			}
		},
		
		// 标准化图片 URL
		normalizeImageUrl(url) {
			if (!url) return '';
			if (url.startsWith('http') || url.startsWith('https') || url.startsWith('wxfile://')) {
				return url;
			}
			return BASE_URL + url;
		},
		
		// 设置毒性标签
		setPoisonInfo() {
			switch (this.detail.isPoisonous) {
				case 0:
					this.poisonText = '可食用';
					this.poisonTagClass = 'safe';
					break;
				case 1:
					this.poisonText = '有毒';
					this.poisonTagClass = 'danger';
					break;
				case 2:
					this.poisonText = '需谨慎';
					this.poisonTagClass = 'warning';
					break;
				default:
					this.poisonText = '未知';
					this.poisonTagClass = 'unknown';
			}
		},
		
		// 格式化时间
		formatTime(timeStr) {
			if (!timeStr) return '';
			
			try {
				let d;
				
				// 处理不同的时间格式
				if (typeof timeStr === 'number') {
					// 时间戳格式
					d = new Date(timeStr);
				} else if (timeStr.includes('T')) {
					// ISO 8601 格式：2026-01-20T19:18:59
					// 直接使用 new Date() 解析，兼容性最好
					d = new Date(timeStr);
				} else {
					// 其他格式：2024-01-01 12:00:00
					// 将 - 替换为 / 以兼容 iOS
					d = new Date(timeStr.replace(/-/g, '/'));
				}
				
				// 检查日期是否有效
				if (isNaN(d.getTime())) {
					console.error('无效的时间格式:', timeStr);
					return String(timeStr);
				}
				
				const year = d.getFullYear();
				const month = (d.getMonth() + 1).toString().padStart(2, '0');
				const day = d.getDate().toString().padStart(2, '0');
				const hour = d.getHours().toString().padStart(2, '0');
				const minute = d.getMinutes().toString().padStart(2, '0');
				
				return `${year}-${month}-${day} ${hour}:${minute}`;
			} catch (error) {
				console.error('时间格式化失败:', timeStr, error);
				return String(timeStr);
			}
		},
		
		// 格式化置信度
		formatConfidence(confidence) {
			console.log('格式化置信度输入:', confidence, '类型:', typeof confidence);
			if (confidence === undefined || confidence === null) return '0%';
			if (typeof confidence === 'string' && confidence.includes('%')) return confidence;
			
			// 确保confidence是数值类型
			let numericConfidence = parseFloat(confidence);
			console.log('转换为数值:', numericConfidence);
			
			// 如果数值小于1，可能是已经被除以100了，需要乘以100
			if (numericConfidence < 1 && numericConfidence > 0) {
				console.log('检测到小数形式的百分比，转换为标准百分比');
				numericConfidence = numericConfidence * 100;
			}
			
			const result = numericConfidence.toFixed(1) + '%';
			console.log('格式化置信度输出:', result);
			return result;
		},
		
		// 跳转到反馈页面
		goToFeedback() {
			// 构建反馈页面需要的参数
			const params = {
				recordId: this.recordId || '',
				mushroomName: this.detail.mushroomName || '',
				confidence: this.detail.confidence || 0,
				imageUrl: encodeURIComponent(this.detail.imageUrl || '')
			};
			
			const query = Object.keys(params)
				.map(key => `${key}=${params[key]}`)
				.join('&');
			
			console.log('跳转到反馈页面:', params);
			
			uni.navigateTo({
				url: `/pages/feedback/feedback?${query}`
			});
		}
	}
}
</script>

<style scoped>
.container {
	padding: 30rpx;
	background: #f5f7fa;
	min-height: 100vh;
}

.image-section {
	background: #fff;
	padding: 20rpx;
	border-radius: 20rpx;
	text-align: center;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
	margin-bottom: 30rpx;
}

.record-image {
	max-width: 100%;
	max-height: 600rpx;
	border-radius: 12rpx;
}

.no-image {
	width: 100%;
	height: 400rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f5f5f5;
	border-radius: 12rpx;
	color: #999;
	font-size: 28rpx;
}

.info-section {
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
	margin-bottom: 30rpx;
}

.main-info {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 30rpx;
}

.mushroom-name {
	font-size: 40rpx;
	font-weight: bold;
	color: #333;
}

.poison-tag {
	padding: 10rpx 24rpx;
	border-radius: 30rpx;
	font-size: 28rpx;
	font-weight: bold;
}

.poison-tag.safe {
	background: #e7f7ed;
	color: #52c41a;
}

.poison-tag.danger {
	background: #fff1f0;
	color: #f5222d;
}

.poison-tag.warning {
	background: #fff7e6;
	color: #fa8c16;
}

.poison-tag.unknown {
	background: #f0f0f0;
	color: #666;
}

.detail-info {
	padding: 20rpx 0;
}

.info-row {
	display: flex;
	align-items: center;
	margin-bottom: 15rpx;
	font-size: 28rpx;
	color: #333;
}

.label {
	color: #666;
	width: 180rpx;
}

.value {
	flex: 1;
	color: #333;
}

/* 反馈按钮 */
.feedback-section {
	margin-bottom: 30rpx;
}

.feedback-btn {
	width: 100%;
	height: 90rpx;
	background: #87CEEB;
	border-radius: 45rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	color: #fff;
	font-weight: 500;
	border: none;
	box-shadow: 0 4rpx 12rpx rgba(135, 206, 235, 0.3);
}

.feedback-btn::after {
	border: none;
}

.feedback-icon {
	font-size: 36rpx;
	margin-right: 10rpx;
}

.feedback-text {
	font-size: 30rpx;
}

/* 菌类百科详情 */
.encyclopedia-section {
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 20rpx;
	border-bottom: 2rpx solid #f0f0f0;
	padding-bottom: 10rpx;
}

.encyclopedia-content {
	margin-top: 20rpx;
}

.description-box {
	background: #fafafa;
	border-radius: 12rpx;
	padding: 20rpx;
	margin-bottom: 20rpx;
}

.description-box.warning-box {
	background: #fff7e6;
	border: 1rpx solid #ffa940;
}

.box-title {
	font-size: 28rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 10rpx;
}

.description-text {
	font-size: 26rpx;
	color: #666;
	line-height: 1.8;
	display: block;
}

/* 未知菌类提示 */
.unknown-section {
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.unknown-content {
	text-align: center;
	padding: 40rpx 20rpx;
	background: #f5f5f5;
	border-radius: 12rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.unknown-text {
	font-size: 30rpx;
	color: #666;
	margin-bottom: 20rpx;
}

.unknown-tips {
	font-size: 24rpx;
	color: #999;
	line-height: 1.6;
	max-width: 500rpx;
}
</style>