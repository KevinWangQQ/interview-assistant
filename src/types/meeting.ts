// 📋 会议纪要数据类型定义

export interface Participant {
  id: string;
  name: string;
  role?: string;
  email?: string;
  isOrganizer?: boolean;
  joinTime?: Date;
  leaveTime?: Date;
  speakingTime?: number; // 发言时长（秒）
  participationLevel?: 'high' | 'medium' | 'low';
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  decidedAt: Date;
  decidedBy: string[];
  consensus: boolean;
  voteResults?: {
    for: number;
    against: number;
    abstain: number;
  };
}

export interface ActionItem {
  id: string;
  task: string;
  assignedTo: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  description?: string;
  createdAt: Date;
}

export interface TopicSegment {
  id: string;
  topic: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // 秒
  keyPoints: string[];
  speakers: string[];
  transcriptSegmentIds: string[]; // 对应的转录片段ID
}

export interface SpeakerInsight {
  participantId: string;
  totalSpeakingTime: number; // 秒
  speechCount: number; // 发言次数
  averageSpeechLength: number; // 平均发言长度
  keyTopics: string[]; // 主要讨论的话题
  sentiment: 'positive' | 'neutral' | 'negative';
  participationRate: number; // 参与率 0-1
}

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string;
  startTime: Date;
  endTime: Date;
  confidence?: number;
  isProcessed: boolean; // 是否已处理到纪要中
  topicId?: string; // 所属话题ID
}

export interface MeetingMinutes {
  id: string;
  
  // 基本信息
  title: string;
  meetingType: 'regular' | 'project' | 'emergency' | 'review' | 'brainstorm' | 'standup';
  date: Date;
  startTime: Date;
  endTime?: Date;
  duration?: number; // 实际时长（秒）
  location?: string;
  meetingLink?: string;
  
  // 参会信息
  organizer: string;
  participants: Participant[];
  expectedParticipants?: string[]; // 预期参会人员
  
  // 会议内容
  agenda: string[];
  objectives: string[]; // 会议目标
  keyPoints: string[]; // 关键要点
  decisions: Decision[]; // 决策记录
  actionItems: ActionItem[]; // 行动项
  nextSteps: string[]; // 后续步骤
  
  // 结构化内容
  topicSegments: TopicSegment[]; // 话题分段
  speakerInsights: SpeakerInsight[]; // 发言分析
  
  // 附加信息
  nextMeetingDate?: Date;
  followUpRequired: boolean;
  meetingRating?: number; // 会议效果评分 1-5
  notes?: string; // 补充备注
  
  // 元数据
  createdAt: Date;
  updatedAt: Date;
  version: number;
  status: 'draft' | 'final' | 'approved';
}

export interface MeetingSession {
  id: string;
  type: 'meeting'; // 区别于 'interview'
  
  // 会议基本信息
  meetingTitle: string;
  meetingType: 'regular' | 'project' | 'emergency' | 'review' | 'brainstorm' | 'standup';
  description?: string;
  
  // 参会信息
  organizer: string;
  participants: Participant[];
  expectedDuration?: number; // 计划时长（分钟）
  
  // 转录数据
  fullTranscript: TranscriptSegment[];
  pendingTranscript: string; // 待处理的实时转录
  lastProcessedIndex: number; // 上次处理到的转录索引
  
  // 会议纪要
  minutes: MeetingMinutes;
  
  // 录制会话信息
  recordingSession: {
    id: string;
    startTime: Date;
    endTime?: Date;
    duration: number; // 秒
    status: 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
    
    // 音频配置
    audioConfig: {
      microphoneEnabled: boolean;
      systemAudioEnabled: boolean;
      sampleRate: number;
      channels: number;
      format: string;
    };
    
    // 质量监控
    audioQuality: number;
    transcriptionQuality: number;
  };
  
  // 处理配置
  processingConfig: {
    minutesUpdateInterval: number; // 纪要更新间隔（秒）
    autoTopicDetection: boolean; // 自动话题检测
    autoActionItemExtraction: boolean; // 自动行动项提取
    autoDecisionCapture: boolean; // 自动决策捕获
    summaryStyle: 'detailed' | 'concise' | 'bullet_points'; // 总结风格
  };
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  lastMinutesUpdate: Date;
  
  // 状态
  isActive: boolean;
  isPaused: boolean;
  isProcessing: boolean; // 是否正在处理纪要
  
  // 统计信息
  stats: {
    totalWords: number;
    totalSpeakers: number;
    topicChanges: number;
    decisionsCount: number;
    actionItemsCount: number;
    participationBalance: number; // 参与平衡度 0-1
  };
}

export interface MeetingFilter {
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  meetingType?: ('regular' | 'project' | 'emergency' | 'review' | 'brainstorm' | 'standup')[];
  organizer?: string;
  participants?: string[];
  hasActionItems?: boolean;
  status?: ('scheduled' | 'active' | 'paused' | 'completed' | 'cancelled')[];
  searchQuery?: string;
  tags?: string[];
}

export interface MeetingExportConfig {
  format: 'docx' | 'pdf' | 'html' | 'markdown' | 'txt' | 'json';
  includeTranscript: boolean;
  includeMinutes: boolean;
  includeActionItems: boolean;
  includeParticipants: boolean;
  includeStats: boolean;
  template?: 'standard' | 'executive' | 'detailed' | 'action_focused';
}

// 实时处理事件类型
export interface MeetingEvent {
  type: 'transcription_update' | 'minutes_update' | 'topic_change' | 'decision_detected' | 'action_item_detected';
  timestamp: Date;
  data: any;
}

// 会议模板类型
export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  meetingType: 'regular' | 'project' | 'emergency' | 'review' | 'brainstorm' | 'standup';
  defaultAgenda: string[];
  defaultObjectives: string[];
  defaultDuration: number; // 分钟
  processingConfig: MeetingSession['processingConfig'];
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}