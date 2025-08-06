// 💾 增强版面试存储服务 - 完整的面试会话管理

import { 
  EnhancedInterviewSession, 
  InterviewSessionFilter, 
  BatchOperationOptions,
  ExportConfiguration,
  StorageConfiguration,
  SystemStatus
} from '@/types/enhanced-interview';
import { TranscriptionSegment } from '@/utils/smart-segmentation';
import { InterviewSummary } from '@/services/interview-summary/gpt4-summary-service';

export class EnhancedInterviewStorageService {
  private readonly STORAGE_KEY = 'enhanced-interview-sessions';
  private readonly CONFIG_KEY = 'enhanced-interview-storage-config';
  private readonly STATS_KEY = 'enhanced-interview-storage-stats';
  
  private config: StorageConfiguration;
  
  constructor() {
    this.config = this.loadConfiguration();
    this.initializeStorage();
  }

  // 🏗️ 初始化存储
  private initializeStorage(): void {
    try {
      const sessions = this.getAllSessions();
      console.log('💾 初始化增强版存储服务:', {
        sessionsCount: sessions.length,
        storageSize: this.getStorageSize()
      });
      
      // 执行自动清理
      if (this.config.autoCleanup) {
        this.performAutoCleanup();
      }
      
    } catch (error) {
      console.error('❌ 存储初始化失败:', error);
    }
  }

  // 🔒 安全的localStorage访问器
  private safeLocalStorageGetItem(key: string): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('localStorage访问失败:', error);
      return null;
    }
  }

  private safeLocalStorageSetItem(key: string, value: string): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn('localStorage写入失败:', error);
      return false;
    }
  }

  private safeLocalStorageRemoveItem(key: string): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('localStorage删除失败:', error);
      return false;
    }
  }

  // ⚙️ 加载配置
  private loadConfiguration(): StorageConfiguration {
    try {
      const stored = this.safeLocalStorageGetItem(this.CONFIG_KEY);
      const defaultConfig: StorageConfiguration = {
        maxSessions: 100,
        maxSessionSize: 50, // 50MB
        autoCleanup: true,
        cleanupAfterDays: 30,
        compressionEnabled: true,
        encryptionEnabled: false,
        backupEnabled: false,
        backupFrequency: 'weekly',
        maxBackupCount: 5
      };
      
      return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig;
    } catch (error) {
      console.error('❌ 配置加载失败:', error);
      return {
        maxSessions: 100,
        maxSessionSize: 50,
        autoCleanup: true,
        cleanupAfterDays: 30,
        compressionEnabled: true,
        encryptionEnabled: false,
        backupEnabled: false,
        backupFrequency: 'weekly',
        maxBackupCount: 5
      };
    }
  }

  // 💾 保存面试会话
  async saveSession(session: EnhancedInterviewSession): Promise<void> {
    try {
      console.log('💾 保存面试会话:', session.id);
      
      // 验证会话数据
      this.validateSession(session);
      
      // 检查存储限制
      await this.checkStorageLimits(session);
      
      // 获取现有会话
      const sessions = this.getAllSessions();
      
      // 更新或添加会话
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = {
          ...session,
          lastUpdated: new Date()
        };
      } else {
        sessions.push({
          ...session,
          lastUpdated: new Date()
        });
      }
      
      // 保存到存储
      this.saveSessionsToStorage(sessions);
      
      // 更新统计信息
      this.updateStorageStats();
      
      console.log('✅ 面试会话保存成功');
      
    } catch (error) {
      console.error('❌ 保存面试会话失败:', error);
      throw error;
    }
  }

  // 📖 获取单个会话
  getSession(sessionId: string): EnhancedInterviewSession | null {
    try {
      const sessions = this.getAllSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('❌ 获取会话失败:', error);
      return null;
    }
  }

  // 📋 获取所有会话
  getAllSessions(): EnhancedInterviewSession[] {
    try {
      const stored = this.safeLocalStorageGetItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      
      // 转换日期字段
      return sessions.map((session: any) => ({
        ...session,
        timestamp: new Date(session.timestamp),
        lastUpdated: new Date(session.lastUpdated),
        recordingSession: {
          ...session.recordingSession,
          startTime: new Date(session.recordingSession.startTime),
          endTime: session.recordingSession.endTime ? 
            new Date(session.recordingSession.endTime) : undefined
        },
        summary: session.summary ? {
          ...session.summary,
          timestamp: new Date(session.summary.timestamp)
        } : undefined,
        summaryGenerationStatus: session.summaryGenerationStatus ? {
          ...session.summaryGenerationStatus,
          startTime: new Date(session.summaryGenerationStatus.startTime),
          completedTime: session.summaryGenerationStatus.completedTime ?
            new Date(session.summaryGenerationStatus.completedTime) : undefined
        } : undefined
      }));
      
    } catch (error) {
      console.error('❌ 获取所有会话失败:', error);
      return [];
    }
  }

  // 🔍 搜索和过滤会话
  searchSessions(filter: InterviewSessionFilter): EnhancedInterviewSession[] {
    try {
      let sessions = this.getAllSessions();
      
      // 按日期范围过滤
      if (filter.dateRange) {
        sessions = sessions.filter(session => {
          const sessionDate = session.timestamp;
          return sessionDate >= filter.dateRange!.start && 
                 sessionDate <= filter.dateRange!.end;
        });
      }
      
      // 按候选人姓名过滤
      if (filter.candidateName) {
        const searchName = filter.candidateName.toLowerCase();
        sessions = sessions.filter(session =>
          session.candidateName.toLowerCase().includes(searchName)
        );
      }
      
      // 按职位过滤
      if (filter.position) {
        const searchPosition = filter.position.toLowerCase();
        sessions = sessions.filter(session =>
          session.position.toLowerCase().includes(searchPosition)
        );
      }
      
      // 按公司过滤
      if (filter.company) {
        const searchCompany = filter.company.toLowerCase();
        sessions = sessions.filter(session =>
          session.company?.toLowerCase().includes(searchCompany)
        );
      }
      
      // 按类别过滤
      if (filter.category) {
        sessions = sessions.filter(session => session.category === filter.category);
      }
      
      // 按难度过滤
      if (filter.difficulty) {
        sessions = sessions.filter(session => session.difficulty === filter.difficulty);
      }
      
      // 按状态过滤
      if (filter.status) {
        sessions = sessions.filter(session => session.status === filter.status);
      }
      
      // 按标签过滤
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(session =>
          filter.tags!.some(tag => session.tags.includes(tag))
        );
      }
      
      // 按时长过滤
      if (filter.minDuration !== undefined) {
        sessions = sessions.filter(session =>
          session.recordingSession.duration >= filter.minDuration!
        );
      }
      
      if (filter.maxDuration !== undefined) {
        sessions = sessions.filter(session =>
          session.recordingSession.duration <= filter.maxDuration!
        );
      }
      
      // 按是否有总结过滤
      if (filter.hasSummary !== undefined) {
        sessions = sessions.filter(session =>
          filter.hasSummary ? !!session.summary : !session.summary
        );
      }
      
      // 按机密级别过滤
      if (filter.confidentialityLevel) {
        sessions = sessions.filter(session =>
          session.confidentialityLevel === filter.confidentialityLevel
        );
      }
      
      return sessions;
      
    } catch (error) {
      console.error('❌ 搜索会话失败:', error);
      return [];
    }
  }

  // 🗑️ 删除会话
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      console.log('🗑️ 删除会话:', sessionId);
      
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (sessions.length === filteredSessions.length) {
        console.warn('⚠️ 会话不存在:', sessionId);
        return false;
      }
      
      this.saveSessionsToStorage(filteredSessions);
      this.updateStorageStats();
      
      console.log('✅ 会话删除成功');
      return true;
      
    } catch (error) {
      console.error('❌ 删除会话失败:', error);
      return false;
    }
  }

  // 📦 批量操作
  async batchOperation(options: BatchOperationOptions): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    
    try {
      console.log('📦 执行批量操作:', options.operation, options.sessionIds.length);
      
      for (const sessionId of options.sessionIds) {
        try {
          switch (options.operation) {
            case 'delete':
              await this.deleteSession(sessionId);
              break;
              
            case 'archive':
              await this.archiveSession(sessionId, options.parameters?.archiveReason);
              break;
              
            case 'update_tags':
              await this.updateSessionTags(sessionId, options.parameters?.tags || []);
              break;
              
            case 'export':
              // 导出操作需要额外处理
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
      
      console.log('✅ 批量操作完成:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 批量操作失败:', error);
      result.errors.push(`批量操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return result;
    }
  }

  // 📤 导出会话
  async exportSession(
    sessionId: string, 
    config: ExportConfiguration
  ): Promise<{ data: any; filename: string; mimeType: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error('会话不存在');
      }
      
      console.log('📤 导出会话:', sessionId, config.format);
      
      // 准备导出数据
      const exportData: any = {
        basicInfo: {
          candidateName: config.anonymize ? 
            config.anonymizationOptions?.replaceCandidateName || '候选人' : 
            session.candidateName,
          position: session.position,
          company: config.anonymize ? 
            config.anonymizationOptions?.replaceCompanyName || '公司' : 
            session.company,
          timestamp: session.timestamp,
          duration: session.recordingSession.duration
        }
      };
      
      if (config.includeSegments) {
        exportData.segments = session.segments.map(segment => ({
          timestamp: new Date(segment.timestamp),
          speaker: segment.speaker,
          englishText: segment.englishText,
          chineseText: segment.chineseText,
          duration: segment.endTime - segment.startTime
        }));
      }
      
      if (config.includeSummary && session.summary) {
        exportData.summary = session.summary;
      }
      
      if (config.includeStatistics) {
        exportData.statistics = session.statistics;
      }
      
      if (config.includeAudioMetrics) {
        exportData.audioMetrics = {
          averageQuality: session.recordingSession.averageAudioQuality,
          qualityHistory: session.recordingSession.audioQualityHistory
        };
      }
      
      // 根据格式生成输出
      const timestamp = new Date().toISOString().split('T')[0];
      const candidateName = config.anonymize ? '匿名候选人' : session.candidateName;
      
      switch (config.format) {
        case 'json':
          return {
            data: JSON.stringify(exportData, null, 2),
            filename: `面试记录_${candidateName}_${timestamp}.json`,
            mimeType: 'application/json'
          };
          
        case 'csv':
          const csvData = this.convertToCSV(exportData);
          return {
            data: csvData,
            filename: `面试记录_${candidateName}_${timestamp}.csv`,
            mimeType: 'text/csv'
          };
          
        case 'txt':
          const txtData = this.convertToTXT(exportData);
          return {
            data: txtData,
            filename: `面试记录_${candidateName}_${timestamp}.txt`,
            mimeType: 'text/plain'
          };
          
        default:
          throw new Error(`不支持的导出格式: ${config.format}`);
      }
      
    } catch (error) {
      console.error('❌ 导出会话失败:', error);
      throw error;
    }
  }

  // 📊 获取系统状态
  getSystemStatus(): SystemStatus {
    try {
      const sessions = this.getAllSessions();
      const storageSize = this.getStorageSize();
      
      // 存储信息
      const storage = {
        used: storageSize,
        available: this.getAvailableStorage(),
        sessions: sessions.length,
        oldestSession: sessions.length > 0 ? 
          new Date(Math.min(...sessions.map(s => s.timestamp.getTime()))) : 
          new Date(),
        newestSession: sessions.length > 0 ? 
          new Date(Math.max(...sessions.map(s => s.timestamp.getTime()))) : 
          new Date()
      };
      
      // 处理信息
      const processing = {
        activeJobs: 0, // 需要从SummaryGenerationManager获取
        queuedJobs: 0,
        failedJobs: sessions.filter(s => 
          s.summaryGenerationStatus?.status === 'failed'
        ).length,
        avgProcessingTime: this.calculateAverageProcessingTime(sessions)
      };
      
      // 质量信息
      const quality = {
        avgAudioQuality: this.calculateAverageAudioQuality(sessions),
        avgTranscriptionAccuracy: 0.9, // 假设值
        avgSummaryConfidence: this.calculateAverageSummaryConfidence(sessions)
      };
      
      // 健康状态
      let health: SystemStatus['health'] = 'excellent';
      if (storage.used / (storage.used + storage.available) > 0.9) health = 'critical';
      else if (storage.used / (storage.used + storage.available) > 0.8) health = 'warning';
      else if (quality.avgAudioQuality < 0.6) health = 'warning';
      
      return {
        storage,
        processing,
        quality,
        health,
        lastMaintenance: new Date() // 应该从实际维护记录获取
      };
      
    } catch (error) {
      console.error('❌ 获取系统状态失败:', error);
      return {
        storage: { used: 0, available: 0, sessions: 0, oldestSession: new Date(), newestSession: new Date() },
        processing: { activeJobs: 0, queuedJobs: 0, failedJobs: 0, avgProcessingTime: 0 },
        quality: { avgAudioQuality: 0, avgTranscriptionAccuracy: 0, avgSummaryConfidence: 0 },
        health: 'critical',
        lastMaintenance: new Date()
      };
    }
  }

  // 🧹 自动清理
  private performAutoCleanup(): void {
    try {
      console.log('🧹 执行自动清理...');
      
      const sessions = this.getAllSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupAfterDays);
      
      const sessionsToKeep = sessions.filter(session => {
        // 保留最近的会话
        if (session.timestamp > cutoffDate) return true;
        
        // 保留已加书签的会话
        if (session.isBookmarked) return true;
        
        // 保留有总结的重要会话
        if (session.summary && session.status === 'completed') return true;
        
        return false;
      });
      
      const cleaned = sessions.length - sessionsToKeep.length;
      if (cleaned > 0) {
        this.saveSessionsToStorage(sessionsToKeep);
        console.log(`🧹 自动清理完成，删除了 ${cleaned} 个旧会话`);
      }
      
    } catch (error) {
      console.error('❌ 自动清理失败:', error);
    }
  }

  // 🔧 辅助方法
  private validateSession(session: EnhancedInterviewSession): void {
    if (!session.id) throw new Error('会话ID不能为空');
    if (!session.candidateName) throw new Error('候选人姓名不能为空');
    if (!session.position) throw new Error('职位不能为空');
    if (session.segments.length === 0) throw new Error('转录分段不能为空');
  }

  private async checkStorageLimits(session: EnhancedInterviewSession): Promise<void> {
    const sessions = this.getAllSessions();
    
    // 检查会话数量限制
    if (sessions.length >= this.config.maxSessions) {
      throw new Error(`会话数量已达上限 (${this.config.maxSessions})`);
    }
    
    // 检查单个会话大小限制（简化检查）
    const sessionSize = JSON.stringify(session).length / (1024 * 1024); // MB
    if (sessionSize > this.config.maxSessionSize) {
      throw new Error(`会话大小超出限制 (${this.config.maxSessionSize}MB)`);
    }
  }

  private saveSessionsToStorage(sessions: EnhancedInterviewSession[]): void {
    this.safeLocalStorageSetItem(this.STORAGE_KEY, JSON.stringify(sessions));
  }

  private getStorageSize(): number {
    try {
      const data = this.safeLocalStorageGetItem(this.STORAGE_KEY);
      return data ? (data.length * 2) / (1024 * 1024) : 0; // 粗略估算MB
    } catch {
      return 0;
    }
  }

  private getAvailableStorage(): number {
    // 浏览器localStorage通常有5-10MB限制
    return Math.max(0, 10 - this.getStorageSize());
  }

  private updateStorageStats(): void {
    try {
      const stats = {
        lastUpdated: new Date(),
        totalSessions: this.getAllSessions().length,
        storageSize: this.getStorageSize()
      };
      this.safeLocalStorageSetItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('❌ 更新存储统计失败:', error);
    }
  }

  private async archiveSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('会话不存在');
    
    session.status = 'archived';
    session.lastUpdated = new Date();
    if (reason) {
      session.metadata = { ...session.metadata, archiveReason: reason };
    }
    
    await this.saveSession(session);
  }

  private async updateSessionTags(sessionId: string, tags: string[]): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('会话不存在');
    
    session.tags = tags;
    session.lastUpdated = new Date();
    
    await this.saveSession(session);
  }

  private convertToCSV(data: any): string {
    // 简化的CSV转换
    const lines = ['时间,候选人,职位,公司,时长'];
    
    if (data.basicInfo) {
      lines.push([
        data.basicInfo.timestamp,
        data.basicInfo.candidateName,
        data.basicInfo.position,
        data.basicInfo.company || '',
        data.basicInfo.duration
      ].join(','));
    }
    
    return lines.join('\n');
  }

  private convertToTXT(data: any): string {
    let txt = `面试记录报告\n${'='.repeat(50)}\n\n`;
    
    if (data.basicInfo) {
      txt += `候选人: ${data.basicInfo.candidateName}\n`;
      txt += `职位: ${data.basicInfo.position}\n`;
      txt += `公司: ${data.basicInfo.company || '未指定'}\n`;
      txt += `时间: ${data.basicInfo.timestamp}\n`;
      txt += `时长: ${Math.round(data.basicInfo.duration / 60)}分钟\n\n`;
    }
    
    if (data.segments) {
      txt += `转录内容\n${'-'.repeat(30)}\n\n`;
      data.segments.forEach((segment: any, index: number) => {
        txt += `[${index + 1}] ${segment.speaker || '未知'}: ${segment.englishText}\n`;
        txt += `翻译: ${segment.chineseText}\n\n`;
      });
    }
    
    if (data.summary) {
      txt += `面试总结\n${'-'.repeat(30)}\n`;
      txt += `${data.summary.executiveSummary}\n\n`;
      
      if (data.summary.recommendation) {
        txt += `推荐决策: ${data.summary.recommendation.decision}\n`;
        txt += `理由: ${data.summary.recommendation.reasoning}\n`;
      }
    }
    
    return txt;
  }

  private calculateAverageProcessingTime(sessions: EnhancedInterviewSession[]): number {
    const completedSessions = sessions.filter(s => 
      s.summaryGenerationStatus?.status === 'completed' &&
      s.summaryGenerationStatus.startTime &&
      s.summaryGenerationStatus.completedTime
    );
    
    if (completedSessions.length === 0) return 0;
    
    const totalTime = completedSessions.reduce((sum, session) => {
      const start = session.summaryGenerationStatus!.startTime.getTime();
      const end = session.summaryGenerationStatus!.completedTime!.getTime();
      return sum + (end - start);
    }, 0);
    
    return totalTime / completedSessions.length / 1000; // 转换为秒
  }

  private calculateAverageAudioQuality(sessions: EnhancedInterviewSession[]): number {
    if (sessions.length === 0) return 0;
    
    const totalQuality = sessions.reduce((sum, session) => 
      sum + session.recordingSession.averageAudioQuality, 0
    );
    
    return totalQuality / sessions.length;
  }

  private calculateAverageSummaryConfidence(sessions: EnhancedInterviewSession[]): number {
    const sessionsWithSummary = sessions.filter(s => s.summary);
    
    if (sessionsWithSummary.length === 0) return 0;
    
    const totalConfidence = sessionsWithSummary.reduce((sum, session) => 
      sum + (session.summary!.processingStats.confidenceScore || 0), 0
    );
    
    return totalConfidence / sessionsWithSummary.length;
  }
}