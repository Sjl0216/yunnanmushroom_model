/**
 * 文件上传封装
 */

// 统一 baseURL 指向 Nginx
export const BASE_URL = 'http://localhost:8080'//

/**
 * 显示错误提示
 */
function showError(message) {
	uni.showToast({
		title: message,
		icon: 'none',
		duration: 2000
	})
}

/**
 * 文件上传方法
 * @param {string} url - 上传路径
 * @param {string} filePath - 本地文件路径
 * @param {object} formData - 额外的表单数据
 */
export function upload(url, filePath, formData = {}) {
	return new Promise((resolve, reject) => {
		// 获取 token
		const token = uni.getStorageSync('token')
		const headers = {}
		
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}
		
		// 发起上传
		const uploadTask = uni.uploadFile({
			url: BASE_URL + url,
			filePath,
			name: 'image',
			formData,
			header: headers,
			success: (response) => {
				const { statusCode, data } = response
				
				// HTTP 状态码错误
				if (statusCode !== 200) {
					const message = `上传失败 (${statusCode})`
					showError(message)
					reject(new Error(message))
					return
				}
				
				// 解析响应数据
				try {
					const result = JSON.parse(data)
					
					// 业务状态码判断
					if (result.code !== undefined) {
						if (result.code === 200 || result.code === 0) {
							// 成功
							resolve(result.data || result)
						} else {
							// 业务错误
							const message = result.msg || result.message || '上传失败'
							showError(message)
							reject(new Error(message))
						}
					} else {
						// 如果没有 code 字段，直接返回
						resolve(result)
					}
				} catch (error) {
					console.error('解析上传响应失败:', error)
					showError('上传失败')
					reject(error)
				}
			},
			fail: (error) => {
				console.error('上传错误:', error)
				
				let message = '上传失败'
				
				if (error.errMsg) {
					if (error.errMsg.includes('timeout')) {
						message = '上传超时，请检查网络'
					} else if (error.errMsg.includes('fail')) {
						message = '上传连接失败'
					}
				}
				
				showError(message)
				reject(error)
			}
		})
		
		// 监听上传进度
		uploadTask.onProgressUpdate((res) => {
			console.log('上传进度:', res.progress + '%')
		})
	})
}

export default upload
