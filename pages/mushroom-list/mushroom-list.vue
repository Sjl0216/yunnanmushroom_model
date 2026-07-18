<template>
	<view class="mushroom-list-container">
		
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
				:class="{ active: filterType === 'poisonous' }"
				@click="changeFilter('poisonous')"
			>
				<text class="tab-text">有毒</text>
			</view>
			<view 
				class="tab-item" 
				:class="{ active: filterType === 'safe' }"
				@click="changeFilter('safe')"
			>
				<text class="tab-text">无毒</text>
			</view>
		</view>

		<!-- 科普列表 -->
		<scroll-view 
			class="mushroom-list" 
			scroll-y 
			@scrolltolower="loadMore"
			:refresher-enabled="true"
			:refresher-triggered="isRefreshing"
			@refresherrefresh="onRefresh"
		>
			<view class="list-content">
				<view 
					class="mushroom-item" 
					v-for="item in list" 
					:key="item.mushroomId"
					@click="goDetail(item.mushroomId)"
				>
					<view class="image-wrapper">
						<image 
							class="item-image" 
							:src="item.standardImageUrl || defaultImg" 
							mode="aspectFill"
						></image>
					</view>
					
					<view class="item-info">
						<view class="info-top">
							<text class="mushroom-name">{{ item.chineseName }}</text>
							<view 
								v-if="item.mushroomId && item.mushroomId > 0 && item.chineseName !== '未知菌类'" 
								:class="['tag', item.isPoisonous === 1 ? 'poison-tag' : 'safe-tag']"
							>
								<text class="tag-text">{{ item.isPoisonous === 1 ? '有毒' : '无毒' }}</text>
							</view>
						</view>
						<view class="info-bottom">
							<text class="category">{{ item.category || '-' }}</text>
							<text class="dot">·</text>
							<text class="latin-name">{{ item.latinName || '-' }}</text>
						</view>
					</view>
					
					<view class="arrow">
						<text class="arrow-icon">›</text>
					</view>
				</view>
				
				<!-- 加载状态 -->
				<view class="loading-status" v-if="list.length > 0">
					<text class="status-text" v-if="!noMore && !isLoading" @click="loadMore">加载更多</text>
					<text class="status-text" v-else-if="isLoading">加载中...</text>
					<text class="status-text" v-else-if="noMore">没有更多了</text>
				</view>
				
				<!-- 空状态 -->
				<view class="empty-state" v-if="list.length === 0 && !isLoading">
					<text class="empty-icon"></text>
					<text class="empty-text">暂无科普数据</text>
					<text class="empty-tips">换个关键词试试吧</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { mushroomListAll } from '@/utils/api.js';

export default {
  data() {
    return {
      filterType: 'all', // all, poisonous, safe
      page: 1,
      size: 50,
      allMushrooms: [],
      list: [],
      noMore: false,
      isLoading: false,
      isRefreshing: false,
      defaultImg: 'https://img.yzcdn.cn/vant/cat.jpeg'
    };
  },
  onLoad() {
    this.fetchAllData();
  },
  onReachBottom() {
    this.loadMore();
  },
  onPullDownRefresh() {
    this.onRefresh();
  },
  methods: {
    // 过滤
    applyFilter(list) {
      if (this.filterType === 'poisonous') return list.filter(x => x.isPoisonous === 1);
      if (this.filterType === 'safe') return list.filter(x => x.isPoisonous === 0 || x.isPoisonous === 2);
      return list;
    },

    // 切换筛选
    changeFilter(type) {
      this.filterType = type;
      this.page = 1;
      this.list = [];
      this.noMore = false;
      this.loadPagedData(); // 从已加载的全量数据中筛选
    },
    
    // 核心方法：一次性加载全量数据
    async fetchAllData() {
      if (this.isLoading) return;
      
      this.isLoading = true;
      try {
        console.log('开始加载菌类全量数据...');
        
        const data = await mushroomListAll({});
        
        console.log('后端返回数据:', data);

        // 兼容两种响应格式
        let mushroomList = [];
        if (data.code === 0 && data.data) {
          // 标准格式: { code: 0, data: [...] }
          mushroomList = Array.isArray(data.data) ? data.data : [];
        } else if (Array.isArray(data)) {
          // 直接数组格式: [...]
          mushroomList = data;
        }
        
        // 打印第一条数据，查看数据结构
        if (mushroomList.length > 0) {
          console.log('第一条菌类数据:', mushroomList[0]);
        }
        
        this.allMushrooms = mushroomList;
        console.log('全量数据加载完成，总数:', this.allMushrooms.length);
        
        // 加载第一页
        this.page = 1;
        this.list = [];
        this.noMore = false;
        this.loadPagedData();
        
      } catch (error) {
        console.error('加载失败:', error);
        uni.showToast({
          title: error.message || '加载失败',
          icon: 'none',
          duration: 2000
        });
      } finally {
        this.isLoading = false;
        uni.stopPullDownRefresh();
      }
    },
    
    // 分页加载：从全量数据中截取当前页
    loadPagedData() {
      if (this.noMore) return;
      
      console.log(`加载第 ${this.page} 页数据...`);
      
      // 先应用过滤条件
      const filteredData = this.applyFilter(this.allMushrooms);
      
      // 计算分页范围
      const startIndex = (this.page - 1) * this.size;
      const endIndex = this.page * this.size;
      const pageData = filteredData.slice(startIndex, endIndex);
      
      console.log(`过滤后总数: ${filteredData.length}, 当前页: ${startIndex}-${endIndex}, 当前页数据量: ${pageData.length}`);
      
      // 追加到列表
      if (this.page === 1) {
        this.list = pageData;
      } else {
        this.list = [...this.list, ...pageData];
      }
      
      console.log('页面列表更新完成，当前显示数量:', this.list.length);
      console.log(' 当前显示的数据示例:', this.list.slice(0, 3));
      
      // 判断是否加载完
      if (endIndex >= filteredData.length) {
        this.noMore = true;
        console.log('所有数据已加载完毕');
      } else {
        this.page++;
      }
    },
    
    // 加载更多（触底加载）
    loadMore() {
      if (!this.noMore && !this.isLoading) {
        this.loadPagedData();
      }
    },
    
    // 下拉刷新
    onRefresh() {
      this.isRefreshing = true;
      this.page = 1;
      this.list = [];
      this.allMushrooms = [];
      this.noMore = false;
      this.fetchAllData().finally(() => {
        this.isRefreshing = false;
      });
    },
    
    // 跳转详情
    goDetail(mushroomId) {
      uni.navigateTo({
        url: `/pages/mushroom-detail/mushroom-detail?mushroomId=${mushroomId}`
      });
    }
  }
};
</script>

<style scoped>
.mushroom-list-container {
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

.mushroom-list {
	flex: 1;
}

.list-content {
	padding: 0 30rpx 30rpx;
}

.mushroom-item {
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
