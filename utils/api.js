/**
 * API 接口统一管理
 */

import { request, upload } from './request.js'

export const api = {
	// 用户相关
	userLogin: (code) => request('/api/user/login', 'POST', { code }),
	getUserInfo: (userId) => request('/api/user/info', 'GET', { userId }),
	updateUserInfo: (data) => request('/api/user/update', 'PUT', data),
	// 用户个人信息相关
	getUserProfile: (userId) => request('/api/user/profile', 'GET', { userId }),
	updateNickname: (data) => request('/api/user/update/nickname', 'POST', data),
	updateGender: (data) => request('/api/user/update/gender', 'POST', data),
	updateAvatar: (filePath, userId) => upload('/api/user/update/avatar', filePath, 'avatar', { userId }),
	
	// 科普相关
	mushroomList: (params) => request('/api/mushroom/list', 'GET', params),
	mushroomListAll: (params) => request('/api/mushroom/app/list', 'GET', params),
	mushroomDetail: (params) => request('/api/mushroom/detail', 'GET', params),
	searchMushroom: (keyword) => request('/api/mushroom/search', 'GET', { keyword }),
	
	// 识别相关
	predict: (filePath, formData) => upload('/api/recognition/predict', filePath, 'image', formData),
	predictCloud: (filePath, userId, inferModel = 1, deviceInfo = '') => 
		upload('/api/recognition/predict', filePath, 'image', { userId, inferModel, deviceInfo }),
	report: (filePath, formData) => upload('/api/recognition/report', filePath, 'image', formData),
	rePredict: (recordId) => request('/api/recognition/rePredict', 'POST', { recordId }),
	
	// 记录相关
	recordList: (params) => request('/api/record/list', 'GET', params),
	recordListAll: (params) => request('/api/record/listAll', 'GET', params),
	recordDetail: (params) => request('/api/record/detail', 'GET', params),
	deleteRecord: (recordId) => request('/api/record/delete', 'DELETE', { recordId }),
	
	// 反馈相关
	feedbackSubmit: (payload) => request('/api/feedback/submit', 'POST', payload),
	feedbackList: (params) => request('/api/feedback/my', 'GET', params),
	
	// 统计相关
	getUserStatistics: (userId) => request('/api/statistics/user', 'GET', { userId }),
}

// 也可以按需导出单个接口
export const {
	userLogin,
	getUserInfo,
	updateUserInfo,
	getUserProfile,
	updateNickname,
	updateGender,
	updateAvatar,
	mushroomList,
	mushroomListAll,
	mushroomDetail,
	searchMushroom,
	predict,
	predictCloud,
	report,
	rePredict,
	recordList,
	recordListAll,
	recordDetail,
	deleteRecord,
	feedbackSubmit,
	feedbackList,
	getUserStatistics
} = api

export default api
