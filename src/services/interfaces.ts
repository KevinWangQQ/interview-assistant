// V2.0 服务接口定义 - 支持多用户和云端存储架构

import { 
  InterviewSession, 
  TranscriptionSegment, 
  TranscriptionResult, 
  TranslationResult,
  QuestionSuggestion,
  InterviewSummary 
} from '@/types';

import { 
  EnhancedInterviewSession, 
  InterviewSessionFilter, 
  BatchOperationOptions,
  ExportConfiguration,
  StorageConfiguration,
  SystemStatus
} from '@/types/enhanced-interview';

// V2.0 存储服务接口 - 支持云端存储和多用户数据隔离
export interface IEnhancedStorageService {
  // 用户会话管理
  isReady(): Promise<boolean>;
  getUserId(): string | null;
  
  // 面试会话管理
  saveSession(session: EnhancedInterviewSession): Promise<void>;
  getSession(sessionId: string): Promise<EnhancedInterviewSession | null>;
  listSessions(limit?: number, offset?: number): Promise<EnhancedInterviewSession[]>;
  deleteSession(sessionId: string): Promise<boolean>;
  updateSession(sessionId: string, updates: Partial<EnhancedInterviewSession>): Promise<void>;
  
  // 搜索和过滤
  searchSessions(filter: InterviewSessionFilter): Promise<EnhancedInterviewSession[]>;
  getSessionsByDateRange(startDate: Date, endDate: Date): Promise<EnhancedInterviewSession[]>;
  
  // 批量操作
  batchOperation(options: BatchOperationOptions): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }>;
  
  // 数据导出/导入
  exportSession(sessionId: string, config: ExportConfiguration): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }>;
  exportAllSessions(config: ExportConfiguration): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }>;
  importSessions(data: string): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }>;
  
  // 系统状态和统计
  getSystemStatus(): Promise<SystemStatus>;
  getStorageConfiguration(): StorageConfiguration;
  updateStorageConfiguration(config: Partial<StorageConfiguration>): Promise<void>;
  
  // V1.0兼容性 - 数据迁移
  migrateFromLocalStorage(): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }>;
}

// 用户配置服务接口
export interface IUserProfileService {
  // 用户配置管理
  getProfile(): Promise<UserProfile | null>;
  updateProfile(updates: Partial<UserProfile>): Promise<void>;
  
  // 岗位模板管理
  getPositionTemplates(): Promise<PositionTemplate[]>;
  getPositionTemplate(id: string): Promise<PositionTemplate | null>;
  createPositionTemplate(template: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<PositionTemplate>;
  updatePositionTemplate(id: string, updates: Partial<PositionTemplate>): Promise<void>;
  deletePositionTemplate(id: string): Promise<boolean>;
  
  // 设置管理
  getSetting(key: string): Promise<any>;
  setSetting(key: string, value: any): Promise<void>;
  getSettings(): Promise<Record<string, any>>;
  updateSettings(settings: Record<string, any>): Promise<void>;
}

// 用户配置数据类型
export interface UserProfile {
  id: string;
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  settings: Record<string, any>;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PositionTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  requirements?: string;
  evaluation_criteria: Record<string, any>;
  job_description?: string;
  skills_required?: string[];
  experience_level?: string;
  department?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 向后兼容的存储服务接口
export interface IStorageService {
  // 面试会话管理
  saveInterview(interview: InterviewSession): Promise<void>;
  getInterview(id: string): Promise<InterviewSession | null>;
  listInterviews(limit?: number, offset?: number): Promise<InterviewSession[]>;
  deleteInterview(id: string): Promise<void>;
  updateInterview(id: string, updates: Partial<InterviewSession>): Promise<void>;
  
  // 搜索和过滤
  searchInterviews(query: string): Promise<InterviewSession[]>;
  getInterviewsByDateRange(startDate: Date, endDate: Date): Promise<InterviewSession[]>;
  
  // 数据导出/导入
  exportData(): Promise<string>;
  importData(data: string): Promise<void>;
  
  // 存储统计
  getStorageStats(): Promise<{
    totalInterviews: number;
    totalSize: number;
    lastBackup?: Date;
  }>;
}

// 音频服务接口 - 支持不同ASR提供商
export interface IAudioService {
  // 录音控制
  startRecording(options?: RecordingOptions): Promise<MediaStream>;
  stopRecording(): Promise<void>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  
  // 音频处理
  transcribe(audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptionResult>;
  
  // 音频状态
  isRecording(): boolean;
  isPaused(): boolean;
  getRecordingDuration(): number;
  
  // 音频格式转换
  convertAudioFormat(audioBlob: Blob, targetFormat: 'wav' | 'mp3' | 'webm'): Promise<Blob>;
  
  // 事件监听
  onRecordingStart(callback: () => void): void;
  onRecordingStop(callback: () => void): void;
  onRecordingError(callback: (error: Error) => void): void;
}

// 翻译服务接口 - 支持不同翻译提供商
export interface ITranslationService {
  // 文本翻译
  translate(text: string, from: string, to: string): Promise<TranslationResult>;
  batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]>;
  
  // 智能功能
  suggestQuestions(context: string[], interviewType?: string): Promise<QuestionSuggestion[]>;
  generateSummary(segments: TranscriptionSegment[]): Promise<InterviewSummary>;
  
  // 语言检测
  detectLanguage(text: string): Promise<string>;
  
  // 服务状态
  isAvailable(): Promise<boolean>;
  getUsageStats(): Promise<{
    tokensUsed: number;
    requestsCount: number;
    costEstimate: number;
  }>;
}

// 事件服务接口 - 支持组件间通信
export interface IEventService {
  emit<T = any>(event: string, data: T): void;
  on<T = any>(event: string, handler: (data: T) => void): void;
  off(event: string, handler?: Function): void;
  once<T = any>(event: string, handler: (data: T) => void): void;
}

// 配置服务接口 - 支持动态配置
export interface IConfigService {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  remove(key: string): void;
  reset(): void;
  
  // 配置验证
  validate(): Promise<boolean>;
  getValidationErrors(): string[];
}

// 插件服务接口 - 支持功能扩展
export interface IPluginService {
  register(plugin: any): void;
  unregister(pluginName: string): void;
  getPlugin(name: string): any | null;
  listPlugins(): any[];
  
  // 插件生命周期
  enablePlugin(name: string): void;
  disablePlugin(name: string): void;
  isPluginEnabled(name: string): boolean;
}

// 服务选项类型
export interface RecordingOptions {
  sampleRate?: number;
  channels?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
  temperature?: number;
  prompt?: string;
}

export interface TranslationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string;
}

// 服务工厂接口 - 支持依赖注入
export interface IServiceFactory {
  createStorageService(type: 'local' | 'supabase' | 'firebase'): IStorageService;
  createAudioService(type: 'whisper' | 'azure' | 'google'): IAudioService;
  createTranslationService(type: 'openai' | 'azure' | 'google'): ITranslationService;
  createEventService(): IEventService;
  createConfigService(): IConfigService;
  createPluginService(): IPluginService;
}

// 服务容器接口 - 支持服务管理
export interface IServiceContainer {
  register<T>(name: string, service: T): void;
  get<T>(name: string): T;
  has(name: string): boolean;
  remove(name: string): void;
  
  // 生命周期管理
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}