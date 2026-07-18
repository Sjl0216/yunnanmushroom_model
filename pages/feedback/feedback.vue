<template>
	<view class="feedback-container">
		<view class="header">
			<text class="title">提交反馈</text>
			<text class="subtitle">帮助我们改进识别准确度</text>
		</view>
		
		<!-- 识别结果预览 -->
		<view class="result-preview" v-if="recordInfo.mushroomName">
			<image :src="recordInfo.imageUrl" mode="aspectFill" class="preview-image" @error="onImageError"></image>
			<view class="preview-info">
				<text class="preview-name">识别结果：{{ recordInfo.mushroomName }}</text>
				<text class="preview-confidence">可信度：{{ formatConfidence(recordInfo.confidence) }}</text>
			</view>
		</view>
		
		<!-- 反馈类型 -->
		<view class="feedback-card">
			<view class="card-title">反馈类型</view>
			<view class="type-options">
				<view 
					class="type-item" 
					:class="{ active: type === 1 }"
					@click="type = 1"
				>
					<text class="type-icon"></text>
					<text class="type-text">识别错误</text>
				</view>
				<view 
					class="type-item" 
					:class="{ active: type === 2 }"
					@click="type = 2"
				>
					<text class="type-icon"></text>
					<text class="type-text">图片问题</text>
				</view>
				<view 
					class="type-item" 
					:class="{ active: type === 3 }"
					@click="type = 3"
				>
					<text class="type-text">Bug报告</text>
				</view>
				<view 
					class="type-item" 
					:class="{ active: type === 4 }"
					@click="type = 4"
				>
					<text class="type-icon"></text>
					<text class="type-text">其他问题</text>
				</view>
			</view>
		</view>
		
		<!-- 详细描述 -->
		<view class="feedback-card">
			<view class="card-title">详细描述 <text class="required">*</text></view>
			<textarea 
				class="textarea-field" 
				v-model="content"
				placeholder="请详细描述您的反馈内容"
				placeholder-class="textarea-placeholder"
				maxlength="500"
				:show-count="true"
			></textarea>
		</view>
		
		<!-- 提交按钮 -->
		<view class="submit-section">
			<button 
				class="submit-btn" 
				type="primary"
				@click="handleSubmit"
				:disabled="!canSubmit"
				:loading="isSubmitting"
			>
				{{ isSubmitting ? '提交中...' : '提交反馈' }}
			</button>
			<view class="tips">
				<text class="tips-text">感谢您的反馈，我们会认真处理每一条建议。您可以在“我的”页面查看反馈回复。</text>
			</view>
		</view>
	</view>
</template>

<script>
import { getUserIdOrDefault } from '@/utils/auth.js'
import { BASE_URL } from '@/utils/request.js'
import { feedbackSubmit } from '@/utils/api.js'

export default {
	data() {
		return {
			userId: getUserIdOrDefault(),
			recordId: '',
			recordInfo: {
				mushroomName: '',
				confidence: 0,
				imageUrl: ''
			},
			type: null, // 1=识别错误, 2=功能建议, 3=Bug报告, 4=其他问题
			content: '', // 反馈内容（必填）
			imageUrl: '', // 反馈图片 URL（可选）
			isSubmitting: false
		}
	},
	computed: {
		canSubmit() {
			// type 和 content 必填
			return this.type !== null && this.content.trim().length > 0;
		}
	},
	onLoad(options) {
		console.log(' 反馈页面 onLoad:', options);
		
		if (options.recordId) {
			this.recordId = options.recordId;
		}
		
		// 加载识别结果预览信息
		if (options.mushroomName) {
			this.recordInfo.mushroomName = decodeURIComponent(options.mushroomName);
		}
		if (options.confidence) {
			this.recordInfo.confidence = parseFloat(options.confidence);
		}
		if (options.imageUrl) {
			this.recordInfo.imageUrl = decodeURIComponent(options.imageUrl);
		}
		
		console.log('识别记录信息:', this.recordInfo);
	},
	methods: {
		// 格式化置信度
		formatConfidence(confidence) {
			if (confidence === undefined || confidence === null) return '0%';
			if (typeof confidence === 'string' && confidence.includes('%')) return confidence;
			
			// 确保confidence是数值类型
			let numericConfidence = parseFloat(confidence);
			
			// 如果数值小于1，可能是已经被除以100了，需要乘以100
			if (numericConfidence < 1 && numericConfidence > 0) {
				numericConfidence = numericConfidence * 100;
			}
			
			return numericConfidence.toFixed(1) + '%';
		},
		
		// 图片加载失败
		onImageError(e) {
			console.error('图片加载失败:', this.recordInfo.imageUrl, e);
		},
		
		// 提交反馈
		async handleSubmit() {
			if (!this.canSubmit) {
				uni.showToast({
					title: '请填写反馈类型和内容',
					icon: 'none'
				});
				return;
			}
			
			this.isSubmitting = true;
			uni.showLoading({ title: '提交中...' });
			
			try {
				// 构建 FeedbackSubmitDTO
				const payload = {
					userId: this.userId,
					recordId: this.recordId ? Number(this.recordId) : null, // 识别记录ID
					feedbackType: this.type, // 反馈类型：1=识别错误, 2=图片问题, 3=系统问题, 4=其他
					content: this.content.trim(), // 反馈内容
					imageUrl: this.imageUrl || this.recordInfo.imageUrl || null // 优先用户上传，否则用识别图片
				};
				
				console.log('提交反馈数据:', payload);
				
				const response = await feedbackSubmit(payload);
				
				console.log('后端原始响应:', response);
				
				// 判断响应结果（兼容两种格式）
				let feedbackId = null;
				let isSuccess = false;
				
				if (response.code === 0 && response.data) {
					// 标准 Result 包装格式: { code: 0, data: { feedbackId: 11 } }
					feedbackId = response.data.feedbackId;
					isSuccess = true;
					console.log('标准格式响应，反馈提交成功, feedbackId:', feedbackId);
				} else if (response.feedbackId) {
					// 直接返回数据格式: { feedbackId: 11 }
					feedbackId = response.feedbackId;
					isSuccess = true;
					console.log('直接数据响应，反馈提交成功, feedbackId:', feedbackId);
				}
				
				if (isSuccess) {
					uni.hideLoading();
					uni.showToast({
						title: '提交成功',
						icon: 'success',
						duration: 1500
					});
					
					setTimeout(() => {
						uni.navigateBack();
					}, 1500);
				} else {
					uni.hideLoading();
					uni.showToast({
						title: response.msg || '提交失败',
						icon: 'none'
					});
				}
				
			} catch (error) {
				console.error('提交反馈失败:', error);
				uni.hideLoading();
				uni.showToast({
					title: '提交失败，请重试',
					icon: 'none'
				});
			} finally {
				this.isSubmitting = false;
			}
		}
	}
}
</script>

<style scoped>
.feedback-container {
	min-height: 100vh;
	background: #f5f7fa;
	padding-bottom: 40rpx;
}

.header {
	background: #fff;
	padding: 40rpx 30rpx;
	text-align: center;
	margin-bottom: 30rpx;
}

.title {
	display: block;
	font-size: 40rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 12rpx;
}

.subtitle {
	display: block;
	font-size: 26rpx;
	color: #999;
}

.result-preview {
	background: #fff;
	margin: 0 30rpx 30rpx;
	border-radius: 20rpx;
	padding: 20rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.preview-image {
	width: 120rpx;
	height: 120rpx;
	border-radius: 12rpx;
	margin-right: 20rpx;
}

.preview-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.preview-name {
	font-size: 30rpx;
	font-weight: 500;
	color: #333;
}

.preview-confidence {
	font-size: 26rpx;
	color: #999;
}

.feedback-card {
	background: #fff;
	margin: 0 30rpx 30rpx;
	border-radius: 20rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
}

.card-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 24rpx;
}

.card-title .required {
	color: #f5222d;
	margin-left: 4rpx;
}

.type-options {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 20rpx;
}

.type-item {
	height: 120rpx;
	border: 2rpx solid #e0e0e0;
	border-radius: 16rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	transition: all 0.3s;
}

.type-item.active {
	border-color: #87CEEB;
	background: rgba(135, 206, 235, 0.15);
}

.type-icon {
	font-size: 40rpx;
	margin-bottom: 8rpx;
}

.type-text {
	font-size: 26rpx;
	color: #666;
}

.type-item.active .type-text {
	color: #87CEEB;
	font-weight: 500;
}

.input-field {
	width: 100%;
	height: 80rpx;
	background: #f5f7fa;
	border-radius: 12rpx;
	padding: 0 24rpx;
	font-size: 28rpx;
	color: #333;
}

.input-placeholder {
	color: #ccc;
}

.textarea-field {
	width: 100%;
	min-height: 200rpx;
	background: #f5f7fa;
	border-radius: 12rpx;
	padding: 24rpx;
	font-size: 28rpx;
	color: #333;
	line-height: 1.6;
}

.textarea-placeholder {
	color: #ccc;
}

.submit-section {
	padding: 0 30rpx;
}

.submit-btn {
	width: 100%;
	height: 90rpx;
	background: #87CEEB;
	border-radius: 45rpx;
	font-size: 32rpx;
	color: #fff;
	font-weight: 500;
	border: none;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 12rpx rgba(135, 206, 235, 0.3);
}

.submit-btn[disabled] {
	background: #e0e0e0;
	color: #999;
}

.tips {
	text-align: center;
}

.tips-text {
	font-size: 24rpx;
	color: #999;
}
</style>
