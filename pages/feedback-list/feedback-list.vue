<template>
	<view class="feedback-list-container">
		<!-- 头部 -->
		<view class="header">
			<text class="title">我的反馈</text>
		</view>
		
		<!-- 筛选标签 -->
		<view class="filter-tabs">
			<view 
				class="tab-item" 
				:class="{ active: filterStatus === 'all' }" 
				@click="changeFilter('all')"
			>
				<text class="tab-text">全部</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterStatus === 'pending' }" 
				@click="changeFilter('pending')"
			>
				<text class="tab-text">待处理</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterStatus === 'replied' }" 
				@click="changeFilter('replied')"
			>
				<text class="tab-text">已回复</text>
			</view>
		</view>
		
		<!-- 反馈列表 -->
		<scroll-view 
			class="feedback-list" 
			scroll-y 
			@scrolltolower="loadMore"
			refresher-enabled
			:refresher-triggered="isRefreshing"
			@refresherrefresh="onRefresh"
		>
			<view class="list-content">
				<!-- 反馈项 -->
				<view 
					class="feedback-item" 
					v-for="item in feedbackList" 
					:key="item.feedbackId"
					@click="viewDetail(item.feedbackId)"
				>
					<view class="item-main">
						<!-- 左侧内容 -->
						<view class="item-left">
							<view class="item-header">
								<view class="type-tag" :class="getTypeClass(item.feedbackType)">
									{{ getTypeText(item.feedbackType) }}
								</view>
								<view class="status-tag" :class="item.status === 0 ? 'status-pending' : 'status-replied'">
									{{ item.status === 0 ? '待处理' : '已回复' }}
								</view>
							</view>
							
							<view class="item-content">
								<text class="content-text">{{ item.content }}</text>
							</view>
							
							<view class="item-footer">
								<text class="time-text">{{ formatTime(item.createTime) }}</text>
								<text class="arrow">›</text>
							</view>
						</view>
						
						<!-- 右侧图片 -->
						<view class="item-right">
							<image 
								v-if="item.imageUrl"
								class="feedback-image" 
								:src="item.imageUrl" 
								mode="aspectFill"
								@error="handleImageError"
							></image>
							<view v-else class="default-image">
								<text class="default-icon"></text>
							</view>
						</view>
					</view>
				</view>
				
				<!-- 空状态 -->
				<view class="empty-state" v-if="feedbackList.length === 0 && !isLoading">
					<text class="empty-icon"></text>
					<text class="empty-text">暂无反馈记录</text>
					<text class="empty-tips">您可以在识别记录详情页提交反馈</text>
				</view>
				
				<!-- 加载状态 -->
				<view class="loading-state" v-if="isLoading">
					<text class="loading-text">加载中...</text>
				</view>
				
				<!-- 没有更多 -->
				<view class="no-more" v-if="noMore && feedbackList.length > 0">
					<text class="no-more-text">没有更多了</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { feedbackList } from '@/utils/api.js'
import { getUserIdOrDefault } from '@/utils/auth.js'

export default {
	data() {
		return {
			userId: getUserIdOrDefault(),
			filterStatus: 'all', // all, pending, replied
			feedbackList: [],
			page: 1,
			size: 10,
			total: 0, // 总数据数
			isLoading: false,
			isRefreshing: false,
			noMore: false
		}
	},
	onLoad() {
		this.loadFeedbackList()
	},
	methods: {
		// 加载用户反馈列表（支持分页、筛选和下拉加载更多）
		// 核心逻辑：防并发请求 + 多响应格式兼容 + 分页数据合并
		async loadFeedbackList() {
			// 步骤 1: 防并发与终止条件检查
			// isLoading: 防止重复请求；noMore: 已无更多数据时停止加载
			if (this.isLoading || this.noMore) return
				
			this.isLoading = true // 标记加载中状态
				
			try {
				// 步骤 2: 构建 API 请求参数
				const params = {
					userId: this.userId, // 当前登录用户 ID，用于过滤个人反馈
					page: this.page, // 当前页码（从 1 开始）
					size: this.size // 每页条数（默认 10 条）
				}
					
				// 步骤 3: 根据筛选条件添加状态参数
				// filterStatus: 'all'=全部，'pending'=待回复，'replied'=已回复
				if (this.filterStatus === 'pending') {
					params.status = 0 // 0 = 待处理/未回复
				} else if (this.filterStatus === 'replied') {
					params.status = 1 // 1 = 已回复/已完成
				}
				// 注意：filterStatus 为'all'或其他值时不传 status 参数，后端返回全部状态
					
				console.log('加载反馈列表:', params)
					
				// 步骤 4: 调用后端 API 获取反馈列表
				// feedbackList: 封装好的 API 方法，内部已包含认证 token 和错误处理
				const response = await feedbackList(params)
					
				console.log('反馈列表响应:', response)
					
				// 步骤 5: 解析响应数据（兼容多种后端响应格式）
				let data = [] // 存储本次获取的反馈列表数组
				let total = 0 // 存储符合条件的总记录数，用于判断是否还有更多数据
					
				// 格式 1: 标准分页对象 {total, size, page, list}
				// 特点：直接包含分页元数据和数据列表
				if (response.list && Array.isArray(response.list)) {
					data = response.list // 提取数据列表
					total = response.total || 0 // 提取总记录数
					console.log('解析分页格式，数据总数:', total, '当前页数据:', data.length)
				}
				// 格式 2: Result 统一返回包装 {code: 0, data: {...}}
				// 特点：外层有状态码和 data 包裹，data 可能是分页对象或数组
				else if (response.code === 0 && response.data) {
					// 子情况 2.1: data 内是分页对象 {list: [], total: 0}
					if (response.data.list && Array.isArray(response.data.list)) {
						data = response.data.list
						total = response.data.total || 0
					} 
					// 子情况 2.2: data 直接是数组 []
					else if (Array.isArray(response.data)) {
						data = response.data
						total = data.length // 数组长度即为总数
					}
				}
				// 格式 3: 直接返回数组 []
				// 特点：最简格式，无分页信息，通常表示返回全部数据
				else if (Array.isArray(response)) {
					data = response
					total = data.length
				}
					
				// 步骤 6: 更新组件的总记录数状态
				// 用于前端判断是否显示"没有更多了"提示
				this.total = total
					
				// 步骤 7: 合并新旧数据（实现下拉加载更多）
				// 第 1 页：直接替换旧数据（刷新场景）
				if (this.page === 1) {
					this.feedbackList = data
				} 
				// 第 2 页及以后：追加到现有列表末尾（加载更多场景）
				else {
					this.feedbackList = [...this.feedbackList, ...data]
				}
					
				// 步骤 8: 判断是否还有更多数据
				// 判定逻辑：已加载数量 >= 总数量 → 无更多数据
				if (this.feedbackList.length >= this.total) {
					this.noMore = true // 标记无更多数据，阻止后续加载
					console.log('没有更多数据了，已加载:', this.feedbackList.length, '/', this.total)
				} else {
					console.log('还有更多数据，已加载:', this.feedbackList.length, '/', this.total)
				}
					
				console.log('反馈列表加载完成，当前总数:', this.feedbackList.length)
					
			} catch (error) {
				// 步骤 9: 异常处理
				// 记录详细错误日志，便于开发调试
				console.error('加载反馈列表失败:', error)
				// 用户友好提示
				uni.showToast({
					title: '加载失败',
					icon: 'none'
				})
			} finally {
				// 步骤 10: 清理加载状态（无论成功失败都会执行）
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		
		// 切换筛选
		changeFilter(status) {
			this.filterStatus = status
			this.page = 1
			this.noMore = false
			this.feedbackList = []
			this.loadFeedbackList()
		},
		
		// 下拉刷新
		onRefresh() {
			this.isRefreshing = true
			this.page = 1
			this.noMore = false
			this.feedbackList = []
			this.loadFeedbackList()
		},
		
		// 加载更多
		loadMore() {
			if (!this.noMore && !this.isLoading) {
				this.page++
				this.loadFeedbackList()
			}
		},
		
		// 查看详情
		viewDetail(feedbackId) {
			uni.navigateTo({
				url: `/pages/feedback-detail/feedback-detail?feedbackId=${feedbackId}`
			})
		},
		
		// 图片加载失败
		handleImageError(e) {
			console.log('图片加载失败:', e)
		},
		
		// 获取类型文本
		getTypeText(type) {
			const typeMap = {
				1: '识别错误',
				2: '图片问题',
				3: '系统问题',
				4: '其他'
			}
			return typeMap[type] || '未知'
		},
		
		// 获取类型样式类
		getTypeClass(type) {
			const classMap = {
				1: 'type-error',
				2: 'type-image',
				3: 'type-bug',
				4: 'type-other'
			}
			return classMap[type] || 'type-other'
		},
		
		// 格式化时间
		formatTime(timeStr) {
			if (!timeStr) return ''
			
			try {
				// 处理后端返回的时间格式（可能是 ISO 或 YYYY-MM-DD HH:mm:ss）
				let d
				if (timeStr.includes('T')) {
					// ISO 格式: 2026-01-21T19:23:00
					d = new Date(timeStr)
				} else {
					// 中国标准格式: 2026-01-21 19:23:00
					d = new Date(timeStr.replace(/-/g, '/'))
				}
				
				// 检查日期是否有效
				if (isNaN(d.getTime())) {
					return String(timeStr)
				}
				
				const now = new Date()
				
				// 今天
				const isToday = d.getFullYear() === now.getFullYear() &&
								 d.getMonth() === now.getMonth() &&
								 d.getDate() === now.getDate()
				
				if (isToday) {
					const hours = d.getHours().toString().padStart(2, '0')
					const minutes = d.getMinutes().toString().padStart(2, '0')
					return `今天 ${hours}:${minutes}`
				}
				
				// 昨天
				const yesterday = new Date(now)
				yesterday.setDate(yesterday.getDate() - 1)
				const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
									 d.getMonth() === yesterday.getMonth() &&
									 d.getDate() === yesterday.getDate()
				
				if (isYesterday) {
					const hours = d.getHours().toString().padStart(2, '0')
					const minutes = d.getMinutes().toString().padStart(2, '0')
					return `昨天 ${hours}:${minutes}`
				}
				
				// 其他日期，显示年-月-日
				const year = d.getFullYear()
				const month = (d.getMonth() + 1).toString().padStart(2, '0')
				const day = d.getDate().toString().padStart(2, '0')
				return `${year}-${month}-${day}`
			} catch (error) {
				console.error('时间格式化失败:', timeStr, error)
				return String(timeStr)
			}
		}
	}
}
</script>

<style scoped>
.feedback-list-container {
	min-height: 100vh;
	background: #f5f7fa;
	display: flex;
	flex-direction: column;
}

.header {
	background: #fff;
	padding: 30rpx;
	text-align: center;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	color: #333;
}

.filter-tabs {
	display: flex;
	background: #fff;
	padding: 20rpx 30rpx;
	margin-bottom: 20rpx;
	gap: 10rpx;
}

.tab-item {
	flex: 1;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 30rpx;
	background: #f5f7fa;
	transition: all 0.3s;
}

.tab-item.active {
	background: #87CEEB;
}

.tab-text {
	font-size: 28rpx;
	color: #666;
}

.tab-item.active .tab-text {
	color: #fff;
	font-weight: 500;
}

.feedback-list {
	flex: 1;
}

.list-content {
	padding: 0 30rpx 30rpx;
}

.feedback-item {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.item-main {
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
}

.item-left {
	flex: 1;
	min-width: 0;
}

.item-right {
	flex-shrink: 0;
	width: 160rpx;
	height: 160rpx;
}

.item-header {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 16rpx;
}

.type-tag {
	padding: 6rpx 16rpx;
	border-radius: 8rpx;
	font-size: 22rpx;
	font-weight: 500;
}

.type-error {
	background: #B8E0F2;
	color: #1E1E1E;
}

.type-image {
	background: #B8E0F2;
	color: #1E1E1E;
}

.type-bug {
	background: #B8E0F2;
	color: #1E1E1E;
}

.type-other {
	background: #B8E0F2;
	color: #1E1E1E;
}

.status-tag {
	padding: 6rpx 16rpx;
	border-radius: 8rpx;
	font-size: 22rpx;
	font-weight: 500;
}

.status-pending {
	background: #B8E0F2;
	color: #1E1E1E;
}

.status-replied {
	background: #B8E0F2;
	color: #1E1E1E;
}

.item-content {
	margin-bottom: 16rpx;
}

.content-text {
	font-size: 28rpx;
	color: #333;
	line-height: 1.6;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	overflow: hidden;
	text-overflow: ellipsis;
}

.item-footer {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.time-text {
	font-size: 24rpx;
	color: #999;
}

.arrow {
	font-size: 40rpx;
	color: #ddd;
}

.feedback-image {
	width: 100%;
	height: 100%;
	border-radius: 12rpx;
	object-fit: cover;
	background: #f5f7fa;
}

.default-image {
	width: 100%;
	height: 100%;
	border-radius: 12rpx;
	background: #87CEEB;
	display: flex;
	align-items: center;
	justify-content: center;
}

.default-icon {
	font-size: 60rpx;
	opacity: 0.6;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 120rpx 0;
}

.empty-icon {
	font-size: 120rpx;
	margin-bottom: 20rpx;
}

.empty-text {
	font-size: 32rpx;
	color: #999;
	margin-bottom: 12rpx;
}

.empty-tips {
	font-size: 24rpx;
	color: #ccc;
}

.loading-state {
	text-align: center;
	padding: 40rpx 0;
}

.loading-text {
	font-size: 28rpx;
	color: #999;
}

.no-more {
	text-align: center;
	padding: 40rpx 0;
}

.no-more-text {
	font-size: 24rpx;
	color: #ccc;
}
</style>
