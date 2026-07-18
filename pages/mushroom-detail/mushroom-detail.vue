<template>
	<view class="container">
		<!-- 顶部图片显示区域 -->
		<view class="image-section" v-if="mushroom.standardImageUrl">
			<image :src="mushroom.standardImageUrl" mode="aspectFill" class="mushroom-img" @error="onImageError"></image>
		</view>

		<!-- 加载中 -->
		<view v-if="isLoading" class="loading-section">
			<text class="loading-text">加载中...</text>
		</view>

		<!-- 内容区域 -->
		<view v-else class="content">
			<!-- 名称和毒性标签 -->
			<view class="main-header">
				<view class="mushroom-name">{{ mushroom.chineseName || '加载中...' }}</view>
				<view :class="['poison-tag', poisonTagClass]" v-if="poisonText">{{ poisonText }}</view>
			</view>

			<!-- 详细介绍 -->
			<view class="info-section" v-if="mushroom.description">
				<text class="section-title"> 详细介绍</text>
				<text class="description">{{ mushroom.description }}</text>
			</view>
			
			<!-- 基本信息 -->
			<view class="info-section">
				<text class="section-title">基本信息</text>
				<view class="basic-info">
					<view class="info-item" v-if="mushroom.latinName">
						<text class="label">学名：</text>
						<text class="value">{{ mushroom.latinName }}</text>
					</view>
					<view class="info-item" v-if="mushroom.category">
						<text class="label">类别：</text>
						<text class="value">{{ mushroom.category }}</text>
					</view>
					<view class="info-item">
						<text class="label">毒性：</text>
						<text class="value" :class="poisonValueClass">{{ poisonText }}</text>
					</view>
				</view>
			</view>
			
			<!-- 食用建议 -->
			<view class="info-section" v-if="mushroom.edibleTips">
				<text class="section-title"> 食用建议</text>
				<view class="tips-box">
					<text class="tips-text">{{ mushroom.edibleTips }}</text>
				</view>
			</view>
			
			<!-- 毒性警告 -->
			<view class="info-section warning-section" v-if="mushroom.toxicityLevel">
				<text class="section-title">毒性警告</text>
				<view class="warning-box">
					<text class="warning-text">{{ mushroom.toxicityLevel }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { mushroomDetail } from '@/utils/api.js'
import { BASE_URL } from '@/utils/request.js'

export default {
	data() {
		return {
			mushroomId: null,
			mushroom: {},
			poisonText: '',
			poisonTagClass: '',
			poisonValueClass: '',
			isLoading: false
		}
	},
	onLoad(options) {
		this.mushroomId = options.mushroomId;
		
		if (!this.mushroomId) {
			uni.showToast({ title: '缺少菌类ID', icon: 'none' });
			setTimeout(() => uni.navigateBack(), 1500);
			return;
		}
		
		console.log('加载菌类详情, mushroomId:', this.mushroomId);
		this.loadMushroomDetail();
	},
	methods: {
		// 图片加载失败处理
		onImageError(e) {
			console.error('图片加载失败:', this.mushroom.standardImageUrl, e);
		},
		
		// 核心方法：从后端加载菌类详情
		async loadMushroomDetail() {
			this.isLoading = true;
			uni.showLoading({ title: '加载中...' });
			
			try {
				console.log('开始请求菌类详情, mushroomId:', this.mushroomId);
				
				const response = await mushroomDetail({
					mushroomId: this.mushroomId
				});
				
				console.log('原始响应:', response);
				
				// 兼容两种响应格式
				let data = null;
				
				if (response.code === 0 && response.data) {
					// 标准格式: { code: 0, data: {...} }
					data = response.data;
					console.log('标准响应格式');
				} else if (response.mushroomId) {
					// 直接数据格式: { mushroomId: ..., ... }
					data = response;
					console.log('直接数据响应格式');
				} else {
					throw new Error('接口返回数据格式错误');
				}
				
				if (!data) {
					throw new Error('未找到菌类信息');
				}
				
				// 处理数据
				this.mushroom = {
					mushroomId: data.mushroomId,
					chineseName: data.chineseName || '未知菌类',
					latinName: data.latinName || '',
					category: data.category || '',
					description: data.description || '',
					edibleTips: data.edibleTips || '',
					toxicityLevel: data.toxicityLevel || '',
					isPoisonous: data.isPoisonous,
					standardImageUrl: data.standardImageUrl || ''
				};
				
				// 处理图片 URL
				if (this.mushroom.standardImageUrl && !this.mushroom.standardImageUrl.startsWith('http')) {
					this.mushroom.standardImageUrl = BASE_URL + this.mushroom.standardImageUrl;
				}
				
				// 设置毒性信息
				this.setPoisonInfo();
				
				console.log('菌类详情加载成功:', this.mushroom);
				
			} catch (error) {
				console.error('加载菌类详情失败:', error);
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				});
				setTimeout(() => uni.navigateBack(), 1500);
			} finally {
				this.isLoading = false;
				uni.hideLoading();
			}
		},
		
		// 设置毒性信息
		setPoisonInfo() {
			switch (this.mushroom.isPoisonous) {
				case 0:
					this.poisonText = '无毒可食用';
					this.poisonTagClass = 'safe';
					this.poisonValueClass = 'safe-text';
					break;
				case 1:
					this.poisonText = '有毒不可食用';
					this.poisonTagClass = 'danger';
					this.poisonValueClass = 'danger-text';
					break;
				case 2:
					this.poisonText = '需谨慎';
					this.poisonTagClass = 'warning';
					this.poisonValueClass = 'warning-text';
					break;
				default:
					this.poisonText = '未知';
					this.poisonTagClass = 'unknown';
					this.poisonValueClass = 'unknown-text';
			}
		}
	}
}
</script>

<style scoped>
.container {
	min-height: 100vh;
	background: #f5f7fa;
}

.image-section {
	width: 100%;
	height: 400rpx;
	overflow: hidden;
	background: #fff;
}

.mushroom-img {
	width: 100%;
	height: 100%;
}

.loading-section {
	padding: 80rpx 0;
	text-align: center;
}

.loading-text {
	font-size: 28rpx;
	color: #999;
}

.content {
	padding: 30rpx;
}

.main-header {
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx 30rpx;
	margin-bottom: 20rpx;
	text-align: center;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.mushroom-name {
	font-size: 44rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 20rpx;
}

.poison-tag {
	display: inline-block;
	padding: 10rpx 30rpx;
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

.info-section {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.section-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 20rpx;
	padding-bottom: 15rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.description {
	font-size: 28rpx;
	line-height: 1.8;
	color: #666;
	text-align: justify;
	display: block;
}

.basic-info {
	padding: 10rpx 0;
}

.info-item {
	display: flex;
	align-items: flex-start;
	margin-bottom: 20rpx;
	font-size: 28rpx;
}

.info-item:last-child {
	margin-bottom: 0;
}

.label {
	color: #999;
	width: 140rpx;
	flex-shrink: 0;
}

.value {
	flex: 1;
	color: #333;
	word-break: break-all;
}

.safe-text {
	color: #52c41a;
	font-weight: bold;
}

.danger-text {
	color: #f5222d;
	font-weight: bold;
}

.warning-text {
	color: #fa8c16;
	font-weight: bold;
}

.unknown-text {
	color: #999;
}

.tips-box {
	background: #f0f9ff;
	border-left: 4rpx solid #1890ff;
	padding: 20rpx;
	border-radius: 8rpx;
}

.tips-text {
	font-size: 28rpx;
	line-height: 1.8;
	color: #666;
	display: block;
}

.warning-section {
	background: #fff7e6;
	border: 2rpx solid #ffa940;
}

.warning-box {
	background: #fff1f0;
	border-left: 4rpx solid #f5222d;
	padding: 20rpx;
	border-radius: 8rpx;
}

.warning-text {
	font-size: 28rpx;
	line-height: 1.8;
	color: #d4380d;
	display: block;
	font-weight: 500;
}
</style>