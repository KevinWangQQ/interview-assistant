// 📋 会议存储服务 - 完整的会议纪要管理（与面试数据完全隔离）

import { 
  MeetingSession, 
  MeetingFilter,
  MeetingExportConfig,
  MeetingTemplate,
  MeetingEvent
} from '@/types/meeting';

export interface MeetingStorageConfig {
  maxSessions: number;
  maxSessionSize: number; // MB
  autoCleanup: boolean;
  cleanupAfterDays: number;
  compressionEnabled: boolean;
}

export interface MeetingStorageStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  totalStorageSize: number; // MB
  oldestSession: Date;
  newestSession: Date;
  lastUpdated: Date;
}

export class MeetingStorageService {
  private readonly STORAGE_KEY = 'meeting-sessions'; // 与面试数据隔离
  private readonly CONFIG_KEY = 'meeting-storage-config';
  private readonly STATS_KEY = 'meeting-storage-stats';
  private readonly TEMPLATES_KEY = 'meeting-templates';
  
  private config: MeetingStorageConfig;
  
  constructor() {
    this.config = this.loadConfiguration();
    this.initializeStorage();
  }

  // 🏗️ 初始化存储
  private initializeStorage(): void {
    try {
      const sessions = this.getAllSessions();
      console.log('📋 初始化会议存储服务:', {
        sessionsCount: sessions.length,
        storageSize: this.getStorageSize()
      });
      
      // 执行自动清理
      if (this.config.autoCleanup) {
        this.performAutoCleanup();
      }
      
      // 初始化默认模板
      this.initializeDefaultTemplates();
      
    } catch (error) {
      console.error('❌ 会议存储初始化失败:', error);
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
  private loadConfiguration(): MeetingStorageConfig {
    try {
      const stored = this.safeLocalStorageGetItem(this.CONFIG_KEY);
      const defaultConfig: MeetingStorageConfig = {
        maxSessions: 50,
        maxSessionSize: 100, // 会议可能比面试更大
        autoCleanup: true,
        cleanupAfterDays: 60, // 会议记录保留更长时间
        compressionEnabled: true
      };
      
      return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig;
    } catch (error) {
      console.error('❌ 配置加载失败:', error);
      return {
        maxSessions: 50,
        maxSessionSize: 100,
        autoCleanup: true,
        cleanupAfterDays: 60,
        compressionEnabled: true
      };
    }
  }

  // 💾 保存会议会话
  async saveSession(session: MeetingSession): Promise<void> {
    try {
      console.log('📋 保存会议会话:', session.id);
      
      // 验证会话数据
      this.validateSession(session);
      
      // 检查存储限制
      await this.checkStorageLimits(session);
      
      // 获取现有会话
      const sessions = this.getAllSessions();
      
      // 更新或添加会话
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      const updatedSession = {
        ...session,
        updatedAt: new Date()
      };
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = updatedSession;
      } else {
        sessions.push(updatedSession);
      }
      
      // 保存到存储
      this.saveSessionsToStorage(sessions);
      
      // 更新统计信息
      this.updateStorageStats();
      
      console.log('✅ 会议会话保存成功');
      
    } catch (error) {
      console.error('❌ 保存会议会话失败:', error);
      throw error;
    }
  }

  // 📖 获取单个会话
  getSession(sessionId: string): MeetingSession | null {
    try {
      const sessions = this.getAllSessions();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('❌ 获取会议会话失败:', error);
      return null;
    }
  }

  // 📋 获取所有会话
  getAllSessions(): MeetingSession[] {
    try {
      const stored = this.safeLocalStorageGetItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      
      // 转换日期字段
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        lastMinutesUpdate: new Date(session.lastMinutesUpdate),
        recordingSession: {
          ...session.recordingSession,
          startTime: new Date(session.recordingSession.startTime),
          endTime: session.recordingSession.endTime ? 
            new Date(session.recordingSession.endTime) : undefined
        },
        minutes: {
          ...session.minutes,
          date: new Date(session.minutes.date),
          startTime: new Date(session.minutes.startTime),
          endTime: session.minutes.endTime ? 
            new Date(session.minutes.endTime) : undefined,
          createdAt: new Date(session.minutes.createdAt),
          updatedAt: new Date(session.minutes.updatedAt),
          nextMeetingDate: session.minutes.nextMeetingDate ?
            new Date(session.minutes.nextMeetingDate) : undefined,
          decisions: session.minutes.decisions.map((decision: any) => ({
            ...decision,
            decidedAt: new Date(decision.decidedAt)
          })),
          actionItems: session.minutes.actionItems.map((item: any) => ({
            ...item,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
            createdAt: new Date(item.createdAt)
          })),
          participants: session.minutes.participants.map((participant: any) => ({
            ...participant,
            joinTime: participant.joinTime ? new Date(participant.joinTime) : undefined,
            leaveTime: participant.leaveTime ? new Date(participant.leaveTime) : undefined
          })),
          topicSegments: session.minutes.topicSegments.map((segment: any) => ({
            ...segment,
            startTime: new Date(segment.startTime),
            endTime: segment.endTime ? new Date(segment.endTime) : undefined
          }))
        },
        fullTranscript: session.fullTranscript.map((segment: any) => ({
          ...segment,
          startTime: new Date(segment.startTime),
          endTime: new Date(segment.endTime)
        }))
      }));
      
    } catch (error) {
      console.error('❌ 获取所有会议会话失败:', error);
      return [];
    }
  }

  // 🔍 搜索和过滤会话
  searchSessions(filter: MeetingFilter): MeetingSession[] {
    try {
      let sessions = this.getAllSessions();
      
      // 按日期范围过滤
      if (filter.dateRange) {
        sessions = sessions.filter(session => {
          const sessionDate = session.minutes.date;
          return sessionDate >= filter.dateRange!.startDate && 
                 sessionDate <= filter.dateRange!.endDate;
        });
      }
      
      // 按会议类型过滤
      if (filter.meetingType && filter.meetingType.length > 0) {
        sessions = sessions.filter(session =>
          filter.meetingType!.includes(session.meetingType)
        );
      }
      
      // 按组织者过滤
      if (filter.organizer) {
        const searchOrganizer = filter.organizer.toLowerCase();
        sessions = sessions.filter(session =>
          session.organizer.toLowerCase().includes(searchOrganizer)
        );
      }
      
      // 按参与者过滤
      if (filter.participants && filter.participants.length > 0) {
        sessions = sessions.filter(session =>
          filter.participants!.some(participant =>
            session.participants.some(p => 
              p.name.toLowerCase().includes(participant.toLowerCase()) ||
              p.email?.toLowerCase().includes(participant.toLowerCase())
            )
          )
        );
      }
      
      // 按是否有行动项过滤
      if (filter.hasActionItems !== undefined) {
        sessions = sessions.filter(session =>
          filter.hasActionItems ? 
            session.minutes.actionItems.length > 0 : 
            session.minutes.actionItems.length === 0
        );
      }
      
      // 按状态过滤
      if (filter.status && filter.status.length > 0) {
        sessions = sessions.filter(session =>
          filter.status!.includes(session.recordingSession.status)
        );
      }
      
      // 按搜索关键词过滤
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        sessions = sessions.filter(session =>
          session.meetingTitle.toLowerCase().includes(query) ||
          session.description?.toLowerCase().includes(query) ||
          session.minutes.keyPoints.some(point => 
            point.toLowerCase().includes(query)
          ) ||
          session.fullTranscript.some(segment =>
            segment.text.toLowerCase().includes(query)
          )
        );
      }
      
      // 按标签过滤
      if (filter.tags && filter.tags.length > 0) {
        sessions = sessions.filter(session =>
          // 这里可以扩展标签功能
          session.meetingTitle.toLowerCase().includes(filter.tags![0].toLowerCase())
        );
      }
      
      return sessions;
      
    } catch (error) {
      console.error('❌ 搜索会议会话失败:', error);
      return [];
    }
  }

  // 🗑️ 删除会话
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      console.log('🗑️ 删除会议会话:', sessionId);
      
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      
      if (sessions.length === filteredSessions.length) {
        console.warn('⚠️ 会议会话不存在:', sessionId);
        return false;
      }
      
      this.saveSessionsToStorage(filteredSessions);
      this.updateStorageStats();
      
      console.log('✅ 会议会话删除成功');
      return true;
      
    } catch (error) {
      console.error('❌ 删除会议会话失败:', error);
      return false;
    }
  }

  // 📤 导出会议
  async exportMeeting(
    sessionId: string, 
    config: MeetingExportConfig
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error('会议会话不存在');
      }
      
      console.log('📤 导出会议:', sessionId, config.format);
      
      // 准备导出数据
      const exportData: any = {
        basicInfo: {
          title: session.meetingTitle,
          type: session.meetingType,
          organizer: session.organizer,
          date: session.minutes.date,
          duration: session.recordingSession.duration,
          participants: session.participants.length
        }
      };
      
      if (config.includeMinutes) {
        exportData.minutes = {
          keyPoints: session.minutes.keyPoints,
          decisions: session.minutes.decisions,
          actionItems: session.minutes.actionItems,
          nextSteps: session.minutes.nextSteps
        };
      }
      
      if (config.includeTranscript) {
        exportData.transcript = session.fullTranscript.map(segment => ({
          timestamp: segment.startTime,
          speaker: segment.speaker,
          text: segment.text
        }));
      }
      
      if (config.includeParticipants) {
        exportData.participants = session.minutes.participants;
      }
      
      if (config.includeActionItems) {
        exportData.actionItems = session.minutes.actionItems;
      }
      
      if (config.includeStats) {
        exportData.statistics = session.stats;
      }
      
      // 根据格式生成输出
      const timestamp = new Date().toISOString().split('T')[0];
      const meetingTitle = session.meetingTitle.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      
      switch (config.format) {
        case 'json':
          return {
            data: JSON.stringify(exportData, null, 2),
            filename: `会议纪要_${meetingTitle}_${timestamp}.json`,
            mimeType: 'application/json'
          };
          
        case 'markdown':
          const markdownData = this.convertToMarkdown(exportData, session);
          return {
            data: markdownData,
            filename: `会议纪要_${meetingTitle}_${timestamp}.md`,
            mimeType: 'text/markdown'
          };
          
        case 'txt':
          const txtData = this.convertToTXT(exportData, session);
          return {
            data: txtData,
            filename: `会议纪要_${meetingTitle}_${timestamp}.txt`,
            mimeType: 'text/plain'
          };
          
        case 'html':
          const htmlData = this.convertToHTML(exportData, session);
          return {
            data: htmlData,
            filename: `会议纪要_${meetingTitle}_${timestamp}.html`,
            mimeType: 'text/html'
          };
          
        default:
          throw new Error(`不支持的导出格式: ${config.format}`);
      }
      
    } catch (error) {
      console.error('❌ 导出会议失败:', error);
      throw error;
    }
  }

  // 📊 获取存储统计
  getStorageStats(): MeetingStorageStats {
    try {
      const sessions = this.getAllSessions();
      const now = new Date();
      
      const activeSessions = sessions.filter(s => 
        s.recordingSession.status === 'active' || s.recordingSession.status === 'paused'
      ).length;
      
      const completedSessions = sessions.filter(s => 
        s.recordingSession.status === 'completed'
      ).length;
      
      return {
        totalSessions: sessions.length,
        activeSessions,
        completedSessions,
        totalStorageSize: this.getStorageSize(),
        oldestSession: sessions.length > 0 ? 
          new Date(Math.min(...sessions.map(s => s.createdAt.getTime()))) : 
          now,
        newestSession: sessions.length > 0 ? 
          new Date(Math.max(...sessions.map(s => s.createdAt.getTime()))) : 
          now,
        lastUpdated: now
      };
      
    } catch (error) {
      console.error('❌ 获取存储统计失败:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStorageSize: 0,
        oldestSession: new Date(),
        newestSession: new Date(),
        lastUpdated: new Date()
      };
    }
  }

  // 🧹 自动清理
  private performAutoCleanup(): void {
    try {
      console.log('🧹 执行会议自动清理...');
      
      const sessions = this.getAllSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupAfterDays);
      
      const sessionsToKeep = sessions.filter(session => {
        // 保留最近的会议
        if (session.createdAt > cutoffDate) return true;
        
        // 保留有重要行动项的会议
        if (session.minutes.actionItems.some(item => item.status === 'pending' || item.status === 'in_progress')) {
          return true;
        }
        
        // 保留有后续会议安排的会议
        if (session.minutes.nextMeetingDate && session.minutes.nextMeetingDate > new Date()) {
          return true;
        }
        
        return false;
      });
      
      const cleaned = sessions.length - sessionsToKeep.length;
      if (cleaned > 0) {
        this.saveSessionsToStorage(sessionsToKeep);
        console.log(`🧹 会议自动清理完成，删除了 ${cleaned} 个旧会议`);
      }
      
    } catch (error) {
      console.error('❌ 会议自动清理失败:', error);
    }
  }

  // 🔧 辅助方法
  private validateSession(session: MeetingSession): void {
    if (!session.id) throw new Error('会议ID不能为空');
    if (!session.meetingTitle) throw new Error('会议标题不能为空');
    if (!session.organizer) throw new Error('会议组织者不能为空');
    if (session.participants.length === 0) throw new Error('参与者列表不能为空');
    if (!session.type || session.type !== 'meeting') throw new Error('必须是会议类型');
  }

  private async checkStorageLimits(session: MeetingSession): Promise<void> {
    const sessions = this.getAllSessions();
    
    // 检查会话数量限制
    if (sessions.length >= this.config.maxSessions) {
      throw new Error(`会议数量已达上限 (${this.config.maxSessions})`);
    }
    
    // 检查单个会话大小限制
    const sessionSize = JSON.stringify(session).length / (1024 * 1024); // MB
    if (sessionSize > this.config.maxSessionSize) {
      throw new Error(`会议大小超出限制 (${this.config.maxSessionSize}MB)`);
    }
  }

  private saveSessionsToStorage(sessions: MeetingSession[]): void {
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

  private updateStorageStats(): void {
    try {
      const stats = this.getStorageStats();
      this.safeLocalStorageSetItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('❌ 更新会议存储统计失败:', error);
    }
  }

  private initializeDefaultTemplates(): void {
    try {
      const existing = this.safeLocalStorageGetItem(this.TEMPLATES_KEY);
      if (existing) return; // 已有模板，不覆盖
      
      const defaultTemplates: MeetingTemplate[] = [
        {
          id: 'template-standup',
          name: '站会/晨会',
          description: '日常团队站会，快速同步进展和障碍',
          meetingType: 'standup',
          defaultAgenda: ['昨天完成的工作', '今天计划的工作', '遇到的障碍或需要帮助'],
          defaultObjectives: ['同步团队进展', '识别障碍', '协调资源'],
          defaultDuration: 15,
          processingConfig: {
            minutesUpdateInterval: 30,
            autoTopicDetection: true,
            autoActionItemExtraction: true,
            autoDecisionCapture: false,
            summaryStyle: 'bullet_points'
          },
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'template-project',
          name: '项目会议',
          description: '项目进展讨论和决策会议',
          meetingType: 'project',
          defaultAgenda: ['项目进展回顾', '重要决策讨论', '下一步计划', '风险和问题'],
          defaultObjectives: ['回顾项目状态', '做出重要决策', '制定下一步计划'],
          defaultDuration: 60,
          processingConfig: {
            minutesUpdateInterval: 60,
            autoTopicDetection: true,
            autoActionItemExtraction: true,
            autoDecisionCapture: true,
            summaryStyle: 'detailed'
          },
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'template-brainstorm',
          name: '头脑风暴',
          description: '创意讨论和方案探索会议',
          meetingType: 'brainstorm',
          defaultAgenda: ['问题定义', '想法收集', '方案讨论', '下一步行动'],
          defaultObjectives: ['收集创意想法', '探索可行方案', '确定后续行动'],
          defaultDuration: 90,
          processingConfig: {
            minutesUpdateInterval: 45,
            autoTopicDetection: true,
            autoActionItemExtraction: true,
            autoDecisionCapture: false,
            summaryStyle: 'concise'
          },
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      this.safeLocalStorageSetItem(this.TEMPLATES_KEY, JSON.stringify(defaultTemplates));
      console.log('✅ 初始化默认会议模板完成');
      
    } catch (error) {
      console.error('❌ 初始化默认模板失败:', error);
    }
  }

  private convertToMarkdown(exportData: any, session: MeetingSession): string {
    const lines = [];
    
    lines.push(`# ${session.meetingTitle}`);
    lines.push('');
    lines.push(`**会议类型**: ${this.getMeetingTypeLabel(session.meetingType)}`);
    lines.push(`**组织者**: ${session.organizer}`);
    lines.push(`**日期**: ${session.minutes.date.toLocaleDateString()}`);
    lines.push(`**时长**: ${Math.round(session.recordingSession.duration / 60)}分钟`);
    lines.push('');
    
    if (exportData.participants) {
      lines.push('## 参会人员');
      session.minutes.participants.forEach(p => {
        lines.push(`- **${p.name}** ${p.role ? `(${p.role})` : ''}`);
      });
      lines.push('');
    }
    
    if (exportData.minutes?.keyPoints && exportData.minutes.keyPoints.length > 0) {
      lines.push('## 关键要点');
      exportData.minutes.keyPoints.forEach((point: string) => {
        lines.push(`- ${point}`);
      });
      lines.push('');
    }
    
    if (exportData.minutes?.decisions && exportData.minutes.decisions.length > 0) {
      lines.push('## 决策记录');
      exportData.minutes.decisions.forEach((decision: any) => {
        lines.push(`### ${decision.title}`);
        lines.push(decision.description);
        lines.push(`**决策时间**: ${new Date(decision.decidedAt).toLocaleString()}`);
        lines.push('');
      });
    }
    
    if (exportData.actionItems && exportData.actionItems.length > 0) {
      lines.push('## 行动项');
      exportData.actionItems.forEach((item: any) => {
        const status = item.status === 'pending' ? '⏳' : 
                     item.status === 'in_progress' ? '🔄' : 
                     item.status === 'completed' ? '✅' : '❌';
        lines.push(`- ${status} **${item.task}** (负责人: ${item.assignedTo})`);
        if (item.dueDate) {
          lines.push(`  截止日期: ${new Date(item.dueDate).toLocaleDateString()}`);
        }
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private convertToTXT(exportData: any, session: MeetingSession): string {
    let txt = `会议纪要\n${'='.repeat(50)}\n\n`;
    
    txt += `会议标题: ${session.meetingTitle}\n`;
    txt += `会议类型: ${this.getMeetingTypeLabel(session.meetingType)}\n`;
    txt += `组织者: ${session.organizer}\n`;
    txt += `日期: ${session.minutes.date.toLocaleDateString()}\n`;
    txt += `时长: ${Math.round(session.recordingSession.duration / 60)}分钟\n\n`;
    
    if (exportData.minutes?.keyPoints) {
      txt += `关键要点\n${'-'.repeat(30)}\n`;
      exportData.minutes.keyPoints.forEach((point: string, index: number) => {
        txt += `${index + 1}. ${point}\n`;
      });
      txt += '\n';
    }
    
    if (exportData.actionItems && exportData.actionItems.length > 0) {
      txt += `行动项\n${'-'.repeat(30)}\n`;
      exportData.actionItems.forEach((item: any, index: number) => {
        txt += `${index + 1}. ${item.task} (${item.assignedTo})\n`;
        txt += `   状态: ${this.getActionItemStatusLabel(item.status)}\n`;
        if (item.dueDate) {
          txt += `   截止: ${new Date(item.dueDate).toLocaleDateString()}\n`;
        }
        txt += '\n';
      });
    }
    
    return txt;
  }

  private convertToHTML(exportData: any, session: MeetingSession): string {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${session.meetingTitle} - 会议纪要</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 40px; }
        h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        .meta { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .section { margin: 25px 0; }
        ul { list-style-type: disc; margin-left: 20px; }
        .action-item { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #007acc; }
        .decision { margin: 15px 0; padding: 15px; background: #e8f5e8; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>${session.meetingTitle}</h1>
    
    <div class="meta">
        <p><strong>会议类型:</strong> ${this.getMeetingTypeLabel(session.meetingType)}</p>
        <p><strong>组织者:</strong> ${session.organizer}</p>
        <p><strong>日期:</strong> ${session.minutes.date.toLocaleDateString()}</p>
        <p><strong>时长:</strong> ${Math.round(session.recordingSession.duration / 60)}分钟</p>
    </div>

    ${exportData.minutes?.keyPoints && exportData.minutes.keyPoints.length > 0 ? `
    <div class="section">
        <h2>关键要点</h2>
        <ul>
            ${exportData.minutes.keyPoints.map((point: string) => `<li>${point}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${exportData.actionItems && exportData.actionItems.length > 0 ? `
    <div class="section">
        <h2>行动项</h2>
        ${exportData.actionItems.map((item: any) => `
        <div class="action-item">
            <strong>${item.task}</strong><br>
            负责人: ${item.assignedTo}<br>
            状态: ${this.getActionItemStatusLabel(item.status)}
            ${item.dueDate ? `<br>截止日期: ${new Date(item.dueDate).toLocaleDateString()}` : ''}
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div style="margin-top: 40px; font-size: 12px; color: #666; text-align: center;">
        生成时间: ${new Date().toLocaleString()} | 面试助手 V2.0 会议纪要
    </div>
</body>
</html>`;
    
    return html;
  }

  private getMeetingTypeLabel(type: string): string {
    const typeLabels: Record<string, string> = {
      'regular': '定期会议',
      'project': '项目会议',
      'emergency': '紧急会议',
      'review': '评审会议',
      'brainstorm': '头脑风暴',
      'standup': '站会/晨会'
    };
    return typeLabels[type] || type;
  }

  private getActionItemStatusLabel(status: string): string {
    const statusLabels: Record<string, string> = {
      'pending': '待处理',
      'in_progress': '进行中',
      'completed': '已完成',
      'overdue': '已逾期'
    };
    return statusLabels[status] || status;
  }
}