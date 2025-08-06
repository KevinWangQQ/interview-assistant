// API密钥管理工具类
// 统一管理OpenAI API密钥的获取逻辑，避免代码重复

export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private cachedApiKey: string | null = null;
  
  private constructor() {}
  
  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }
  
  /**
   * 获取OpenAI API密钥
   * 优先级：环境变量 > localStorage > 应用配置
   */
  public getOpenAIApiKey(): string {
    // SSR环境下不执行
    if (typeof window === 'undefined') {
      throw new Error('API key access not available during SSR');
    }
    
    // 如果有缓存的密钥，直接返回
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }
    
    let apiKey: string | null = null;
    
    // 优先从环境变量获取
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENAI_API_KEY) {
      apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    }
    
    // 客户端访问localStorage
    try {
      // 其次从localStorage获取
      if (!apiKey) {
        apiKey = localStorage.getItem('openai_api_key');
      }
      
      // 最后从应用配置获取
      if (!apiKey) {
        const configStr = localStorage.getItem('interview-assistant-config');
        if (configStr) {
          const config = JSON.parse(configStr);
          apiKey = config.openaiApiKey;
        }
      }
    } catch {
      // 不输出console.log以避免SSR不匹配
    }
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OpenAI API key not found. Please set it in Settings page or save it in localStorage as "openai_api_key".');
    }
    
    const trimmedKey = apiKey.trim();
    // 缓存有效的密钥
    this.cachedApiKey = trimmedKey;
    
    return trimmedKey;
  }
  
  /**
   * 验证API密钥格式
   */
  public validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    const trimmed = apiKey.trim();
    // OpenAI API密钥通常以 'sk-' 开头，长度约为51个字符
    return trimmed.startsWith('sk-') && trimmed.length >= 45;
  }
  
  /**
   * 清除缓存的API密钥（用于密钥更新时）
   */
  public clearCache(): void {
    this.cachedApiKey = null;
  }
  
  /**
   * 获取API密钥的显示版本（隐藏大部分字符）
   */
  public getDisplayableApiKey(): string {
    try {
      const apiKey = this.getOpenAIApiKey();
      if (apiKey.length > 10) {
        return `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
      }
      return '***';
    } catch {
      return '未设置';
    }
  }
  
  /**
   * 检查API密钥是否已配置
   */
  public hasValidApiKey(): boolean {
    try {
      const apiKey = this.getOpenAIApiKey();
      return this.validateApiKey(apiKey);
    } catch {
      return false;
    }
  }
  
  /**
   * 更新API密钥到localStorage和配置
   */
  public updateApiKey(newApiKey: string): void {
    if (!this.validateApiKey(newApiKey)) {
      throw new Error('Invalid API key format');
    }
    
    if (typeof window !== 'undefined') {
      try {
        // 更新独立的localStorage条目
        localStorage.setItem('openai_api_key', newApiKey);
        
        // 更新应用配置
        const configStr = localStorage.getItem('interview-assistant-config');
        let config = {};
        if (configStr) {
          config = JSON.parse(configStr);
        }
        
        config = { ...config, openaiApiKey: newApiKey };
        localStorage.setItem('interview-assistant-config', JSON.stringify(config));
        
        // 更新缓存
        this.cachedApiKey = newApiKey;
        
        console.log('API密钥已更新');
      } catch (error) {
        console.error('更新API密钥失败:', error);
        throw new Error('Failed to save API key');
      }
    }
  }
}

// 导出单例实例
export const apiKeyManager = ApiKeyManager.getInstance();