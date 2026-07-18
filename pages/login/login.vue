<template>
	<view class="login-container">
		<view class="login-wrapper">
			<view class="header">
				<image class="logo" src="/static/logo.png" mode="aspectFill"></image>
				<text class="title">野生菌智慧识别</text>
				<text class="subtitle">欢迎使用</text>
			</view>
			
			<view class="login-content">
				<!-- 在线登录按钮 -->
				<button 
					class="login-btn primary" 
					@click="handleLogin" 
					:loading="isLoading"
					:disabled="!isOnline"
				>
					<text class="btn-text">{{ isLoading ? '登录中...' : '微信登录' }}</text>
				</button>
				
				<!-- 离线进入按钮（网络不可用时显示） -->
				<button 
					v-if="!isOnline" 
					class="login-btn secondary" 
					@click="enterOfflineMode"
				>
					<text class="btn-text">离线进入</text>
				</button>
				
				<!-- 网络状态提示 -->
				<view class="network-status" :class="{ 'offline': !isOnline }">
					<text class="status-text">
						{{ isOnline ? '网络正常' : '网络不可用 - 可选择离线模式' }}
					</text>
				</view>
				
				<view class="tips">
					<text class="tips-text">使用微信账号登录，快速开始识别</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { userLogin } from '@/utils/api.js'
import { BASE_URL } from '@/utils/request.js'
import { getNetworkOnline } from '@/utils/network-detector.js'
import { saveLoginSession, getCachedUser, isOfflineSessionValid } from '@/utils/auth-manager.js'

export default {
	data() {
		return {
			isLoading: false,
			isOnline: true
		}
	},
	
	async onLoad() {
		// 页面加载时检测网络状态
		this.checkNetworkStatus();
	},
	
	methods: {
		// 检测网络状态
		async checkNetworkStatus() {
			this.isOnline = await getNetworkOnline();
			console.log('登录页网络状态:', this.isOnline ? '在线' : '离线');
		},
		
		// 离线模式进入
		async enterOfflineMode() {
			try {
				const user = getCachedUser();
				
				if (user && isOfflineSessionValid()) {
					uni.showToast({ 
						title: '离线模式进入', 
						icon: 'success' 
					});
					// 进入离线缓存模式
					setTimeout(() => {
						uni.reLaunch({ url: '/pages/home/home?offline=1' });
					}, 1000);
				} else {
					// 进入离线访客模式
					uni.showToast({ 
						title: '离线访客模式（无法同步）', 
						icon: 'none',
						duration: 2000
					});
					setTimeout(() => {
						uni.reLaunch({ url: '/pages/home/home?offline=1&guest=1' });
					}, 2000);
				}
			} catch (error) {
				console.error('进入离线模式失败:', error);
				uni.showToast({ 
					title: '进入离线模式失败', 
					icon: 'none' 
				});
			}
		},
		
		async handleLogin() {
			this.isLoading = true
			try {
				// 检查网络状态
				const online = await getNetworkOnline();
				if (!online) {
					uni.showToast({
						title: '网络不可用，请检查网络连接',
						icon: 'none'
					});
					return;
				}
				
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
				console.log(' 开始微信登录...')
				
				// 1. 调用 uni.login() 获取 code
				const loginRes = await uni.login({ provider: 'weixin' })
				if (!loginRes.code) throw new Error('获取微信 code 失败')
				console.log('获取 code 成功:', loginRes.code)
				
				// 2. 调用后端登录接口（只发送 code）
				const response = await uni.request({
					url: `${BASE_URL}/api/user/login`,
					method: 'POST',
					header: { 'content-type': 'application/json' },
					data: { code: loginRes.code }
				})
				console.log('后端响应:', response)
				console.log('响应数据 data:', response.data)
				console.log('响应数据 data.data:', response.data.data)
				
				// 3. 检查响应
				if (response.statusCode !== 200) throw new Error(`HTTP ${response.statusCode}`)
				const result = response.data
				if (result.code !== 0) throw new Error(result.msg || '登录失败')
							
				// 4. 提取数据 - 兼容两种返回格式
				let token = null
				let userInfo = null
							
				if (result.data) {
					// 格式1: { code: 0, data: { token: "xxx", userInfo: {...} } }
					if (result.data.token && result.data.userInfo) {
						token = result.data.token
						userInfo = result.data.userInfo
					}
					// 格式2: { code: 0, data: { userId: 9, openid: "xxx", ... } }
					else if (result.data.userId || result.data.user_id || result.data.openid) {
						// 后端直接返回用户信息，没有 token 和 userInfo 包装
						userInfo = result.data
						// 使用 openid 作为临时 token（或者生成一个）
						token = result.data.openid || 'temp_token_' + Date.now()
					}
				}
							
				if (!userInfo) throw new Error('后端未返回用户信息')
							
				// 兼容字段名：userId / user_id
				const userId = userInfo.userId || userInfo.user_id || userInfo.openid
				if (!userId) throw new Error('后端未返回 userId')
							
				console.log('登录成功, userId:', userId)
				console.log('用户信息:', userInfo)
							
				// 5. 使用新的认证管理器保存会话
				saveLoginSession({ 
					token: token, 
					user: {
						userId: userId,
						nickname: userInfo.nickname || '微信用户',
						avatarUrl: userInfo.avatarUrl || userInfo.avatar_url || userInfo.avatar || '/static/logo.png',
						gender: userInfo.gender !== undefined ? userInfo.gender : null,
						openid: userInfo.openid
					}
				})
				
				uni.showToast({ title: '登录成功', icon: 'success' })
				setTimeout(() => uni.reLaunch({ url: '/pages/home/home' }), 1500)
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
	width: 100vw;
	height: 100vh;
	background: linear-gradient(180deg, #B8C5F2 0%, #D4DBF5 50%, #E8EBF8 100%);
	overflow: hidden;
	position: fixed;
	top: 0;
	left: 0;
}

.login-wrapper {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 0 60rpx;
	box-sizing: border-box;
}

.header {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 100rpx;
	flex-shrink: 0;
}

.logo {
	width: 180rpx;
	height: 180rpx;
	border-radius: 40rpx;
	background-color: #fff;
	margin-bottom: 40rpx;
	box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.15);
}

.title {
	font-size: 44rpx;
	font-weight: 600;
	color: #4A5568;
	margin-bottom: 16rpx;
	letter-spacing: 2rpx;
}

.subtitle {
	font-size: 26rpx;
	color: #718096;
	opacity: 0.8;
}

.login-content {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	flex-shrink: 0;
}

.login-btn {
	width: 100%;
	height: 96rpx;
	background: #87CEEB;
	border-radius: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12rpx 32rpx rgba(135, 206, 235, 0.3);
	border: none;
	transition: all 0.3s ease;
}

.login-btn::after {
	border: none;
}

.btn-text {
	font-size: 32rpx;
	color: #fff;
	font-weight: 500;
	letter-spacing: 2rpx;
}

.tips {
	margin-top: 48rpx;
}

.tips-text {
	font-size: 24rpx;
	color: #718096;
	opacity: 0.7;
}

/* 新增的离线模式样式 */
.login-btn.primary {
	background: #87CEEB;
	color: white;
	border: none;
}

.login-btn.secondary {
	background: linear-gradient(135deg, #B8C5F2 0%, #87CEEB 100%);
	color: #333;
	border: 1px solid #87CEEB;
	margin-top: 20rpx;
}

.login-btn:disabled {
	background: #cccccc;
	color: #666666;
}

.network-status {
	margin: 30rpx 0;
	padding: 20rpx;
	border-radius: 10rpx;
	text-align: center;
}

.network-status.offline {
	background: #fff3cd;
	border: 1px solid #ffeaa7;
}

.status-text {
	font-size: 28rpx;
	color: #666;
}

.network-status.offline .status-text {
	color: #856404;
}
</style>
