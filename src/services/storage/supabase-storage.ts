// 🌐 Supabase存储服务 - V2.0云端多用户数据存储

import { createClientComponentClient } from '@/lib/supabase/client';
import { 
  IEnhancedStorageService,
  IUserProfileService,
  UserProfile,
  PositionTemplate
} from '@/services/interfaces';
import { 
  EnhancedInterviewSession, 
  InterviewSessionFilter, 
  BatchOperationOptions,
  ExportConfiguration,
  StorageConfiguration,
  SystemStatus
} from '@/types/enhanced-interview';
import { TranscriptionSegment } from '@/utils/smart-segmentation';
import { EnhancedInterviewStorageService } from './enhanced-interview-storage';

export class SupabaseStorageService implements IEnhancedStorageService {
  private supabase = createClientComponentClient();
  private userId: string | null = null;
  private isInitialized = false;
  private localStorageService = new EnhancedInterviewStorageService();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      this.userId = user?.id || null;
      this.isInitialized = true;
      console.log('🌐 Supabase存储服务初始化完成:', { userId: this.userId });
    } catch (error) {
      console.error('❌ Supabase存储服务初始化失败:', error);
      this.isInitialized = true; // 即使失败也标记为已初始化，避免无限等待
    }
  }

  // 用户会话管理
  async isReady(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.isInitialized && this.userId !== null;
  }

  getUserId(): string | null {
    return this.userId;
  }

  // 面试会话管理
  async saveSession(session: EnhancedInterviewSession): Promise<void> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      console.log('💾 保存面试会话到Supabase:', session.id);

      // 保存会话主数据
      const sessionData = {
        id: session.id,
        user_id: this.userId,
        position_template_id: null, // TODO: 关联岗位模板
        candidate_name: session.candidateName,
        position: session.position,
        interviewer_name: session.interviewerName,
        company: session.company,
        status: session.status,
        recording_status: session.recordingSession.status,
        recording_config: session.recordingSession.audioConfig,
        recording_stats: {
          duration: session.recordingSession.duration,
          averageAudioQuality: session.recordingSession.averageAudioQuality,
          audioQualityHistory: session.recordingSession.audioQualityHistory
        },
        duration_seconds: Math.floor(session.recordingSession.duration),
        summary: session.summary,
        summary_status: session.summaryGenerationStatus?.status || 'pending',
        summary_progress: session.summaryGenerationStatus?.progress || 0,
        total_words: session.statistics.totalWords,
        total_questions: session.statistics.totalQuestions,
        speaker_changes: session.statistics.speakerChangeCount,
        audio_quality_avg: session.recordingSession.averageAudioQuality,
        tags: session.tags,
        category: session.category,
        difficulty: session.difficulty,
        confidentiality_level: session.confidentialityLevel,
        metadata: session.metadata,
        is_bookmarked: session.isBookmarked,
        is_archived: session.status === 'archived',
        created_at: session.timestamp.toISOString(),
        updated_at: session.lastUpdated.toISOString()
      };

      // 使用upsert插入或更新会话
      const { error: sessionError } = await this.supabase
        .from('interview_sessions')
        .upsert(sessionData);

      if (sessionError) {
        throw sessionError;
      }

      // 批量插入转录片段
      if (session.segments.length > 0) {
        // 先删除旧的片段（如果是更新操作）
        await this.supabase
          .from('transcription_segments')
          .delete()
          .eq('session_id', session.id);

        const segmentsData = session.segments.map((segment, index) => ({
          session_id: session.id,
          english_text: segment.englishText,
          chinese_text: segment.chineseText,
          speaker: segment.speaker || 'unknown',
          start_time: segment.startTime,
          end_time: segment.endTime,
          duration: segment.endTime - segment.startTime,
          confidence_score: segment.confidence || 0.9,
          audio_quality: 0.8, // 默认音频质量
          is_complete: segment.isFinal,
          is_final: segment.isFinal,
          is_question: segment.englishText?.includes('?') || false,
          processed_at: new Date().toISOString(),
          processing_version: '2.0'
        }));

        const { error: segmentsError } = await this.supabase
          .from('transcription_segments')
          .insert(segmentsData);

        if (segmentsError) {
          console.error('❌ 保存转录片段失败:', segmentsError);
          // 不抛出错误，因为主会话已保存成功
        }
      }

      console.log('✅ 面试会话保存成功');

    } catch (error) {
      console.error('❌ 保存面试会话失败:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<EnhancedInterviewSession | null> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      // 获取会话主数据
      const { data: sessionData, error: sessionError } = await this.supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', this.userId)
        .single();

      if (sessionError || !sessionData) {
        return null;
      }

      // 获取转录片段
      const { data: segmentsData, error: segmentsError } = await this.supabase
        .from('transcription_segments')
        .select('*')
        .eq('session_id', sessionId)
        .order('start_time', { ascending: true });

      if (segmentsError) {
        console.error('❌ 获取转录片段失败:', segmentsError);
      }

      // 转换为EnhancedInterviewSession格式
      return this.convertToEnhancedSession(sessionData, segmentsData || []);

    } catch (error) {
      console.error('❌ 获取面试会话失败:', error);
      return null;
    }
  }

  async listSessions(limit = 50, offset = 0): Promise<EnhancedInterviewSession[]> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      const { data: sessionsData, error } = await this.supabase
        .from('interview_sessions')
        .select(`
          *,
          transcription_segments (
            id,
            english_text,
            chinese_text,
            speaker,
            start_time,
            end_time,
            confidence_score,
            is_complete,
            is_final
          )
        `)
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return sessionsData.map(session => 
        this.convertToEnhancedSession(session, session.transcription_segments || [])
      );

    } catch (error) {
      console.error('❌ 获取面试会话列表失败:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      // 由于设置了级联删除，只需要删除主会话记录
      const { error } = await this.supabase
        .from('interview_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      console.log('✅ 面试会话删除成功:', sessionId);
      return true;

    } catch (error) {
      console.error('❌ 删除面试会话失败:', error);
      return false;
    }
  }

  async updateSession(sessionId: string, updates: Partial<EnhancedInterviewSession>): Promise<void> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      // 构建更新数据
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // 映射字段
      if (updates.candidateName) updateData.candidate_name = updates.candidateName;
      if (updates.position) updateData.position = updates.position;
      if (updates.interviewerName) updateData.interviewer_name = updates.interviewerName;
      if (updates.company) updateData.company = updates.company;
      if (updates.status) updateData.status = updates.status;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.category) updateData.category = updates.category;
      if (updates.difficulty) updateData.difficulty = updates.difficulty;
      if (updates.confidentialityLevel) updateData.confidentiality_level = updates.confidentialityLevel;
      if (updates.isBookmarked !== undefined) updateData.is_bookmarked = updates.isBookmarked;
      if (updates.metadata) updateData.metadata = updates.metadata;
      if (updates.summary) updateData.summary = updates.summary;

      const { error } = await this.supabase
        .from('interview_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      console.log('✅ 面试会话更新成功:', sessionId);

    } catch (error) {
      console.error('❌ 更新面试会话失败:', error);
      throw error;
    }
  }

  // 搜索和过滤
  async searchSessions(filter: InterviewSessionFilter): Promise<EnhancedInterviewSession[]> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      let query = this.supabase
        .from('interview_sessions')
        .select(`
          *,
          transcription_segments (
            id,
            english_text,
            chinese_text,
            speaker,
            start_time,
            end_time,
            confidence_score,
            is_complete,
            is_final
          )
        `)
        .eq('user_id', this.userId);

      // 应用过滤条件
      if (filter.dateRange) {
        query = query
          .gte('created_at', filter.dateRange.start.toISOString())
          .lte('created_at', filter.dateRange.end.toISOString());
      }

      if (filter.candidateName) {
        query = query.ilike('candidate_name', `%${filter.candidateName}%`);
      }

      if (filter.position) {
        query = query.ilike('position', `%${filter.position}%`);
      }

      if (filter.company) {
        query = query.ilike('company', `%${filter.company}%`);
      }

      if (filter.category) {
        query = query.eq('category', filter.category);
      }

      if (filter.difficulty) {
        query = query.eq('difficulty', filter.difficulty);
      }

      if (filter.status) {
        query = query.eq('status', filter.status);
      }

      if (filter.minDuration !== undefined) {
        query = query.gte('duration_seconds', filter.minDuration);
      }

      if (filter.maxDuration !== undefined) {
        query = query.lte('duration_seconds', filter.maxDuration);
      }

      if (filter.hasSummary !== undefined) {
        if (filter.hasSummary) {
          query = query.not('summary', 'is', null);
        } else {
          query = query.is('summary', null);
        }
      }

      if (filter.confidentialityLevel) {
        query = query.eq('confidentiality_level', filter.confidentialityLevel);
      }

      query = query.order('created_at', { ascending: false });

      const { data: sessionsData, error } = await query;

      if (error) {
        throw error;
      }

      return sessionsData.map(session => 
        this.convertToEnhancedSession(session, session.transcription_segments || [])
      );

    } catch (error) {
      console.error('❌ 搜索面试会话失败:', error);
      return [];
    }
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<EnhancedInterviewSession[]> {
    return this.searchSessions({ dateRange: { start: startDate, end: endDate } });
  }

  // 批量操作（暂时简化实现）
  async batchOperation(options: BatchOperationOptions): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    for (const sessionId of options.sessionIds) {
      try {
        switch (options.operation) {
          case 'delete':
            await this.deleteSession(sessionId);
            break;
          case 'archive':
            await this.updateSession(sessionId, { status: 'archived' });
            break;
          case 'update_tags':
            await this.updateSession(sessionId, { tags: options.parameters?.tags || [] });
            break;
          default:
            throw new Error(`不支持的操作: ${options.operation}`);
        }
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push(`${sessionId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return result;
  }

  // 数据导出（暂时使用本地实现）
  async exportSession(sessionId: string, config: ExportConfiguration): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    // 暂时复用本地存储服务的导出功能
    return this.localStorageService.exportSession(sessionId, config);
  }

  async exportAllSessions(config: ExportConfiguration): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    // 暂时简化实现
    throw new Error('批量导出功能开发中');
  }

  async importSessions(data: string): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    // 暂时简化实现
    throw new Error('数据导入功能开发中');
  }

  // 系统状态（暂时简化实现）
  async getSystemStatus(): Promise<SystemStatus> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    try {
      const { data: stats } = await this.supabase
        .rpc('get_user_storage_stats', { user_uuid: this.userId });

      const sessions = await this.listSessions();
      
      return {
        storage: {
          used: stats?.storage_used_mb || 0,
          available: 100, // 假设100MB限制
          sessions: stats?.total_sessions || 0,
          oldestSession: sessions.length > 0 ? 
            new Date(Math.min(...sessions.map(s => s.timestamp.getTime()))) : 
            new Date(),
          newestSession: sessions.length > 0 ? 
            new Date(Math.max(...sessions.map(s => s.timestamp.getTime()))) : 
            new Date()
        },
        processing: {
          activeJobs: 0,
          queuedJobs: 0,
          failedJobs: 0,
          avgProcessingTime: 0
        },
        quality: {
          avgAudioQuality: 0.8,
          avgTranscriptionAccuracy: 0.9,
          avgSummaryConfidence: 0.85
        },
        health: 'excellent' as const,
        lastMaintenance: new Date()
      };

    } catch (error) {
      console.error('❌ 获取系统状态失败:', error);
      throw error;
    }
  }

  getStorageConfiguration(): StorageConfiguration {
    // 返回默认配置
    return {
      maxSessions: 1000,
      maxSessionSize: 100,
      autoCleanup: false, // 云端存储不需要自动清理
      cleanupAfterDays: 365,
      compressionEnabled: true,
      encryptionEnabled: true,
      backupEnabled: true,
      backupFrequency: 'daily',
      maxBackupCount: 30
    };
  }

  async updateStorageConfiguration(config: Partial<StorageConfiguration>): Promise<void> {
    // 暂时不支持动态配置更新
    console.log('存储配置更新:', config);
  }

  // V1.0兼容性 - 数据迁移
  async migrateFromLocalStorage(): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    if (!(await this.isReady())) {
      throw new Error('存储服务未就绪或用户未登录');
    }

    const result = { migrated: 0, failed: 0, errors: [] as string[] };

    try {
      console.log('🔄 开始从localStorage迁移数据...');
      
      // 获取本地存储的所有会话
      const localSessions = this.localStorageService.getAllSessions();
      
      for (const session of localSessions) {
        try {
          // 将本地会话转换为增强版格式（这里简化处理）
          const enhancedSession: EnhancedInterviewSession = {
            id: session.id,
            timestamp: session.timestamp,
            lastUpdated: new Date(),
            candidateName: session.candidateName,
            position: session.position,
            interviewerName: session.interviewerName,
            company: session.company,
            recordingSession: {
              id: session.id,
              startTime: session.timestamp,
              endTime: new Date(),
              duration: 0,
              status: 'completed',
              audioConfig: {
                microphoneEnabled: true,
                systemAudioEnabled: false,
                sampleRate: 16000,
                channels: 1,
                format: 'wav'
              },
              audioQualityHistory: [],
              averageAudioQuality: 0.8
            },
            segments: session.segments || [],
            rawTranscriptionText: session.rawTranscriptionText || '',
            rawTranslationText: session.rawTranslationText || '',
            summary: session.summary,
            statistics: {
              totalWords: session.segments?.reduce((sum, seg) => sum + (seg.englishText?.split(' ').length || 0), 0) || 0,
              totalQuestions: 0,
              speakerChangeCount: 0,
              averageSegmentDuration: 0,
              longestSegmentDuration: 0,
              speakingTimeDistribution: {
                interviewer: 0,
                candidate: 0,
                unknown: 0
              },
              interactionMetrics: {
                responseTime: [],
                questionDepth: 0,
                engagementScore: 0
              }
            },
            tags: [],
            category: 'mixed',
            difficulty: 'mid',
            metadata: {
              deviceInfo: 'migrated',
              browserInfo: 'migrated',
              recordingQuality: 'medium',
              processingVersion: '1.0'
            },
            status: 'completed',
            isBookmarked: false,
            confidentialityLevel: 'internal'
          };

          await this.saveSession(enhancedSession);
          result.migrated++;
          
        } catch (error) {
          result.failed++;
          result.errors.push(`会话 ${session.id}: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      console.log(`✅ 数据迁移完成: 成功 ${result.migrated} 个，失败 ${result.failed} 个`);
      
    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
      result.errors.push(`迁移过程异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  // 数据转换辅助方法
  private convertToEnhancedSession(sessionData: any, segmentsData: any[]): EnhancedInterviewSession {
    const segments: TranscriptionSegment[] = segmentsData.map(seg => ({
      id: seg.id,
      englishText: seg.english_text,
      chineseText: seg.chinese_text,
      timestamp: seg.start_time,
      startTime: seg.start_time,
      endTime: seg.end_time,
      speaker: seg.speaker,
      confidence: seg.confidence_score,
      isFinal: seg.is_final,
      isComplete: seg.is_complete
    }));

    return {
      id: sessionData.id,
      timestamp: new Date(sessionData.created_at),
      lastUpdated: new Date(sessionData.updated_at),
      candidateName: sessionData.candidate_name,
      position: sessionData.position,
      interviewerName: sessionData.interviewer_name,
      company: sessionData.company,
      recordingSession: {
        id: sessionData.id,
        startTime: new Date(sessionData.created_at),
        endTime: sessionData.recording_status === 'completed' ? new Date(sessionData.updated_at) : undefined,
        duration: sessionData.duration_seconds,
        status: sessionData.recording_status,
        audioConfig: sessionData.recording_config || {
          microphoneEnabled: true,
          systemAudioEnabled: false,
          sampleRate: 16000,
          channels: 1,
          format: 'wav'
        },
        audioQualityHistory: sessionData.recording_stats?.audioQualityHistory || [],
        averageAudioQuality: sessionData.audio_quality_avg || 0.8
      },
      segments,
      rawTranscriptionText: segments.map(s => s.englishText).join(' '),
      rawTranslationText: segments.map(s => s.chineseText).join(' '),
      summary: sessionData.summary,
      summaryGenerationStatus: sessionData.summary_status ? {
        jobId: sessionData.id,
        status: sessionData.summary_status,
        progress: sessionData.summary_progress,
        startTime: new Date(sessionData.created_at),
        completedTime: sessionData.summary_status === 'completed' ? new Date(sessionData.updated_at) : undefined
      } : undefined,
      statistics: {
        totalWords: sessionData.total_words || 0,
        totalQuestions: sessionData.total_questions || 0,
        speakerChangeCount: sessionData.speaker_changes || 0,
        averageSegmentDuration: segments.length > 0 ? segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0) / segments.length : 0,
        longestSegmentDuration: segments.length > 0 ? Math.max(...segments.map(seg => seg.endTime - seg.startTime)) : 0,
        speakingTimeDistribution: {
          interviewer: 0,
          candidate: 0,
          unknown: 0
        },
        interactionMetrics: {
          responseTime: [],
          questionDepth: 0,
          engagementScore: 0
        }
      },
      tags: sessionData.tags || [],
      category: sessionData.category || 'mixed',
      difficulty: sessionData.difficulty || 'mid',
      metadata: sessionData.metadata || {},
      status: sessionData.status,
      isBookmarked: sessionData.is_bookmarked || false,
      confidentialityLevel: sessionData.confidentiality_level || 'internal'
    };
  }
}

// 用户配置服务实现
export class SupabaseUserProfileService implements IUserProfileService {
  private supabase = createClientComponentClient();
  private userId: string | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      this.userId = user?.id || null;
    } catch (error) {
      console.error('❌ 用户配置服务初始化失败:', error);
    }
  }

  // 用户配置管理
  async getProfile(): Promise<UserProfile | null> {
    if (!this.userId) {
      await this.initialize();
      if (!this.userId) return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 获取用户配置失败:', error);
      return null;
    }
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 更新用户配置失败:', error);
      throw error;
    }
  }

  // 岗位模板管理
  async getPositionTemplates(): Promise<PositionTemplate[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await this.supabase
        .from('position_templates')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(template => ({
        ...template,
        created_at: new Date(template.created_at),
        updated_at: new Date(template.updated_at)
      }));

    } catch (error) {
      console.error('❌ 获取岗位模板失败:', error);
      return [];
    }
  }

  async getPositionTemplate(id: string): Promise<PositionTemplate | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await this.supabase
        .from('position_templates')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 获取岗位模板失败:', error);
      return null;
    }
  }

  async createPositionTemplate(template: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<PositionTemplate> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { data, error } = await this.supabase
        .from('position_templates')
        .insert({
          ...template,
          user_id: this.userId
        })
        .select()
        .single();

      if (error || !data) {
        throw error || new Error('创建岗位模板失败');
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 创建岗位模板失败:', error);
      throw error;
    }
  }

  async updatePositionTemplate(id: string, updates: Partial<PositionTemplate>): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('position_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 更新岗位模板失败:', error);
      throw error;
    }
  }

  async deletePositionTemplate(id: string): Promise<boolean> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('position_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      return true;

    } catch (error) {
      console.error('❌ 删除岗位模板失败:', error);
      return false;
    }
  }

  // 设置管理（暂时简化实现）
  async getSetting(key: string): Promise<any> {
    const profile = await this.getProfile();
    return profile?.settings?.[key];
  }

  async setSetting(key: string, value: any): Promise<void> {
    const profile = await this.getProfile();
    if (profile) {
      await this.updateProfile({
        settings: {
          ...profile.settings,
          [key]: value
        }
      });
    }
  }

  async getSettings(): Promise<Record<string, any>> {
    const profile = await this.getProfile();
    return profile?.settings || {};
  }

  async updateSettings(settings: Record<string, any>): Promise<void> {
    await this.updateProfile({ settings });
  }
}