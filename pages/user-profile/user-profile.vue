<template>
	<view class="profile-container">
		<!-- 头像区域 -->
		<view class="avatar-section">
			<view class="avatar-card" @click="chooseAvatar">
				<image :src="userProfile.avatar || '/static/logo.png'" mode="aspectFill" class="avatar-large"></image>
				<view class="avatar-mask">
					<text class="camera-icon"></text>
					<text class="change-text">更换头像</text>
				</view>
			</view>
		</view>
		
		<!-- 信息列表 -->
		<view class="info-section">
			<!-- 昵称 -->
			<view class="info-item" @click="showNicknameModal">
				<view class="item-left">
					<text class="item-label">昵称</text>
					<text class="item-value">{{ userProfile.nickname || '未设置' }}</text>
				</view>
				<text class="item-arrow">›</text>
			</view>
			
			<!-- 性别 -->
			<view class="info-item" @click="showGenderModal">
				<view class="item-left">
					<text class="item-label">性别</text>
					<text class="item-value">{{ getGenderText(userProfile.gender) }}</text>
				</view>
				<text class="item-arrow">›</text>
			</view>
		</view>
		
		<!-- 修改昵称弹窗 -->
		<view class="modal" v-if="showNicknameInput" @click="closeNicknameModal">
			<view class="modal-content" @click.stop>
				<view class="modal-header">
					<text class="modal-title">修改昵称</text>
				</view>
				<view class="modal-body">
					<input 
						class="nickname-input" 
						v-model="newNickname" 
						placeholder="请输入新昵称"
						maxlength="20"
						:focus="showNicknameInput"
					/>
				</view>
				<view class="modal-footer">
					<button class="modal-btn cancel" @click="closeNicknameModal">取消</button>
					<button class="modal-btn confirm" @click="handleUpdateNickname">确定</button>
				</view>
			</view>
		</view>
		
		<!-- 选择性别弹窗 -->
		<view class="modal" v-if="showGenderPicker" @click="closeGenderModal">
			<view class="modal-content" @click.stop>
				<view class="modal-header">
					<text class="modal-title">选择性别</text>
				</view>
				<view class="modal-body gender-options">
					<view 
						class="gender-option" 
						:class="{ active: newGender === 0 }"
						@click="selectGender(0)"
					>
						<text class="gender-icon">男</text>
						<text class="gender-text">男</text>
					</view>
					<view 
						class="gender-option" 
						:class="{ active: newGender === 1 }"
						@click="selectGender(1)"
					>
						<text class="gender-icon">女</text>
						<text class="gender-text">女</text>
					</view>
				</view>
				<view class="modal-footer">
					<button class="modal-btn cancel" @click="closeGenderModal">取消</button>
					<button class="modal-btn confirm" @click="handleUpdateGender">确定</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import { getUserProfile, updateNickname, updateGender, updateAvatar } from '@/utils/api.js'
import { getUserIdOrDefault } from '@/utils/auth.js'

export default {
	data() {
		return {
			userId: getUserIdOrDefault(),
			userProfile: {},
			showNicknameInput: false,
			showGenderPicker: false,
			newNickname: '',
			newGender: null
		}
	},
	onLoad() {
		this.loadUserProfile()
	},
	onShow() {
		// 每次显示页面时刷新数据
		this.loadUserProfile()
	},
	methods: {
		// 加载用户资料
		async loadUserProfile() {
			try {
				// 优先从本地缓存加载用户信息
				const localUserInfo = uni.getStorageSync('userInfo')
				if (localUserInfo) {
					console.log('从本地缓存加载用户信息:', localUserInfo)
					// 兼容后端返回的字段名：avatar_url 和 avatar
					const avatar = localUserInfo.avatar || localUserInfo.avatarUrl || localUserInfo.avatar_url || '/static/logo.png'
					this.userProfile = {
						userId: localUserInfo.userId,
						nickname: localUserInfo.nickname || '微信用户',
						avatar: avatar,
						gender: localUserInfo.gender !== undefined ? localUserInfo.gender : null
					}
					console.log('本地用户资料加载完成:', this.userProfile)
				}
				
				// 尝试从后端获取最新信息（可选，如果接口存在的话）
				try {
					console.log('尝试从后端加载用户资料:', this.userId)
					const response = await getUserProfile(this.userId)
					
					if (response.code === 0 && response.data) {
						// 后端返回成功，更新数据
						// 兼容字段名：优先使用 avatarUrl，其次 avatar
						const avatar = response.data.avatarUrl || response.data.avatar || response.data.avatar_url || this.userProfile.avatar
										
						// 更新用户资料
						this.userProfile = {
							userId: response.data.userId || this.userProfile.userId,
							nickname: response.data.nickname || this.userProfile.nickname,
							avatar: avatar,
							gender: response.data.gender !== undefined ? response.data.gender : this.userProfile.gender
						}
										
						console.log('后端用户资料更新成功:', this.userProfile)
					}
				} catch (apiError) {
					// 后端接口失败，但不影响显示（已有本地数据）
					console.warn('后端接口调用失败，使用本地数据:', apiError.message)
				}
				
			} catch (error) {
				console.error('加载用户资料失败:', error)
				// 如果完全失败，尝试使用默认值
				this.userProfile = {
					userId: this.userId,
					nickname: '微信用户',
					avatar: '/static/logo.png',
					gender: null
				}
			}
		},
		
		// 选择头像
		chooseAvatar() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: (res) => {
					const tempFilePath = res.tempFilePaths[0]
					this.uploadAvatar(tempFilePath)
				}
			})
		},
		
		// 上传头像
		async uploadAvatar(filePath) {
			uni.showLoading({ title: '上传中...' })
			
			try {
				console.log('上传头像:', filePath, 'userId:', this.userId)
				
				const response = await updateAvatar(filePath, this.userId)
				
				console.log('上传头像响应:', response)
				
				uni.hideLoading()
				
				// 判断成功 - 后端返回的是字符串，直接就是 URL
				let avatarUrl = ''
				
				if (typeof response === 'string' && response.startsWith('http')) {
					// 直接返回 URL 字符串
					avatarUrl = response
				} else if (response.code === 0 && response.data) {
					// Result 包装格式
					avatarUrl = response.data
				} else if (response.data) {
					// 直接 data 字段
					avatarUrl = response.data
				}
				
				if (avatarUrl) {
					uni.showToast({
						title: '头像更新成功',
						icon: 'success'
					})
					
					console.log('头像更新成功:', avatarUrl)
					
					// 更新本地数据
					this.userProfile.avatar = avatarUrl
					
					// 更新本地缓存
					const userInfo = uni.getStorageSync('userInfo') || {}
					userInfo.avatar = avatarUrl
					uni.setStorageSync('userInfo', userInfo)
					
					console.log('本地缓存已更新')
				} else {
					throw new Error('上传失败，未返回头像 URL')
				}
				
			} catch (error) {
				uni.hideLoading()
				console.error('上传头像失败:', error)
				uni.showToast({
					title: error.message || '上传失败',
					icon: 'none'
				})
			}
		},
		
		// 显示修改昵称弹窗
		showNicknameModal() {
			this.newNickname = this.userProfile.nickname || ''
			this.showNicknameInput = true
		},
		
		// 关闭昵称弹窗
		closeNicknameModal() {
			this.showNicknameInput = false
			this.newNickname = ''
		},
		
		// 更新昵称
		async handleUpdateNickname() {
			const nickname = this.newNickname.trim()
			
			if (!nickname) {
				uni.showToast({
					title: '请输入昵称',
					icon: 'none'
				})
				return
			}
			
			if (nickname === this.userProfile.nickname) {
				this.closeNicknameModal()
				return
			}
			
			uni.showLoading({ title: '保存中...' })
			
			try {
				console.log('更新昵称:', { userId: this.userId, nickname })
				
				const response = await updateNickname({
					userId: this.userId,
					nickname: nickname
				})
				
				console.log('更新昵称响应:', response)
				
				uni.hideLoading()
				
				// 判断成功
				if (response.code === 0 || response.success) {
					uni.showToast({
						title: '昵称更新成功',
						icon: 'success'
					})
					
					// 更新本地数据
					this.userProfile.nickname = nickname
					
					// 更新本地缓存
					const userInfo = uni.getStorageSync('userInfo') || {}
					userInfo.nickname = nickname
					uni.setStorageSync('userInfo', userInfo)
					
					this.closeNicknameModal()
				} else {
					throw new Error(response.message || '更新失败')
				}
				
			} catch (error) {
				uni.hideLoading()
				console.error('更新昵称失败:', error)
				uni.showToast({
					title: error.message || '更新失败',
					icon: 'none'
				})
			}
		},
		
		// 显示性别选择弹窗
		showGenderModal() {
			this.newGender = this.userProfile.gender !== undefined ? this.userProfile.gender : null
			this.showGenderPicker = true
		},
		
		// 关闭性别弹窗
		closeGenderModal() {
			this.showGenderPicker = false
			this.newGender = null
		},
		
		// 选择性别
		selectGender(gender) {
			this.newGender = gender
		},
		
		// 更新性别
		async handleUpdateGender() {
			if (this.newGender === null) {
				uni.showToast({
					title: '请选择性别',
					icon: 'none'
				})
				return
			}
			
			if (this.newGender === this.userProfile.gender) {
				this.closeGenderModal()
				return
			}
			
			uni.showLoading({ title: '保存中...' })
			
			try {
				console.log('更新性别:', { userId: this.userId, gender: this.newGender })
				
				const response = await updateGender({
					userId: this.userId,
					gender: this.newGender
				})
				
				console.log('更新性别响应:', response)
				
				uni.hideLoading()
				
				// 判断成功
				if (response.code === 0 || response.success) {
					uni.showToast({
						title: '性别更新成功',
						icon: 'success'
					})
					
					// 更新本地数据
					this.userProfile.gender = this.newGender
					
					// 更新本地缓存
					const userInfo = uni.getStorageSync('userInfo') || {}
					userInfo.gender = this.newGender
					uni.setStorageSync('userInfo', userInfo)
					
					this.closeGenderModal()
				} else {
					throw new Error(response.message || '更新失败')
				}
				
			} catch (error) {
				uni.hideLoading()
				console.error('更新性别失败:', error)
				uni.showToast({
					title: error.message || '更新失败',
					icon: 'none'
				})
			}
		},
		
		// 获取性别文本
		getGenderText(gender) {
			if (gender === 0) return '男'
			if (gender === 1) return '女'
			return '未设置'
		}
	}
}
</script>

<style scoped>
.profile-container {
	min-height: 100vh;
	background: #f5f7fa;
	padding-bottom: 40rpx;
}

.avatar-section {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	padding: 80rpx 0 60rpx;
	display: flex;
	justify-content: center;
}

.avatar-card {
	position: relative;
	width: 200rpx;
	height: 200rpx;
}

.avatar-large {
	width: 100%;
	height: 100%;
	border-radius: 100rpx;
	border: 6rpx solid rgba(255, 255, 255, 0.3);
}

.avatar-mask {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 60rpx;
	background: rgba(0, 0, 0, 0.5);
	border-bottom-left-radius: 100rpx;
	border-bottom-right-radius: 100rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.camera-icon {
	font-size: 24rpx;
}

.change-text {
	font-size: 20rpx;
	color: #fff;
}

.info-section {
	margin: 20rpx 30rpx;
	background: #fff;
	border-radius: 16rpx;
	overflow: hidden;
}

.info-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 30rpx 24rpx;
	border-bottom: 1rpx solid #f5f5f5;
}

.info-item:last-child {
	border-bottom: none;
}

.info-item.readonly {
	background: #fafafa;
}

.item-left {
	flex: 1;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.item-label {
	font-size: 28rpx;
	color: #333;
	font-weight: 500;
}

.item-value {
	font-size: 28rpx;
	color: #666;
}

.readonly-value {
	color: #999;
}

.item-arrow {
	font-size: 40rpx;
	color: #ddd;
	margin-left: 16rpx;
}

/* 弹窗样式 */
.modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
}

.modal-content {
	width: 600rpx;
	background: #fff;
	border-radius: 20rpx;
	overflow: hidden;
}

.modal-header {
	padding: 40rpx 30rpx 30rpx;
	text-align: center;
	border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
}

.modal-body {
	padding: 40rpx 30rpx;
}

.nickname-input {
	width: 100%;
	height: 80rpx;
	padding: 0 20rpx;
	background: #f5f7fa;
	border-radius: 12rpx;
	font-size: 28rpx;
	color: #333;
}

.gender-options {
	display: flex;
	gap: 20rpx;
}

.gender-option {
	flex: 1;
	height: 140rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	background: #f5f7fa;
	border-radius: 12rpx;
	border: 2rpx solid transparent;
	transition: all 0.3s;
}

.gender-option.active {
	background: #e7f7ed;
	border-color: #52c41a;
}

.gender-icon {
	font-size: 60rpx;
}

.gender-text {
	font-size: 26rpx;
	color: #666;
}

.gender-option.active .gender-text {
	color: #52c41a;
	font-weight: 500;
}

.modal-footer {
	display: flex;
	border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
	flex: 1;
	height: 100rpx;
	line-height: 100rpx;
	font-size: 28rpx;
	text-align: center;
	border: none;
	background: none;
}

.modal-btn::after {
	border: none;
}

.modal-btn.cancel {
	color: #999;
}

.modal-btn.confirm {
	color: #4FC3F7;
	font-weight: 500;
	border-left: 1rpx solid #f0f0f0;
}
</style>
