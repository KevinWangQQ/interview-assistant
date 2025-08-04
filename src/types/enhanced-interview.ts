// 🎯 增强版面试数据类型定义

import { TranscriptionSegment } from '@/utils/smart-segmentation';
import { InterviewSummary } from '@/services/interview-summary/gpt4-summary-service';

// 音频质量指标
export interface AudioQualityMetrics {
  volume: number;
  clarity: number;
  timestamp: number;
  duration: number;
}

// 录制会话信息
export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // 秒
  status: 'recording' | 'paused' | 'stopped' | 'completed';
  
  // 音频配置
  audioConfig: {
    microphoneEnabled: boolean;
    systemAudioEnabled: boolean;
    sampleRate: number;
    channels: number;
    format: string;
  };
  
  // 质量监控
  audioQualityHistory: AudioQualityMetrics[];
  averageAudioQuality: number;
}

// 增强版面试会话
export interface EnhancedInterviewSession {
  id: string;
  timestamp: Date;
  lastUpdated: Date;
  
  // 基本信息
  candidateName: string;
  position: string;
  interviewerName?: string;
  company?: string;
  
  // 录制信息
  recordingSession: RecordingSession;
  
  // 转录数据
  segments: TranscriptionSegment[];
  rawTranscriptionText: string; // 完整英文转录
  rawTranslationText: string;   // 完整中文翻译
  
  // 智能分析
  summary?: InterviewSummary;
  summaryGenerationStatus?: {
    jobId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    error?: string;
    startTime: Date;
    completedTime?: Date;
  };
  
  // 统计信息
  statistics: {
    totalWords: number;
    totalQuestions: number;
    speakerChangeCount: number;
    averageSegmentDuration: number;
    longestSegmentDuration: number;
    
    // 说话时间分布
    speakingTimeDistribution: {
      interviewer: number; // 秒
      candidate: number;   // 秒
      unknown: number;     // 秒
    };
    
    // 互动质量指标
    interactionMetrics: {
      responseTime: number[]; // 响应时间数组
      questionDepth: number;  // 问题深度评分
      engagementScore: number; // 参与度评分
    };
  };
  
  // 标签和分类
  tags: string[];
  category: 'technical' | 'behavioral' | 'mixed' | 'screening' | 'final';
  difficulty: 'junior' | 'mid' | 'senior' | 'executive';
  
  // 元数据
  metadata: {
    deviceInfo?: string;
    browserInfo?: string;
    networkQuality?: 'excellent' | 'good' | 'fair' | 'poor';
    recordingQuality: 'high' | 'medium' | 'low';
    processingVersion: string;
  };
  
  // 状态管理
  status: 'active' | 'completed' | 'archived' | 'deleted';
  isBookmarked: boolean;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
}

// 面试会话搜索过滤器
export interface InterviewSessionFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  candidateName?: string;
  position?: string;
  company?: string;
  category?: EnhancedInterviewSession['category'];
  difficulty?: EnhancedInterviewSession['difficulty'];
  status?: EnhancedInterviewSession['status'];
  tags?: string[];
  minDuration?: number;
  maxDuration?: number;
  hasAudioIssues?: boolean;
  hasSummary?: boolean;
  confidentialityLevel?: EnhancedInterviewSession['confidentialityLevel'];
}

// 批量操作选项
export interface BatchOperationOptions {
  sessionIds: string[];
  operation: 'delete' | 'archive' | 'export' | 'regenerate_summary' | 'update_tags';
  parameters?: {
    tags?: string[];
    archiveReason?: string;
    exportFormat?: 'json' | 'pdf' | 'csv';
    summaryOptions?: any;
  };
}

// 导出配置
export interface ExportConfiguration {
  format: 'json' | 'pdf' | 'docx' | 'csv' | 'txt';
  includeSegments: boolean;
  includeSummary: boolean;
  includeStatistics: boolean;
  includeAudioMetrics: boolean;
  anonymize: boolean;
  
  // PDF特定选项
  pdfOptions?: {
    includeTimestamps: boolean;
    includeOriginalText: boolean;
    includeTranslation: boolean;
    pageBreakBetweenSections: boolean;
    watermark?: string;
  };
  
  // 匿名化选项
  anonymizationOptions?: {
    replaceCandidateName: string;
    replaceCompanyName: string;
    removePersonalDetails: boolean;
    maskSensitiveInfo: boolean;
  };
}

// 分析报告配置
export interface AnalysisReportConfig {
  timeRange: {
    start: Date;
    end: Date;
  };
  groupBy: 'month' | 'week' | 'position' | 'company' | 'interviewer';
  metrics: Array<'count' | 'duration' | 'success_rate' | 'quality_score' | 'response_time'>;
  includeComparison: boolean;
  includeRecommendations: boolean;
}

// 存储配置
export interface StorageConfiguration {
  maxSessions: number;
  maxSessionSize: number; // MB
  autoCleanup: boolean;
  cleanupAfterDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  
  // 备份配置
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  maxBackupCount: number;
}

// 系统状态
export interface SystemStatus {
  storage: {
    used: number;     // MB
    available: number; // MB
    sessions: number;
    oldestSession: Date;
    newestSession: Date;
  };
  
  processing: {
    activeJobs: number;
    queuedJobs: number;
    failedJobs: number;
    avgProcessingTime: number;
  };
  
  quality: {
    avgAudioQuality: number;
    avgTranscriptionAccuracy: number;
    avgSummaryConfidence: number;
  };
  
  health: 'excellent' | 'good' | 'warning' | 'critical';
  lastMaintenance: Date;
}