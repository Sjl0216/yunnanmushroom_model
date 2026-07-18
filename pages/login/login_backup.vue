<template>
	<view class="login-container">
		<view class="header">
			<image class="logo" src="/static/logo.png" mode="aspectFit"></image>
			<text class="title">野生菌智慧识别</text>
			<text class="subtitle">一键识别 安全食用</text>
		</view>
		
		<view class="login-content">
			<button class="login-btn" type="primary" @click="handleLogin" :loading="isLoading">
				<text class="btn-text">微信一键登录</text>
			</button>
			<view class="tips">
				<text class="tips-text">登录即代表同意用户协议和隐私政策</text>
			</view>
		</view>
	</view>
</template>

<script>
import { userLogin } from '@/utils/api.js'

export default {
	data() {
		return {
			isLoading: false
		}
	},
	onLoad() {
		// 检查是否已登录
		const token = uni.getStorageSync('token')
		if (token) {
			// 已登录，直接跳转首页
			uni.switchTab({
				url: '/pages/home/home'
			})
		}
	},
	methods: {
		async handleLogin() {
			this.isLoading = true
			try {
				// ===== 测试模式切换 =====
				// 开发阶段建议使用模拟登录，避免 AppID 配置问题
				// 等后端接口完成后再切换为真实登录
				
				// 【当前模式：真实微信登录】
				// 如果需要切换回模拟登录，请：
				// 1. 注释下面的 await this.wechatLogin()
				// 2. 取消注释 await this.mockLogin()
				
				await this.wechatLogin()  // 真实微信登录
				// await this.mockLogin()  // 模拟登录（开发用）
				
			} catch (error) {
				console.error('登录失败:', error)
				uni.showToast({
					title: error.message || '登录失败，请重试',
					icon: 'none'
				})
			} finally {
				this.isLoading = false
			}
		},
		
		// 微信真实登录
		async wechatLogin() {
			try {
				// 1. 调用 uni.login() 获取 code
				const loginRes = await uni.login({
					provider: 'weixin'
				})
				
				if (!loginRes.code) {
					throw new Error('获取微信 code 失败')
				}
				
				console.log('微信 code:', loginRes.code)
				
				// 2. 将 code 发送到后端换取 token
				const res = await userLogin(loginRes.code)
				
				// 3. 保存 token 和用户信息
				uni.setStorageSync('token', res.token)
				uni.setStorageSync('userInfo', res.userInfo || {})
				
				uni.showToast({
					title: '登录成功',
					icon: 'success'
				})
				
				// 4. 跳转到首页
				setTimeout(() => {
					uni.reLaunch({
						url: '/pages/home/home'
					})
				}, 1500)
				
			} catch (error) {
				console.error('微信登录失败:', error)
				throw error
			}
		},
		
		// 模拟登录（开发环境使用）
		async mockLogin() {
			try {
				console.log('开发环境：使用模拟登录')
				
				// 模拟请求后端登录接口
				// 这里使用一个模拟的 code
				const mockCode = 'mock_code_' + Date.now()
				
				// TODO: 后端接口完成后可以调用真实接口
				// const res = await userLogin(mockCode)
				
				// 暂时模拟返回数据
				const mockResponse = {
					token: 'mock_token_' + Date.now(),
					userInfo: {
						userId: 'mock_user_001',
						nickname: '测试用户',
						avatar: '/static/logo.png'
					}
				}
				
				// 保存模拟数据
				uni.setStorageSync('token', mockResponse.token)
				uni.setStorageSync('userInfo', mockResponse.userInfo)
				
				uni.showToast({
					title: '登录成功（开发模式）',
					icon: 'success',
					duration: 1500
				})
				
				// 跳转到首页
				setTimeout(() => {
					uni.switchTab({
						url: '/pages/home/home'
					})
				}, 1500)
				
			} catch (error) {
				console.error('模拟登录失败:', error)
				throw error
			}
		}
	}
}
</script>

<style scoped>
.login-container {
	min-height: 100vh;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: space-between;
	padding: 100rpx 60rpx 120rpx;
}

.header {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-top: 100rpx;
}

.logo {
	width: 200rpx;
	height: 200rpx;
	border-radius: 40rpx;
	background-color: #fff;
	margin-bottom: 40rpx;
}

.title {
	font-size: 48rpx;
	font-weight: bold;
	color: #fff;
	margin-bottom: 20rpx;
}

.subtitle {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.8);
}

.login-content {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.login-btn {
	width: 100%;
	height: 90rpx;
	background: #fff;
	border-radius: 45rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.1);
}

.btn-text {
	font-size: 32rpx;
	color: #667eea;
	font-weight: 500;
}

.tips {
	margin-top: 40rpx;
}

.tips-text {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.7);
}
</style>
