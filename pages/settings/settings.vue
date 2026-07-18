<template>
	<view class="settings-container">
		<!-- 顶部用户卡片 -->
		<view class="user-header">
			<image :src="userInfo.avatar || '/static/logo.png'" mode="aspectFill" class="avatar"></image>
			<view class="user-info">
				<text class="nickname">{{ userInfo.nickname || '游客' }}</text>
				<text class="user-id">ID: {{ userInfo.userId || '-' }}</text>
			</view>
			<view class="edit-btn" @click="navigateTo('/pages/user-profile/user-profile')">
				<text class="edit-text">修改信息</text>
			</view>
		</view>
		
		<!-- 内容区域 -->
		<view class="content-area">
			<!-- 功能卡片 -->
			<view class="menu-card">
				<view class="menu-item" @click="handleClearCache">
					<text class="item-icon"></text>
					<text class="item-text">清除缓存</text>
					<text class="item-arrow">›</text>
				</view>
			</view>
			
			<view class="menu-card">
				<view class="menu-item" @click="navigateTo('/pages/feedback-list/feedback-list')">
					<text class="item-icon"></text>
					<text class="item-text">反馈记录</text>
					<text class="item-arrow">›</text>
				</view>
				
				<view class="menu-item menu-item-last" @click="navigateTo('/pages/feedback-result/feedback-result')">
					<text class="item-icon"></text>
					<text class="item-text">反馈结果</text>
					<text class="item-arrow">›</text>
				</view>
			</view>
			
			<!-- 退出登录按钮 -->
			<view class="logout-container">
				<button class="logout-btn" @click="handleLogout">退出登录</button>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			userInfo: {}
		}
	},
	onShow() {
		this.loadUserInfo()
	},
	methods: {
		// 加载用户信息
		loadUserInfo() {
			const userInfo = uni.getStorageSync('userInfo')
			if (userInfo) {
				this.userInfo = userInfo
			}
		},
		
		// 清除缓存
		handleClearCache() {
			uni.showModal({
				title: '清除缓存',
				content: '确定要清除所有缓存数据吗？',
				success: (res) => {
					if (res.confirm) {
						try {
							// 清除缓存，但保留 token 和 userInfo
							const token = uni.getStorageSync('token')
							const userInfo = uni.getStorageSync('userInfo')
							
							uni.clearStorageSync()
							
							uni.setStorageSync('token', token)
							uni.setStorageSync('userInfo', userInfo)
							
							uni.showToast({
								title: '缓存已清除',
								icon: 'success'
							})
						} catch (error) {
							console.error('清除缓存失败:', error)
							uni.showToast({
								title: '清除失败',
								icon: 'none'
							})
						}
					}
				}
			})
		},
		
		// 退出登录
		handleLogout() {
			uni.showModal({
				title: '退出登录',
				content: '确定要退出登录吗？',
				success: (res) => {
					if (res.confirm) {
						// 清除登录信息
						uni.removeStorageSync('token')
						uni.removeStorageSync('userInfo')
						
						uni.showToast({
							title: '已退出登录',
							icon: 'success'
						})
						
						// 跳转到登录页
						setTimeout(() => {
							uni.reLaunch({
								url: '/pages/login/login'
							})
						}, 1500)
					}
				}
			})
		},
		
		// 页面跳转
		navigateTo(url) {
			// 使用应用的安全跳转方法
			const app = getApp()
			if (app && app.safeNavigateTo) {
				app.safeNavigateTo(url)
			} else {
				// 降级处理
				console.warn('安全跳转方法不可用，使用普通跳转')
				uni.navigateTo({ url })
			}
		}
	}
}
</script>

<style scoped>
.settings-container {
	min-height: 100vh;
	background: #F5F7FA;
}

/* 顶部用户区域 */
.user-header {
	background: linear-gradient(180deg, #B8C5F2 0%, #D4DBF5 100%);
	padding: 80rpx 30rpx 40rpx;
	display: flex;
	align-items: center;
	position: relative;
}

.avatar {
	width: 100rpx;
	height: 100rpx;
	border-radius: 50rpx;
	border: 3rpx solid rgba(255, 255, 255, 0.5);
	flex-shrink: 0;
}

.user-info {
	flex: 1;
	margin-left: 20rpx;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}

.nickname {
	font-size: 32rpx;
	font-weight: 600;
	color: #fff;
	letter-spacing: 1rpx;
}

.user-id {
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.8);
}

.edit-btn {
	padding: 0 24rpx;
	height: 64rpx;
	background: rgba(255, 255, 255, 0.25);
	border-radius: 32rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	backdrop-filter: blur(10rpx);
	flex-shrink: 0;
}

.edit-text {
	font-size: 26rpx;
	color: #fff;
	font-weight: 500;
	white-space: nowrap;
}

/* 内容区域 */
.content-area {
	background: #fff;
	border-radius: 32rpx 32rpx 0 0;
	margin-top: -20rpx;
	padding: 30rpx 30rpx 40rpx;
	min-height: calc(100vh - 240rpx);
}

/* 功能卡片 */
.menu-card {
	background: #fff;
	border-radius: 20rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 16rpx rgba(184, 197, 242, 0.08);
	overflow: hidden;
}

.menu-item {
	display: flex;
	align-items: center;
	padding: 32rpx 24rpx;
	border-bottom: 1rpx solid #F0F2F5;
	transition: background-color 0.2s;
}

.menu-item:active {
	background-color: #F8F9FA;
}

.menu-item-last {
	border-bottom: none;
}

.item-icon {
	font-size: 40rpx;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.item-text {
	flex: 1;
	font-size: 28rpx;
	color: #333;
	font-weight: 500;
}

.item-arrow {
	font-size: 40rpx;
	color: #C8CCD4;
	font-weight: 300;
}

/* 退出登录 */
.logout-container {
	margin-top: 40rpx;
}

.logout-btn {
	width: 100%;
	height: 88rpx;
	background: #fff;
	border: 2rpx solid #FF6B6B;
	border-radius: 44rpx;
	font-size: 28rpx;
	color: #FF6B6B;
	font-weight: 500;
	line-height: 88rpx;
	text-align: center;
	transition: all 0.3s;
}

.logout-btn::after {
	border: none;
}

.logout-btn:active {
	background: #FFF5F5;
}
</style>
