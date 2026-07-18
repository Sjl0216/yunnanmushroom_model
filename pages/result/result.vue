<template>
	<view class="result-container">
		<!-- 上半部分：检测图片 -->
		<view class="image-section">
			<view class="image-header">
				<text class="section-title">检测图片</text>
			</view>
			<view class="image-wrapper">
				<image 
					:src="mushroomImage" 
					mode="aspectFit" 
					class="detect-image"
					@error="onImageError"
					@load="onImageLoad"
				></image>
				<view class="image-placeholder" v-if="!mushroomImage || imageLoadError">
					<text class="placeholder-text">暂无图片</text>
				</view>
			</view>
		</view>
		
		<!-- 下半部分：识别结果 -->
		<view class="result-section">
			<view class="section-header">
				<text class="section-title">识别结果</text>
			</view>
			
			<!-- 主要识别信息 -->
			<view class="main-result-card">
				<view class="result-header">
					<text class="mushroom-name">{{ mushroomName || '识别中...' }}</text>
					<view class="confidence-tag" :class="confidenceLevel">
						<text class="confidence-text">{{ confidence }}%</text>
					</view>
				</view>
				
				<!-- 安全提示 -->
				<view class="safety-alert" :class="{ 'danger': poisonous, 'safe': !poisonous }">
					<text class="alert-icon" :class="{ 'danger-icon': poisonous, 'safe-icon': !poisonous }"></text>
					<text class="alert-text">{{ poisonous ? '该菌类有毒，请勿食用！' : '该菌类可以安全食用' }}</text>
				</view>
			</view>
			
			<!-- 详细信息 -->
			<view class="detail-card">
				<view class="card-title">详细信息</view>
				<view class="info-item">
					<text class="info-label">学名：</text>
					<text class="info-value">{{ scientificName || '-' }}</text>
				</view>
				<view class="info-item">
					<text class="info-label">别名：</text>
					<text class="info-value">{{ alias || '-' }}</text>
				</view>
				<view class="info-item">
					<text class="info-label">识别时间：</text>
					<text class="info-value">{{ recognizeTime }}</text>
				</view>
			</view>
			
			<!-- 操作按钮 -->
			<view class="action-section">
				<button class="action-btn primary-btn" @click="viewDetail">
					<text class="btn-text">查看科普详情</text>
				</button>
				<button class="action-btn secondary-btn" @click="submitFeedback">
					<text class="btn-text">反馈识别结果</text>
				</button>
				<button class="action-btn outline-btn" @click="backToHome">
					<text class="btn-text">返回首页</text>
				</button>
			</view>
		</view>
	</view>
</template>

<script>
import { recordDetail } from '@/utils/api.js'
import { BASE_URL } from '@/utils/request.js'

export default {
	data() {
		return {
			recordId: '',
			mushroomId: '',
			mushroomName: '',
			scientificName: '',
			alias: '',
			confidence: 0,
			poisonous: false,
			mushroomImage: '',
			recognizeTime: '',
			imageLoadError: false,
			// 备用图片URL列表
			backupImages: [
				'https://picsum.photos/400/400?random=1',
				'https://picsum.photos/400/400?random=2',
				'https://picsum.photos/400/400?random=3'
			],
			currentImageIndex: 0
		}
	},
	computed: {
		confidenceLevel() {
			if (this.confidence >= 80) return 'high'
			if (this.confidence >= 60) return 'medium'
			return 'low'
		}
	},
	onLoad(options) {
		console.log('页面加载参数:', options)
		if (options.recordId) {
			this.recordId = options.recordId
			this.loadRecordDetail()
		} else {
			// 如果没有recordId，直接加载模拟数据用于测试
			console.log('无recordId参数，加载测试数据')
			this.loadRecordDetail()
		}
	},
	methods: {
		async loadRecordDetail() {
			try {
				console.log('加载识别记录:', this.recordId)
				
				if (!this.recordId) {
					// 无recordId时使用模拟数据进行测试
					console.log('无recordId，使用测试数据')
					this.mushroomName = '见手青'
					this.scientificName = 'Boletus edulis'
					this.alias = '牛肝菌、白牛肝菌'
					this.confidence = 97.35
					this.poisonous = true
					this.mushroomImage = 'https://picsum.photos/400/400?random=1'
					this.recognizeTime = new Date().toLocaleString('zh-CN')
					this.imageLoadError = false
					return
				}
				
				// 有recordId时调用真实API
				uni.showLoading({ title: '加载中...' })
				
				const response = await recordDetail({
					recordId: this.recordId
				})
				
				console.log('API响应:', response)
				
				// 处理响应数据
				let data = null
				if (response.code === 0 && response.data) {
					data = response.data
				} else if (response.recordId) {
					data = response
				}
				
				if (data) {
					this.mushroomName = data.mushroomName || '未知菌类'
					this.scientificName = data.scientificName || ''
					this.alias = data.alias || ''
					this.confidence = data.confidence || 0
					this.poisonous = data.isPoisonous === 1
					// 处理图片URL
					this.mushroomImage = this.normalizeImageUrl(data.imageUrl)
					this.recognizeTime = data.recognizeTime || data.createTime || new Date().toLocaleString('zh-CN')
					this.mushroomId = data.mushroomId || ''
					this.imageLoadError = false
					
					console.log('数据加载成功:', {
						name: this.mushroomName,
						image: this.mushroomImage,
						confidence: this.confidence
					})
					
					uni.hideLoading()
					uni.showToast({ title: '加载成功', icon: 'success', duration: 1000 })
				} else {
					throw new Error('数据格式错误')
				}
				
			} catch (error) {
				console.error('加载详情失败:', error)
				uni.hideLoading()
				uni.showToast({
					title: '加载失败: ' + (error.message || '未知错误'),
					icon: 'none'
				})
				
				// 失败时使用模拟数据
				this.mushroomName = '加载失败'
				this.scientificName = ''
				this.alias = ''
				this.confidence = 0
				this.poisonous = false
				this.mushroomImage = ''
				this.recognizeTime = new Date().toLocaleString('zh-CN')
				this.imageLoadError = true
			}
		},
		
		// 图片加载错误处理
		onImageError(e) {
			this.imageLoadError = true
			console.error('图片加载失败:', e)
			console.log('当前图片URL:', this.mushroomImage)
			
			// 尝试切换到备用图片
			if (this.currentImageIndex < this.backupImages.length - 1) {
				this.currentImageIndex++
				this.mushroomImage = this.backupImages[this.currentImageIndex]
				this.imageLoadError = false
				console.log('切换到备用图片:', this.mushroomImage)
			} else {
				uni.showToast({
					title: '图片加载失败',
					icon: 'none'
				})
			}
		},
		
		// 图片加载成功处理
		onImageLoad() {
			this.imageLoadError = false
			console.log('图片加载成功')
		},
		
		// 标准化图片URL（参考record-detail页面）
		normalizeImageUrl(url) {
			if (!url) return ''
			// 如果已经是完整URL或微信本地文件路径，直接返回
			if (url.startsWith('http') || url.startsWith('https') || url.startsWith('wxfile://')) {
				return url
			}
			// 否则拼接基础URL
			return BASE_URL + url
		},
		
		// 查看科普详情
		viewDetail() {
			if (!this.mushroomId) {
				uni.showToast({
					title: '暂无详情信息',
					icon: 'none'
				})
				return
			}
			uni.navigateTo({
				url: `/pages/mushroom-detail/mushroom-detail?mushroomId=${this.mushroomId}`
			})
		},
		
		// 提交反馈
		submitFeedback() {
			if (!this.recordId) {
				uni.showToast({
					title: '无法提交反馈',
					icon: 'none'
				})
				return
			}
			uni.navigateTo({
				url: `/pages/feedback/feedback?recordId=${this.recordId}`
			})
		},
		
		// 返回首页
		backToHome() {
			uni.switchTab({
				url: '/pages/home/home'
			})
		}
	}
}
</script>

<style scoped>
.result-container {
	min-height: 100vh;
	background: #f8f9fa;
	display: flex;
	flex-direction: column;
}

/* 上半部分：图片区域 */
.image-section {
	background: #fff;
	padding: 30rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.image-header {
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
	width: 100%;
	height: 400rpx;
	background: #f5f7fa;
	border-radius: 16rpx;
	overflow: hidden;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.detect-image {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.image-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%);
	border: 2rpx dashed #cbd5e0;
	border-radius: 16rpx;
}

.placeholder-text {
	font-size: 28rpx;
	color: #718096;
	text-align: center;
}

.placeholder-text::before {
	content: '📷 ';
	display: block;
	font-size: 48rpx;
	margin-bottom: 16rpx;
}

/* 下半部分：结果区域 */
.result-section {
	flex: 1;
	padding: 30rpx;
	padding-top: 20rpx;
}

.section-header {
	margin-bottom: 30rpx;
}

/* 主要结果卡片 */
.main-result-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.result-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 25rpx;
}

.mushroom-name {
	font-size: 36rpx;
	font-weight: 600;
	color: #333;
}

.confidence-tag {
	padding: 8rpx 24rpx;
	border-radius: 20rpx;
	font-size: 26rpx;
	font-weight: 500;
}

.confidence-tag.high {
	background: #e8f5e9;
	color: #4caf50;
}

.confidence-tag.medium {
	background: #fff3e0;
	color: #ff9800;
}

.confidence-tag.low {
	background: #ffebee;
	color: #f44336;
}

.safety-alert {
	padding: 20rpx;
	border-radius: 12rpx;
	display: flex;
	align-items: center;
}

.safety-alert.danger {
	background: #ffebee;
	border-left: 4rpx solid #f44336;
}

.safety-alert.safe {
	background: #e8f5e9;
	border-left: 4rpx solid #4caf50;
}

.alert-icon {
	font-size: 32rpx;
	margin-right: 12rpx;
}

.alert-icon.danger-icon {
	color: #f44336;
}

.alert-icon.safe-icon {
	color: #4caf50;
}

.alert-text {
	font-size: 28rpx;
	font-weight: 500;
}

.safety-alert.danger .alert-text {
	color: #f44336;
}

.safety-alert.safe .alert-text {
	color: #4caf50;
}

/* 详细信息卡片 */
.detail-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.card-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #333;
	margin-bottom: 25rpx;
	padding-bottom: 15rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.info-item {
	display: flex;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #f5f5f5;
}

.info-item:last-child {
	border-bottom: none;
}

.info-label {
	font-size: 28rpx;
	color: #666;
	width: 140rpx;
	flex-shrink: 0;
}

.info-value {
	font-size: 28rpx;
	color: #333;
	flex: 1;
}

/* 操作按钮区域 */
.action-section {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.action-btn {
	width: 100%;
	height: 88rpx;
	border-radius: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	font-weight: 500;
	margin-bottom: 20rpx;
	border: none;
}

.action-btn:last-child {
	margin-bottom: 0;
}

.primary-btn {
	background: #87CEEB;
	color: #fff;
	box-shadow: 0 8rpx 24rpx rgba(135, 206, 235, 0.3);
}

.secondary-btn {
	background: #5BADE2;
	color: #fff;
	box-shadow: 0 8rpx 24rpx rgba(91, 173, 226, 0.3);
}

.outline-btn {
	background: #fff;
	border: 2rpx solid #87CEEB;
	color: #87CEEB;
}

.btn-text {
	font-size: 30rpx;
}
</style>
