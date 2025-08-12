// ⚙️ 用户设置管理服务 - 专注于应用配置和用户偏好管理

import { UserProfileService } from './user-profile.service';

export interface ISettingsService {
  setUserId(userId: string | null): void;
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): Promise<void>;
  getSettings(): Promise<Record<string, any>>;
  updateSettings(settings: Record<string, any>): Promise<void>;
  resetSettings(): Promise<void>;
  getDefaultSettings(): Record<string, any>;
}

/**
 * 用户设置管理服务
 * 
 * 功能范围：
 * - 音频设置（录制质量、音源选择等）
 * - 界面偏好（主题、语言等）
 * - 转录设置（实时翻译开关等）
 * - AI分析设置（模型选择、分析深度等）
 */
export class SettingsService implements ISettingsService {
  private userProfileService: UserProfileService;

  // 默认设置配置
  private static readonly DEFAULT_SETTINGS = {
    // 音频设置
    audio: {
      quality: 'high',              // high, medium, low
      enableSystemAudio: true,       // 是否启用系统音频捕获
      enableMicrophone: true,        // 是否启用麦克风
      noiseSuppression: true,        // 噪声抑制
      echoCancellation: true,        // 回声消除
      sampleRate: 44100,            // 采样率
    },

    // 转录设置  
    transcription: {
      enableRealTimeTranslation: true,  // 实时翻译
      language: 'zh-CN',                // 目标语言
      confidenceThreshold: 0.8,         // 置信度阈值
      enablePunctuation: true,           // 自动标点
      enableTimestamps: true,            // 时间戳
    },

    // AI分析设置
    ai: {
      model: 'gpt-4',                   // AI模型选择
      analysisDepth: 'standard',         // standard, detailed, quick
      enableSummary: true,               // 启用总结
      enableScoring: true,               // 启用评分
      autoAnalysis: false,               // 自动分析
    },

    // 界面设置
    ui: {
      theme: 'system',                  // light, dark, system
      language: 'zh-CN',                // 界面语言
      fontSize: 'medium',               // small, medium, large
      showNotifications: true,           // 显示通知
      autoSave: true,                   // 自动保存
    },

    // 隐私设置
    privacy: {
      enableCloudSync: true,            // 云端同步
      dataRetentionDays: 30,            // 数据保留天数
      shareAnalytics: false,            // 分享分析数据
      enableTelemetry: true,            // 遥测数据
    },

    // 快捷键设置
    shortcuts: {
      startRecording: 'Space',          // 开始录制
      stopRecording: 'Space',           // 停止录制
      toggleMute: 'M',                  // 静音切换
      exportSession: 'Ctrl+E',          // 导出会话
    },

    // 高级设置
    advanced: {
      debugMode: false,                 // 调试模式
      experimentalFeatures: false,      // 实验性功能
      cacheSize: 100,                   // 缓存大小(MB)
      maxSessionDuration: 7200,         // 最大会话时长(秒)
    }
  };

  constructor() {
    this.userProfileService = new UserProfileService();
  }

  setUserId(userId: string | null): void {
    this.userProfileService.setUserId(userId);
  }

  /**
   * 获取单个设置项
   */
  async getSetting(key: string): Promise<any> {
    try {
      const settings = await this.getSettings();
      return this.getNestedValue(settings, key);
    } catch (error) {
      console.error('❌ 获取设置失败:', error);
      return this.getNestedValue(SettingsService.DEFAULT_SETTINGS, key);
    }
  }

  /**
   * 设置单个配置项
   */
  async setSetting(key: string, value: any): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = this.setNestedValue(currentSettings, key, value);
      await this.updateSettings(updatedSettings);
    } catch (error) {
      console.error('❌ 设置配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有设置
   */
  async getSettings(): Promise<Record<string, any>> {
    try {
      const userSettings = await this.userProfileService.getSettings();
      // 合并默认设置和用户设置
      return this.mergeDeep(SettingsService.DEFAULT_SETTINGS, userSettings);
    } catch (error) {
      console.error('❌ 获取用户设置失败:', error);
      return SettingsService.DEFAULT_SETTINGS;
    }
  }

  /**
   * 批量更新设置
   */
  async updateSettings(settings: Record<string, any>): Promise<void> {
    try {
      // 验证设置格式
      const validatedSettings = this.validateSettings(settings);
      await this.userProfileService.updateSettings(validatedSettings);
    } catch (error) {
      console.error('❌ 更新设置失败:', error);
      throw error;
    }
  }

  /**
   * 重置设置到默认值
   */
  async resetSettings(): Promise<void> {
    try {
      await this.updateSettings(SettingsService.DEFAULT_SETTINGS);
    } catch (error) {
      console.error('❌ 重置设置失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认设置
   */
  getDefaultSettings(): Record<string, any> {
    return JSON.parse(JSON.stringify(SettingsService.DEFAULT_SETTINGS));
  }

  /**
   * 获取特定分类的设置
   */
  async getCategorySettings(category: keyof typeof SettingsService.DEFAULT_SETTINGS): Promise<Record<string, any>> {
    const allSettings = await this.getSettings();
    return allSettings[category] || {};
  }

  /**
   * 更新特定分类的设置
   */
  async updateCategorySettings(category: keyof typeof SettingsService.DEFAULT_SETTINGS, settings: Record<string, any>): Promise<void> {
    const allSettings = await this.getSettings();
    allSettings[category] = { ...allSettings[category], ...settings };
    await this.updateSettings(allSettings);
  }

  /**
   * 导出设置（用于备份）
   */
  async exportSettings(): Promise<string> {
    const settings = await this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * 导入设置（从备份还原）
   */
  async importSettings(settingsJson: string): Promise<void> {
    try {
      const settings = JSON.parse(settingsJson);
      const validatedSettings = this.validateSettings(settings);
      await this.updateSettings(validatedSettings);
    } catch (error) {
      console.error('❌ 导入设置失败:', error);
      throw new Error('无效的设置格式');
    }
  }

  // 工具方法
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj));
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  }

  private mergeDeep(target: any, source: any): any {
    const result = JSON.parse(JSON.stringify(target));
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private validateSettings(settings: Record<string, any>): Record<string, any> {
    // 基本验证，确保设置结构合理
    const validated: Record<string, any> = {};

    // 只保留已知的设置分类
    for (const category in SettingsService.DEFAULT_SETTINGS) {
      if (settings[category] && typeof settings[category] === 'object') {
        validated[category] = { ...settings[category] };
      }
    }

    return validated;
  }
}