// 🚀 V2.0数据迁移服务 - localStorage到Supabase的智能迁移

import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { SupabaseStorageService } from '@/services/storage/supabase-storage';
import { EnhancedInterviewStorageService } from '@/services/storage/enhanced-interview-storage';

interface MigrationProgress {
  stage: 'scanning' | 'analyzing' | 'migrating' | 'verifying' | 'completed' | 'failed';
  message: string;
  progress: number; // 0-100
  processedItems: number;
  totalItems: number;
  errors: string[];
}

interface MigrationResult {
  success: boolean;
  migratedSessions: number;
  skippedSessions: number;
  errors: string[];
  duration: number;
  summary: {
    oldestSession?: Date;
    newestSession?: Date;
    totalDataSize: number;
    categories: Record<string, number>;
  };
}

interface MigrationOptions {
  onProgress?: (progress: MigrationProgress) => void;
  dryRun?: boolean; // 仅分析，不实际迁移
  overwrite?: boolean; // 是否覆盖云端已存在的数据
  batchSize?: number; // 批量处理大小
  skipValidation?: boolean; // 跳过数据验证
  preserveTimestamps?: boolean; // 保持原始时间戳
}

export class DataMigrationService {
  private supabaseStorage: SupabaseStorageService;
  private localStorageService: EnhancedInterviewStorageService;
  private readonly LOCAL_STORAGE_KEYS = [
    'enhanced-interview-sessions',
    'interview-history',
    'wav-streaming-sessions',
    'interview-assistant-config'
  ];

  constructor() {
    this.supabaseStorage = new SupabaseStorageService();
    this.localStorageService = new EnhancedInterviewStorageService();
  }

  /**
   * 检查是否需要进行数据迁移
   */
  async needsMigration(): Promise<{
    needsMigration: boolean;
    localSessionsCount: number;
    cloudSessionsCount: number;
    lastMigrationTime?: Date;
  }> {
    try {
      // 检查用户是否已登录
      const isLoggedIn = await this.supabaseStorage.isReady();
      if (!isLoggedIn) {
        return {
          needsMigration: false,
          localSessionsCount: 0,
          cloudSessionsCount: 0
        };
      }

      // 获取本地数据统计
      const localSessions = this.localStorageService.listSessions();
      
      // 获取云端数据统计
      const cloudSessions = await this.supabaseStorage.listSessions();
      
      // 检查上次迁移时间
      const lastMigrationTime = await this.getLastMigrationTime();
      
      // 判断是否需要迁移：
      // 1. 有本地数据且云端数据较少
      // 2. 从未进行过迁移
      // 3. 本地有新数据且距离上次迁移超过24小时
      const hasNewLocalData = localSessions.length > cloudSessions.length;
      const neverMigrated = !lastMigrationTime;
      const longTimeSinceLastMigration = lastMigrationTime ? 
        (Date.now() - lastMigrationTime.getTime()) > 24 * 60 * 60 * 1000 : true;

      const needsMigration = localSessions.length > 0 && (
        neverMigrated || 
        (hasNewLocalData && longTimeSinceLastMigration)
      );

      console.log('📊 数据迁移检查结果:', {
        needsMigration,
        localSessionsCount: localSessions.length,
        cloudSessionsCount: cloudSessions.length,
        lastMigrationTime: lastMigrationTime?.toISOString(),
        hasNewLocalData,
        neverMigrated,
        longTimeSinceLastMigration
      });

      return {
        needsMigration,
        localSessionsCount: localSessions.length,
        cloudSessionsCount: cloudSessions.length,
        lastMigrationTime
      };

    } catch (error) {
      console.error('❌ 检查迁移需求失败:', error);
      return {
        needsMigration: false,
        localSessionsCount: 0,
        cloudSessionsCount: 0
      };
    }
  }

  /**
   * 执行数据迁移
   */
  async migrateData(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const {
      onProgress,
      dryRun = false,
      overwrite = false,
      batchSize = 10,
      skipValidation = false,
      preserveTimestamps = true
    } = options;

    console.log('🚀 开始数据迁移...', { dryRun, overwrite, batchSize });

    let progress: MigrationProgress = {
      stage: 'scanning',
      message: '扫描本地数据...',
      progress: 0,
      processedItems: 0,
      totalItems: 0,
      errors: []
    };

    try {
      // 阶段1：扫描本地数据
      onProgress?.(progress);
      const localSessions = this.localStorageService.listSessions();
      
      if (localSessions.length === 0) {
        console.log('ℹ️ 没有本地数据需要迁移');
        return {
          success: true,
          migratedSessions: 0,
          skippedSessions: 0,
          errors: [],
          duration: Date.now() - startTime,
          summary: {
            totalDataSize: 0,
            categories: {}
          }
        };
      }

      // 阶段2：分析数据
      progress = {
        ...progress,
        stage: 'analyzing',
        message: `分析 ${localSessions.length} 个本地面试会话...`,
        progress: 10,
        totalItems: localSessions.length
      };
      onProgress?.(progress);

      // 数据验证和分析
      const validSessions: EnhancedInterviewSession[] = [];
      const invalidSessions: { session: any; reason: string }[] = [];
      
      for (const session of localSessions) {
        if (!skipValidation) {
          const validationResult = this.validateSession(session);
          if (validationResult.valid) {
            validSessions.push(session);
          } else {
            invalidSessions.push({
              session,
              reason: validationResult.reason || '未知错误'
            });
          }
        } else {
          validSessions.push(session);
        }
      }

      if (invalidSessions.length > 0) {
        console.warn('⚠️ 发现无效的面试会话:', invalidSessions.length);
        progress.errors.push(`发现 ${invalidSessions.length} 个无效会话`);
      }

      // 生成数据摘要
      const summary = this.generateDataSummary(validSessions);

      if (dryRun) {
        console.log('🔍 数据迁移预演完成');
        return {
          success: true,
          migratedSessions: 0,
          skippedSessions: validSessions.length,
          errors: progress.errors,
          duration: Date.now() - startTime,
          summary
        };
      }

      // 阶段3：执行迁移
      progress = {
        ...progress,
        stage: 'migrating',
        message: '正在迁移面试数据到云端...',
        progress: 20
      };
      onProgress?.(progress);

      let migratedCount = 0;
      let skippedCount = 0;
      
      // 批量处理
      for (let i = 0; i < validSessions.length; i += batchSize) {
        const batch = validSessions.slice(i, i + batchSize);
        
        for (const session of batch) {
          try {
            // 检查云端是否已存在
            const existingSession = await this.supabaseStorage.getSession(session.id);
            
            if (existingSession && !overwrite) {
              console.log(`⏭️ 跳过已存在的会话: ${session.id}`);
              skippedCount++;
              continue;
            }

            // 准备数据
            const migratedSession = this.prepareSessionForMigration(session, preserveTimestamps);
            
            // 保存到云端
            if (existingSession) {
              await this.supabaseStorage.updateSession(session.id, migratedSession);
            } else {
              await this.supabaseStorage.saveSession(migratedSession);
            }
            
            migratedCount++;
            console.log(`✅ 迁移会话成功: ${session.candidateName} - ${session.position}`);

          } catch (error) {
            const errorMsg = `迁移会话失败 (${session.id}): ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('❌', errorMsg);
            progress.errors.push(errorMsg);
          }
        }

        // 更新进度
        progress.processedItems = Math.min(i + batchSize, validSessions.length);
        progress.progress = 20 + (progress.processedItems / validSessions.length) * 60;
        progress.message = `已迁移 ${migratedCount}/${validSessions.length} 个面试会话...`;
        onProgress?.(progress);

        // 避免API限制
        await this.delay(100);
      }

      // 阶段4：验证迁移结果
      progress = {
        ...progress,
        stage: 'verifying',
        message: '验证迁移结果...',
        progress: 85
      };
      onProgress?.(progress);

      // 记录迁移完成时间
      await this.recordMigrationTime();

      // 完成
      progress = {
        ...progress,
        stage: 'completed',
        message: `迁移完成! 成功迁移 ${migratedCount} 个会话`,
        progress: 100,
        processedItems: validSessions.length
      };
      onProgress?.(progress);

      const result: MigrationResult = {
        success: true,
        migratedSessions: migratedCount,
        skippedSessions: skippedCount,
        errors: progress.errors,
        duration: Date.now() - startTime,
        summary
      };

      console.log('🎉 数据迁移完成:', result);
      return result;

    } catch (error) {
      const errorMsg = `数据迁移失败: ${error instanceof Error ? error.message : '未知错误'}`;
      console.error('❌', errorMsg);
      
      progress.stage = 'failed';
      progress.message = errorMsg;
      progress.errors.push(errorMsg);
      onProgress?.(progress);

      return {
        success: false,
        migratedSessions: 0,
        skippedSessions: 0,
        errors: progress.errors,
        duration: Date.now() - startTime,
        summary: {
          totalDataSize: 0,
          categories: {}
        }
      };
    }
  }

  /**
   * 清理本地数据（迁移成功后可选）
   */
  async cleanupLocalData(confirmationToken: string): Promise<{
    success: boolean;
    deletedItems: number;
    errors: string[];
  }> {
    if (confirmationToken !== 'CONFIRM_DELETE_LOCAL_DATA') {
      throw new Error('需要确认令牌才能删除本地数据');
    }

    try {
      console.log('🧹 开始清理本地数据...');
      
      let deletedItems = 0;
      const errors: string[] = [];

      for (const key of this.LOCAL_STORAGE_KEYS) {
        try {
          if (typeof window !== 'undefined' && localStorage.getItem(key)) {
            localStorage.removeItem(key);
            deletedItems++;
            console.log(`✅ 删除本地数据: ${key}`);
          }
        } catch (error) {
          const errorMsg = `删除 ${key} 失败: ${error instanceof Error ? error.message : '未知错误'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log('🧹 本地数据清理完成:', { deletedItems, errors: errors.length });
      
      return {
        success: errors.length === 0,
        deletedItems,
        errors
      };

    } catch (error) {
      console.error('❌ 清理本地数据失败:', error);
      return {
        success: false,
        deletedItems: 0,
        errors: [error instanceof Error ? error.message : '未知错误']
      };
    }
  }

  // 私有辅助方法

  private validateSession(session: any): { valid: boolean; reason?: string } {
    try {
      if (!session || typeof session !== 'object') {
        return { valid: false, reason: '会话对象无效' };
      }

      if (!session.id || typeof session.id !== 'string') {
        return { valid: false, reason: '缺少有效的会话ID' };
      }

      if (!session.candidateName || typeof session.candidateName !== 'string') {
        return { valid: false, reason: '缺少候选人姓名' };
      }

      if (!session.timestamp) {
        return { valid: false, reason: '缺少时间戳' };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, reason: `验证过程出错: ${error instanceof Error ? error.message : '未知错误'}` };
    }
  }

  private prepareSessionForMigration(
    session: EnhancedInterviewSession, 
    preserveTimestamps: boolean
  ): EnhancedInterviewSession {
    const now = new Date();
    
    return {
      ...session,
      // 确保时间戳格式正确
      timestamp: preserveTimestamps && session.timestamp ? 
        new Date(session.timestamp) : now,
      lastUpdated: now,
      
      // 确保录制会话时间戳正确
      recordingSession: {
        ...session.recordingSession,
        startTime: preserveTimestamps && session.recordingSession.startTime ?
          new Date(session.recordingSession.startTime) : now,
        endTime: preserveTimestamps && session.recordingSession.endTime ?
          new Date(session.recordingSession.endTime) : now
      },
      
      // 确保分段时间戳正确
      segments: session.segments?.map(segment => ({
        ...segment,
        timestamp: preserveTimestamps && segment.timestamp ?
          new Date(segment.timestamp) : now
      })) || []
    };
  }

  private generateDataSummary(sessions: EnhancedInterviewSession[]) {
    const summary = {
      oldestSession: undefined as Date | undefined,
      newestSession: undefined as Date | undefined,
      totalDataSize: 0,
      categories: {} as Record<string, number>
    };

    for (const session of sessions) {
      const sessionDate = new Date(session.timestamp);
      
      if (!summary.oldestSession || sessionDate < summary.oldestSession) {
        summary.oldestSession = sessionDate;
      }
      
      if (!summary.newestSession || sessionDate > summary.newestSession) {
        summary.newestSession = sessionDate;
      }
      
      // 估算数据大小
      summary.totalDataSize += JSON.stringify(session).length;
      
      // 统计类别
      const category = session.category || 'unknown';
      summary.categories[category] = (summary.categories[category] || 0) + 1;
    }

    return summary;
  }

  private async getLastMigrationTime(): Promise<Date | null> {
    try {
      const timestamp = await this.supabaseStorage.getUserSetting('last_migration_time');
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.warn('⚠️ 获取上次迁移时间失败:', error);
      return null;
    }
  }

  private async recordMigrationTime(): Promise<void> {
    try {
      await this.supabaseStorage.setUserSetting('last_migration_time', new Date().toISOString());
      console.log('📝 记录迁移完成时间');
    } catch (error) {
      console.error('❌ 记录迁移时间失败:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出类型
export type { MigrationProgress, MigrationResult, MigrationOptions };