<template>
	<view class="feedback-result-container">
		<!-- 头部 -->
		<view class="header">
			<text class="title">反馈结果</text>
		</view>
		
		<!-- 反馈列表（显示所有反馈） -->
		<scroll-view 
			class="result-list" 
			scroll-y 
			@scrolltolower="loadMore"
			refresher-enabled
			:refresher-triggered="isRefreshing"
			@refresherrefresh="onRefresh"
		>
			<view class="list-content">
				<!-- 反馈项 -->
				<view 
					class="result-item" 
					v-for="item in resultList" 
					:key="item.feedbackId"
				>
					<!-- 头部：类型 + 状态 -->
					<view class="item-header">
						<view class="type-tag" :class="getTypeClass(item.feedbackType)">
							{{ getTypeText(item.feedbackType) }}
						</view>
						<view class="status-tag" :class="item.status === 0 ? 'status-pending' : 'status-replied'">
							{{ item.status === 0 ? '待处理' : '已回复' }}
						</view>
					</view>
					
					<!-- 我的反馈 -->
					<view class="feedback-section">
						<view class="section-title">
							<text class="title-icon"></text>
							<text class="title-text">我的反馈</text>
						</view>
						<view class="section-content">
							<text class="content-text">{{ item.content }}</text>
						</view>
					</view>
					
					<!-- 管理员回复区域 -->
					<view class="reply-section">
						<view class="section-title">
							<text class="title-icon"></text>
							<text class="title-text">管理员回复</text>
						</view>
						
						<!-- status = 0: 待处理 -->
						<view v-if="item.status === 0" class="section-content pending-content">
							<text class="pending-text">暂无回复，请耐心等待...</text>
						</view>
						
						<!-- status = 1: 已回复 -->
						<view v-else class="section-content reply-content">
							<text class="content-text">{{ item.reply || '暂无回复内容' }}</text>
							<view class="reply-time" v-if="item.handleTime">
								<text class="reply-time-text">回复时间：{{ formatTime(item.handleTime) }}</text>
							</view>
						</view>
					</view>
					
					<!-- 底部：提交时间 -->
					<view class="item-footer">
						<text class="footer-text">提交时间：{{ formatTime(item.createTime) }}</text>
					</view>
				</view>
				
				<!-- 空状态 -->
				<view class="empty-state" v-if="resultList.length === 0 && !isLoading">
					<text class="empty-icon"></text>
					<text class="empty-text">暂无反馈记录</text>
					<text class="empty-tips">您还没有提交过反馈</text>
				</view>
				
				<!-- 加载状态 -->
				<view class="loading-state" v-if="isLoading">
					<text class="loading-text">加载中...</text>
				</view>
				
				<!-- 没有更多 -->
				<view class="no-more" v-if="noMore && resultList.length > 0">
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
			resultList: [],
			page: 1,
			size: 10,
			total: 0, // 总数据数
			isLoading: false,
			isRefreshing: false,
			noMore: false
		}
	},
	onLoad() {
		this.loadResultList()
	},
	methods: {
		// 加载反馈结果（显示所有反馈）
		async loadResultList() {
			if (this.isLoading || this.noMore) return
			
			this.isLoading = true
			
			try {
				const params = {
					userId: this.userId,
					// 不限制 status，显示所有反馈
					page: this.page,
					size: this.size
				}
				
				console.log('加载反馈结果:', params)
				
				const response = await feedbackList(params)
				
				console.log('反馈结果响应:', response)
				
				// 兼容多种响应格式
				let data = []
				let total = 0
				
				// 格式1: 分页对象 {total, size, page, list}
				if (response.list && Array.isArray(response.list)) {
					data = response.list
					total = response.total || 0
					console.log('解析分页格式，数据总数:', total, '当前页数据:', data.length)
				}
				// 格式2: Result包装 {code: 0, data: {...}}
				else if (response.code === 0 && response.data) {
					if (response.data.list && Array.isArray(response.data.list)) {
						data = response.data.list
						total = response.data.total || 0
					} else if (Array.isArray(response.data)) {
						data = response.data
						total = data.length
					}
				}
				// 格式3: 直接数组
				else if (Array.isArray(response)) {
					data = response
					total = data.length
				}
				
				// 更新 total
				this.total = total
				
				// 合并数据
				if (this.page === 1) {
					this.resultList = data
				} else {
					this.resultList = [...this.resultList, ...data]
				}
				
				// 判断是否还有更多数据
				if (this.resultList.length >= this.total) {
					this.noMore = true
					console.log(' 没有更多数据了，已加载:', this.resultList.length, '/', this.total)
				} else {
					console.log('还有更多数据，已加载:', this.resultList.length, '/', this.total)
				}
				
				console.log('反馈结果加载完成，当前总数:', this.resultList.length)
				
			} catch (error) {
				console.error('加载反馈结果失败:', error)
				uni.showToast({
					title: '加载失败',
					icon: 'none'
				})
			} finally {
				this.isLoading = false
				this.isRefreshing = false
			}
		},
		
		// 下拉刷新
		onRefresh() {
			this.isRefreshing = true
			this.page = 1
			this.noMore = false
			this.resultList = []
			this.loadResultList()
		},
		
		// 加载更多
		loadMore() {
			if (!this.noMore && !this.isLoading) {
				this.page++
				this.loadResultList()
			}
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
				
				// 格式化：YYYY-MM-DD HH:mm
				const year = d.getFullYear()
				const month = (d.getMonth() + 1).toString().padStart(2, '0')
				const day = d.getDate().toString().padStart(2, '0')
				const hour = d.getHours().toString().padStart(2, '0')
				const minute = d.getMinutes().toString().padStart(2, '0')
				return `${year}-${month}-${day} ${hour}:${minute}`
			} catch (error) {
				console.error('时间格式化失败:', timeStr, error)
				return String(timeStr)
			}
		}
	}
}
</script>

<style scoped>
.feedback-result-container {
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

.result-list {
	flex: 1;
}

.list-content {
	padding: 0 30rpx 30rpx;
}

.result-item {
	background: #fff;
	border-radius: 16rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.item-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.type-tag {
	padding: 6rpx 16rpx;
	border-radius: 8rpx;
	font-size: 22rpx;
	font-weight: 500;
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

.feedback-section {
	margin-bottom: 20rpx;
}

.reply-section {
	margin-bottom: 20rpx;
}

.section-title {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 12rpx;
}

.title-icon {
	font-size: 28rpx;
}

.title-text {
	font-size: 26rpx;
	color: #666;
	font-weight: 500;
}

.section-content {
	background: #f9f9f9;
	padding: 20rpx;
	border-radius: 12rpx;
	border-left: 4rpx solid #e0e0e0;
}

.reply-content {
	background: #e7f7ed;
	border-left: 4rpx solid #52c41a;
}

.pending-content {
	background: #fff7e6;
	border-left: 4rpx solid #fa8c16;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40rpx 20rpx;
}

.pending-text {
	font-size: 26rpx;
	color: #fa8c16;
	text-align: center;
}

.reply-time {
	margin-top: 16rpx;
	padding-top: 12rpx;
	border-top: 1rpx dashed rgba(82, 196, 26, 0.3);
}

.reply-time-text {
	font-size: 24rpx;
	color: #52c41a;
}

.content-text {
	font-size: 28rpx;
	color: #333;
	line-height: 1.6;
	word-break: break-word;
}

.item-footer {
	padding-top: 16rpx;
	border-top: 1rpx solid #f0f0f0;
}

.footer-text {
	font-size: 24rpx;
	color: #999;
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
