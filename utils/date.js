/**
 * 时间格式化工具
 * 兼容 iOS 日期格式
 */

/**
 * 将时间字符串转换为 Date 对象（兼容 iOS）
 * @param {string} timeStr - 时间字符串，支持格式：
 *   - "2024-01-12 15:20:00"
 *   - "2024-01-12"
 *   - "2024/01/12 15:20:00"
 * @returns {Date} Date 对象
 */
export function parseDate(timeStr) {
	if (!timeStr) return new Date()
	
	// iOS 不支持 "2024-01-12 15:20:00" 格式
	// 需要转换为 "2024/01/12 15:20:00" 格式
	const iosTimeStr = timeStr.replace(/-/g, '/')
	return new Date(iosTimeStr)
}

/**
 * 格式化相对时间（刚刚、5分钟前、3小时前等）
 * @param {string|Date} time - 时间字符串或 Date 对象
 * @returns {string} 格式化后的时间文本
 */
export function formatRelativeTime(time) {
	if (!time) return '-'
	
	// 如果是字符串，先转换为 Date
	const date = typeof time === 'string' ? parseDate(time) : time
	
	// 验证日期是否有效
	if (isNaN(date.getTime())) {
		return typeof time === 'string' ? time.split(' ')[0] : '-'
	}
	
	const now = new Date()
	const diff = now - date
	
	// 刚刚
	if (diff < 60000) return '刚刚'
	
	// X分钟前
	if (diff < 3600000) {
		return `${Math.floor(diff / 60000)}分钟前`
	}
	
	// X小时前
	if (diff < 86400000) {
		return `${Math.floor(diff / 3600000)}小时前`
	}
	
	// X天前
	if (diff < 604800000) {
		return `${Math.floor(diff / 86400000)}天前`
	}
	
	// 超过一周，返回日期
	return formatDate(date)
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {string|Date} time - 时间字符串或 Date 对象
 * @returns {string} YYYY-MM-DD 格式
 */
export function formatDate(time) {
	if (!time) return '-'
	
	const date = typeof time === 'string' ? parseDate(time) : time
	
	if (isNaN(date.getTime())) {
		return typeof time === 'string' ? time.split(' ')[0] : '-'
	}
	
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	
	return `${year}-${month}-${day}`
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 * @param {string|Date} time - 时间字符串或 Date 对象
 * @returns {string} YYYY-MM-DD HH:mm:ss 格式
 */
export function formatDateTime(time) {
	if (!time) return '-'
	
	const date = typeof time === 'string' ? parseDate(time) : time
	
	if (isNaN(date.getTime())) {
		return typeof time === 'string' ? time : '-'
	}
	
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hour = String(date.getHours()).padStart(2, '0')
	const minute = String(date.getMinutes()).padStart(2, '0')
	const second = String(date.getSeconds()).padStart(2, '0')
	
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 格式化时间为 HH:mm:ss
 * @param {string|Date} time - 时间字符串或 Date 对象
 * @returns {string} HH:mm:ss 格式
 */
export function formatTime(time) {
	if (!time) return '-'
	
	const date = typeof time === 'string' ? parseDate(time) : time
	
	if (isNaN(date.getTime())) {
		return '-'
	}
	
	const hour = String(date.getHours()).padStart(2, '0')
	const minute = String(date.getMinutes()).padStart(2, '0')
	const second = String(date.getSeconds()).padStart(2, '0')
	
	return `${hour}:${minute}:${second}`
}

export default {
	parseDate,
	formatRelativeTime,
	formatDate,
	formatDateTime,
	formatTime
}
