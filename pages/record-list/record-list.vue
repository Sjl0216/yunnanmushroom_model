<template>
	<view class="record-list-container">
		
		<!-- 筛选标签 -->
		<view class="filter-tabs">
			<view 
				class="tab-item" 
				:class="{ active: filterType === 'all' }"
				@click="changeFilter('all')"
			>
				<text class="tab-text">全部</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterType === 'edible' }"
				@click="changeFilter('edible')"
			>
				<text class="tab-text">可食用</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterType === 'poisonous' }"
				@click="changeFilter('poisonous')"
			>
				<text class="tab-text">有毒</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterType === 'warning' }"
				@click="changeFilter('warning')"
			>
				<text class="tab-text">需谨慎</text>
			</view>
		</view>
		
		<!-- 记录列表 -->
		<scroll-view 
			class="record-list" 
			scroll-y 
			@scrolltolower="loadMore"
			:refresher-enabled="true"
			:refresher-triggered="isRefreshing"
			@refresherrefresh="onRefresh"
		>
			<view class="list-content">
				<view 
					class="record-item" 
					v-for="item in recordList" 
					:key="item.recordId || item.rid"
					@click="viewDetail(item.recordId || item.rid)"
				>
					<view class="image-wrapper">
						<image 
							v-if="item.imageUrl" 
							:src="item.imageUrl" 
							mode="aspectFill" 
							class="item-image"
							@error="onImageError(item)"
						></image>
						<view v-else class="item-image placeholder">
							<text>无图</text>
						</view>
					</view>
					
					<view class="item-info">
						<view class="info-top">
							<text class="mushroom-name">{{ item.mushroomName }}</text>
							<view class="poison-tag" v-if="item.isPoisonous === 1">
								<text class="tag-text">有毒</text>
							</view>
							<view class="warning-tag" v-else-if="item.isPoisonous === 2">
								<text class="tag-text">需谨慎</text>
							</view>
							<view class="safe-tag" v-else-if="item.isPoisonous === 0">
								<text class="tag-text">可食用</text>
							</view>
						</view>
						<view class="info-middle">
							<text class="confidence">置信度: {{ formatConfidence(item.confidence) }}</text>
							<text class="source-tag" v-if="item.source === 'local_history'">本地</text>
						</view>
						<view class="info-bottom">
							<text class="time">{{ formatTime(item.timeMs) }}</text>
						</view>
					</view>
					<view class="arrow">
						<text class="arrow-icon">›</text>
					</view>
				</view>
				
				<!-- 加载状态 -->
				<view class="loading-status" v-if="recordList.length > 0">
					<text class="status-text" v-if="isLoading">加载中...</text>
					<text class="status-text" v-else-if="noMore">没有更多了</text>
				</view>
				
				<!-- 空状态 -->
				<view class="empty-state" v-if="recordList.length === 0 && !isLoading">
					<text class="empty-icon"></text>
					<text class="empty-text">暂无识别记录</text>
					<text class="empty-tips">去首页拍照识别吧</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { formatRelativeTime } from '@/utils/date.js'
import { recordList, recordListAll } from '@/utils/api.js'
import { getUserIdOrDefault } from '@/utils/auth.js'
import { checkNetwork, BASE_URL } from '@/utils/request.js'
import { getLocalCache, getUnsyncedRecords, markAsSynced, mergeRecords, cleanSyncedRecords } from '@/utils/local-cache.js'
import { predictCloud } from '@/utils/api.js'

export default {
	data() {
		return {
			filterType: 'all', // all, edible, poisonous, warning
			allRecords: [], // 全量数据（从后端一次性获取）
			recordList: [], // 当前显示的数据
			page: 1,
			size: 30, // 每次加载 30 条
			isLoading: false,
			isRefreshing: false,
			noMore: false,
			userId: getUserIdOrDefault(), // 从本地存储获取 userId
			networkStatus: null // 网络状态
		}
	},
	onLoad() {
		console.log('记录页面 onLoad');
		this.loadRecordList();
	},
	onShow() {
		console.log('记录页面 onShow - 刷新数据');
		// 每次显示时刷新数据（从首页识别后返回）
		this.page = 1;
		this.recordList = [];
		this.noMore = false;
		this.loadRecordList();
	},
	methods: {
		// 判断是否 http(s) 或本地微信文件
		isHttpUrl(url) {
			if (!url) return false;
			const sUrl = String(url);
			return sUrl.startsWith('http') || sUrl.startsWith('https') || sUrl.startsWith('wxfile://');
		},

		// 后端记录 -> 统一结构
		normalizeServerRecord(r) {
			let finalUrl = r.imageUrl;
			if (finalUrl && !this.isHttpUrl(finalUrl)) {
				finalUrl = BASE_URL + finalUrl;
			}
			// 解决 URL 中可能存在的中文或特殊字符导致的加载失败
			if (finalUrl && finalUrl.startsWith('http')) {
				finalUrl = finalUrl.replace(/ /g, '%20');
			}
			
			return {
				source: 'server',
				recordId: r.recordId,
				rid: null,
				mushroomName: r.mushroomName || '未知',
				confidence: r.confidence,
				isPoisonous: r.isPoisonous, 
				imageUrl: finalUrl,
				timeMs: r.recognizeTime ? new Date(r.recognizeTime.replace(/-/g, '/')).getTime() : Date.now()
			};
		},

		// 图片加载失败处理
		onImageError(item) {
			console.error('图片加载失败:', item.imageUrl);
			// 加载失败后可以置空或显示备用图
			// item.imageUrl = '/static/logo.png'; 
		},

		// pending 队列 -> 统一结构（未同步）
		normalizePendingRecord(p) {
			return {
				source: 'local_pending',
				recordId: null,
				rid: p.localId,
				mushroomName: p.mushroomName || '识别中...',
				confidence: p.confidence,
				isPoisonous: p.isPoisonous,
				inferModel: 0,
				imageUrl: p.imagePath, // tempFilePath 可直接显示
				timeMs: p.createTime || Date.now()
			};
		},

		// 过滤
		applyFilter(list) {
			if (this.filterType === 'edible') return list.filter(x => x.isPoisonous === 0);
			if (this.filterType === 'poisonous') return list.filter(x => x.isPoisonous === 1);
			if (this.filterType === 'warning') return list.filter(x => x.isPoisonous === 2);
			return list;
		},

		// 切换筛选
		changeFilter(type) {
			this.filterType = type;
			this.page = 1;
			this.recordList = [];
			this.noMore = false;
			this.loadPagedRecords(); // 从已加载的全量数据中筛选
		},
			
		// 核心方法：加载全量数据（仅调用一次）
		async loadRecordList() {
			if (this.isLoading) return;
				
			this.isLoading = true;
			try {
				console.log('开始加载全量数据...');
					
				// 1）拉取服务器全量数据
				let serverRecords = [];
				try {
					const resp = await recordListAll({
						userId: this.userId
					});
						
					// 兼容两种响应格式
					let serverList = [];
					if (resp.code === 0 && resp.data) {
						// 标准格式: { code: 0, data: [...] }
						serverList = Array.isArray(resp.data) ? resp.data : [];
					} else if (Array.isArray(resp)) {
						// 直接数组格式: [...]
						serverList = resp;
					}
						
					serverRecords = serverList.map(this.normalizeServerRecord.bind(this));
					console.log('服务器记录数量:', serverRecords.length);
				} catch (e) {
					console.warn('服务器记录拉取失败:', e);
				}
		
				// 2）读取本地数据
				let localRecords = [];
				console.log('--- 开始读取本地历史 ---');
				const historyKey = `mushroom_records_${this.userId}`;
				const history = uni.getStorageSync(historyKey) || uni.getStorageSync('records') || uni.getStorageSync('mushroom_records') || [];
					
				console.log('读取使用的 Key:', historyKey);
				console.log('本地记录条数:', history.length);
					
				const historyNormalized = history.map(h => ({
					source: 'local_history',
					recordId: null,
					rid: h.rid || h.id || Date.now(),
					mushroomName: h.mushroomName || h.className || '本地识别',
					confidence: h.confidence || (h.score ? parseFloat(h.score) : 0),
					isPoisonous: h.isPoisonous,
					imageUrl: h.imageUrl,
					timeMs: h.createTime || h.recognizeTime || Date.now()
				}));
					
				const pendingKey = `pending_queue_${this.userId}`;
				const pending = uni.getStorageSync(pendingKey) || [];
				const pendingNormalized = pending.map(this.normalizePendingRecord.bind(this));
					
				localRecords = [...pendingNormalized, ...historyNormalized];
		
				// 3）合并 + 排序 + 去重
				let merged = [...localRecords, ...serverRecords];
				console.log('合并后记录总数:', merged.length);
		
				// 排序（按时间倒序）
				merged.sort((a, b) => (b.timeMs || 0) - (a.timeMs || 0));
					
				// 去重
				const seen = new Set();
				this.allRecords = merged.filter(item => {
					const id = item.recordId || item.rid;
					if (seen.has(id)) return false;
					seen.add(id);
					return true;
				});
					
				console.log('全量数据加载完成，总数:', this.allRecords.length);
					
				// 4）加载第一页数据
				this.page = 1;
				this.loadPagedRecords();
					
			} catch (error) {
				console.error('读取记录失败:', error);
			} finally {
				this.isLoading = false;
				this.isRefreshing = false;
			}
		},
			
		// 分页加载：从全量数据中截取当前页
		loadPagedRecords() {
			if (this.noMore) return;
				
			console.log(`加载第 ${this.page} 页数据...`);
						
			// 1）过滤
			const filtered = this.applyFilter(this.allRecords);
						
			// 2）计算分页范围
			const startIndex = (this.page - 1) * this.size;
			const endIndex = this.page * this.size;
			const pageData = filtered.slice(startIndex, endIndex);
						
			console.log(`筛选后总数: ${filtered.length}, 当前页: ${startIndex}-${endIndex}, 当前页数据量: ${pageData.length}`);
						
			// 3）追加到列表
			if (this.page === 1) {
				this.recordList = pageData;
			} else {
				this.recordList = [...this.recordList, ...pageData];
			}
						
			// 4）判断是否加载完
			if (endIndex >= filtered.length) {
				this.noMore = true;
				console.log('所有数据已加载完毕');
			} else {
				this.page++;
			}
		},
		
		// 下拉刷新
		onRefresh() {
			this.isRefreshing = true;
			this.page = 1;
			this.noMore = false;
			this.recordList = [];
			this.allRecords = [];
			this.loadRecordList();
		},
			
		// 加载更多（触底加载）
		loadMore() {
			if (!this.noMore && !this.isLoading) {
				this.loadPagedRecords();
			}
		},
		
		// 查看详情
		viewDetail(idOrRid) {
			if (!idOrRid) return;
			// 统一跳转到详情页
			uni.navigateTo({
				url: `/pages/record-detail/record-detail?recordId=${idOrRid}`
			})
		},
		
		// 格式化时间
		formatTime(timeMs) {
			if (!timeMs) return '';
			const d = new Date(timeMs);
			const now = new Date();
			
			// 如果是今天的记录，显示具体时间
			if (d.toDateString() === now.toDateString()) {
				return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
			}
			
			// 否则显示日期
			const year = d.getFullYear();
			const month = (d.getMonth() + 1).toString().padStart(2, '0');
			const day = d.getDate().toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		},
		
		// 格式化置信度
		formatConfidence(confidence) {
			if (confidence === undefined || confidence === null) return '0%';
			if (typeof confidence === 'string') {
				if (confidence.includes('%')) return confidence;
				return parseFloat(confidence).toFixed(1) + '%';
			}
			return parseFloat(confidence).toFixed(1) + '%';
		}
	}
}
</script>

<style scoped>
.record-list-container {
	min-height: 100vh;
	background: #f5f7fa;
	display: flex;
	flex-direction: column;
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
	background: #2894FA;
}

.tab-text {
	font-size: 28rpx;
	color: #666;
}

.tab-item.active .tab-text {
	color: #fff;
	font-weight: 500;
}

.record-list {
	flex: 1;
}

.list-content {
	padding: 0 30rpx 30rpx;
}

.record-item {
	background: #fff;
	border-radius: 16rpx;
	padding: 20rpx;
	margin-bottom: 20rpx;
	display: flex;
	align-items: center;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.item-image {
	width: 100%;
	height: 100%;
	border-radius: 12rpx;
}

.image-wrapper {
	width: 120rpx;
	height: 120rpx;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.item-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	height: 120rpx;
}

.info-top {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.mushroom-name {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
}

.poison-tag {
	padding: 4rpx 12rpx;
	background: #ffebee;
	border-radius: 8rpx;
}

.poison-tag .tag-text {
	font-size: 20rpx;
	color: #f44336;
}

.warning-tag {
	padding: 4rpx 12rpx;
	background: #fff7e6;
	border-radius: 8rpx;
}

.warning-tag .tag-text {
	font-size: 20rpx;
	color: #fa8c16;
}

.safe-tag {
	padding: 4rpx 12rpx;
	background: #e8f5e9;
	border-radius: 8rpx;
}

.safe-tag .tag-text {
	font-size: 20rpx;
	color: #4caf50;
}

.confidence {
	font-size: 24rpx;
	color: #999;
}

.time {
	font-size: 24rpx;
	color: #ccc;
}

.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f0f0f0;
	color: #999;
	font-size: 24rpx;
}

.source-tag {
	margin-left: 10rpx;
	font-size: 18rpx;
	padding: 2rpx 8rpx;
	border-radius: 4rpx;
	background: #f0f0f0;
	color: #999;
}

.arrow {
	width: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.arrow-icon {
	font-size: 40rpx;
	color: #ddd;
}

.loading-status {
	text-align: center;
	padding: 40rpx 0;
}

.status-text {
	font-size: 24rpx;
	color: #999;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 200rpx 0;
}

.empty-icon {
	font-size: 100rpx;
	margin-bottom: 20rpx;
}

.empty-text {
	font-size: 32rpx;
	color: #999;
	margin-bottom: 12rpx;
}

.empty-tips {
	font-size: 26rpx;
	color: #ccc;
}
</style>