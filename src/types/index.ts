// 核心数据模型定义

export interface InterviewSession {
  id: string;
  candidateName: string;
  position: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'paused' | 'completed';
  segments: TranscriptionSegment[];
  summary?: InterviewSummary;
}

export interface TranscriptionSegment {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  speaker: 'interviewer' | 'candidate';
  confidence: number;
  isProcessing?: boolean;
  // 🎯 流式显示支持
  isTemporary?: boolean;      // 标记为临时段落（正在处理中）
  isTranscribing?: boolean;   // 正在转录
  isTranslating?: boolean;    // 正在翻译
  englishText?: string;       // 英文原文（兼容新格式）
  chineseText?: string;       // 中文翻译（兼容新格式）
}

export interface InterviewSummary {
  id: string;
  interviewId: string;
  content: string;
  evaluation: string;
  keyPoints: string[];
  suggestedQuestions: string[];
  createdAt: Date;
}

export interface QuestionSuggestion {
  id: string;
  question: string;
  questionChinese: string;
  context: string;
  relevanceScore: number;
  category: 'technical' | 'behavioral' | 'experience' | 'follow-up';
}

// API相关类型
export interface TranscriptionResult {
  text: string;
  confidence: number;
  segments?: {
    start: number;
    end: number;
    text: string;
  }[];
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  originalText: string;
}

// 应用状态类型
export interface AppConfig {
  openaiApiKey: string;
  language: {
    source: 'en' | 'zh';
    target: 'en' | 'zh';
  };
  audio: {
    sampleRate: number;
    channels: number;
    format: 'webm' | 'wav' | 'mp3';
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    autoScroll: boolean;
    showConfidence: boolean;
  };
}

// 错误处理类型
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// 事件类型
export type InterviewEvent = 
  | { type: 'session_started'; data: InterviewSession }
  | { type: 'segment_added'; data: TranscriptionSegment }
  | { type: 'session_paused'; data: { sessionId: string } }
  | { type: 'session_resumed'; data: { sessionId: string } }
  | { type: 'session_completed'; data: InterviewSession }
  | { type: 'error_occurred'; data: AppError };

// 插件系统类型（为未来扩展预留）
export interface InterviewPlugin {
  name: string;
  version: string;
  onSegmentAdded?(segment: TranscriptionSegment): void | Promise<void>;
  onSessionComplete?(session: InterviewSession): void | Promise<void>;
  renderUI?(): React.ReactNode;
}

// 导出格式类型
export type ExportFormat = 'json' | 'txt' | 'pdf' | 'docx';

export interface ExportOptions {
  format: ExportFormat;
  includeTranslations: boolean;
  includeTimestamps: boolean;
  includeSummary: boolean;
}