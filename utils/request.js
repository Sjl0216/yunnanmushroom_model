/**
 * 网络请求封装
 * 统一处理请求、响应、错误
 */

// 统一 baseURL 指向后端服务器

export const BASE_URL = 'http://10.146.250.6:8080'; // 真机调试使用局域网 IP

// 请求超时时间
const TIMEOUT = 30000

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
 * 处理 token 过期
 */
function handleTokenExpired() {
	// 清除本地存储
	uni.removeStorageSync('token')
	uni.removeStorageSync('userInfo')
	
	// 提示用户
	uni.showModal({
		title: '提示',
		content: '登录已过期，请重新登录',
		showCancel: false,
		success: () => {
			// 跳转到登录页
			uni.reLaunch({
				url: '/pages/login/login'
			})
		}
	})
}

/**
 * 核心请求方法
 * @param {string} url - 请求路径
 * @param {string} method - 请求方法 GET/POST/PUT/DELETE
 * @param {object} data - 请求数据
 * @param {object} header - 自定义请求头
 */
export function request(url, method = 'GET', data = {}, header = {}) {
	return new Promise((resolve, reject) => {
		// 获取 token
		const token = uni.getStorageSync('token')
		
		// 构建请求头
		const headers = {
			'Content-Type': 'application/json',
			...header
		}
		
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}
		
		// 构建完整的请求 URL
		const fullUrl = BASE_URL + url;
		
		// 打印请求信息
		console.log(`${method} ${fullUrl}`, {
			params: data
		});
			
		// 打印详细参数日志
		console.log('[HTTP]', method, url, 'params=', JSON.stringify(data || {}));
			
		// 打印请求头（调试用）
		console.log('[HTTP] headers=', JSON.stringify(headers));
		
		// 发起请求
		uni.request({
			url: fullUrl,
			method,
			data,
			header: headers,
			timeout: TIMEOUT,
			success: (response) => {
				console.log('请求成功:', {
					url: BASE_URL + url,
					method,
					statusCode: response.statusCode,
					data: response.data
				})
				
				const { statusCode, data } = response
				
				// HTTP 状态码错误
				if (statusCode !== 200) {
					const message = `请求失败 (${statusCode})`
					console.error('HTTP 状态码错误:', statusCode)
					showError(message)
					reject(new Error(message))
					return
				}
				
				// 业务状态码判断
				// 后端约定：code: 0 表示成功，code: 1 表示失败
				if (data.code !== undefined) {
					if (data.code === 0) {
						// 成功
						console.log('接口返回成功, data:', data.data)
						resolve(data.data || data)
					} else if (data.code === 401) {
						// token 过期
						console.error('Token 过期')
						handleTokenExpired()
						reject(new Error(data.msg || '登录已过期'))
					} else {
						// 其他业务错误（code: 1 或其他）
						const message = data.msg || data.message || '请求失败'
						console.error('业务错误:', {
							code: data.code,
							msg: message,
							data: data
						})
						showError(message)
						reject(new Error(message))
					}
				} else {
					// 如果没有 code 字段，直接返回 data
					console.log('没有 code 字段，直接返回数据')
					resolve(data)
				}
			},
			fail: (error) => {
				console.error('请求错误:', error)
				
				let message = '网络请求失败'
				
				if (error.errMsg) {
					if (error.errMsg.includes('timeout')) {
						message = '请求超时，请检查网络'
					} else if (error.errMsg.includes('fail')) {
						message = '网络连接失败'
					}
				}
				
				showError(message)
				reject(error)
			}
		})
	})
}

/**
 * 文件上传
 * @param {string} url - 请求路径
 * @param {string} filePath - 文件路径
 * @param {string} name - 文件字段名
 * @param {object} formData - 额外的表单数据
 */
export function upload(url, filePath, name = 'image', formData = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fullUrl = BASE_URL + url;
    console.log('[UPLOAD]', fullUrl, { filePath, formData });
    
    uni.uploadFile({
      url: fullUrl,
      filePath,
      name,
      formData,
      header: headers,
      success: (res) => {
        console.log('上传成功:', res);
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0) {
            resolve(data.data || data);
          } else {
            const message = data.msg || '上传失败';
            showError(message);
            reject(new Error(message));
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          reject(e);
        }
      },
      fail: (error) => {
        console.error('上传失败:', error);
        showError('上传失败');
        reject(error);
      }
    });
  });
}

/**
 * 检查网络连接
 * @returns {Promise<{isConnected: boolean, networkType: string}>}
 */
export function checkNetwork() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        const isConnected = networkType !== 'none';
        const isGood = ['wifi', '4g', '5g'].includes(networkType);
        resolve({ isConnected, networkType, isGood });
      },
      fail: () => {
        resolve({ isConnected: false, networkType: 'unknown', isGood: false });
      }
    });
  });
}

export default request
