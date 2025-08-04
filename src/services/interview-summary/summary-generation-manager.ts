// 🚀 面试总结生成管理器 - 异步流程控制和进度跟踪

import { GPT4InterviewSummaryService, InterviewSummary } from './gpt4-summary-service';
import { TranscriptionSegment } from '@/utils/smart-segmentation';

interface SummaryGenerationProgress {
  stage: 'preparing' | 'chunking' | 'analyzing' | 'summarizing' | 'finalizing' | 'completed' | 'error';
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  estimatedTimeRemaining?: number; // 秒
  error?: string;
}

interface SummaryGenerationOptions {
  priority: 'normal' | 'high';
  includeDetailedAnalysis: boolean;
  retryAttempts: number;
  timeoutMs: number;
}

type SummaryGenerationEventType = 'progress' | 'completed' | 'error' | 'stage_changed';

interface SummaryGenerationEvent {
  type: SummaryGenerationEventType;
  data: any;
  timestamp: number;
}

export class SummaryGenerationManager {
  private summaryService: GPT4InterviewSummaryService;
  private activeJobs: Map<string, {
    segments: TranscriptionSegment[];
    options: SummaryGenerationOptions;
    progress: SummaryGenerationProgress;
    startTime: number;
    promise: Promise<InterviewSummary>;
    eventListeners: Set<(event: SummaryGenerationEvent) => void>;
  }> = new Map();

  constructor() {
    this.summaryService = new GPT4InterviewSummaryService({
      model: 'gpt-4-turbo',
      temperature: 0.3,
      analysisDepth: 'detailed'
    });
  }

  // 🚀 启动面试总结生成
  async generateSummary(
    jobId: string,
    segments: TranscriptionSegment[],
    options: Partial<SummaryGenerationOptions> = {}
  ): Promise<string> {
    console.log('🚀 启动面试总结生成任务:', jobId);

    const fullOptions: SummaryGenerationOptions = {
      priority: 'normal',
      includeDetailedAnalysis: true,
      retryAttempts: 3,
      timeoutMs: 300000, // 5分钟超时
      ...options
    };

    // 检查是否已有同名任务
    if (this.activeJobs.has(jobId)) {
      throw new Error(`任务 ${jobId} 已存在，请使用不同的ID或先取消现有任务`);
    }

    // 初始化进度状态
    const initialProgress: SummaryGenerationProgress = {
      stage: 'preparing',
      progress: 0,
      currentStep: '准备生成面试总结...',
      totalSteps: 5,
      completedSteps: 0
    };

    // 创建任务
    const jobPromise = this.executeSummaryGeneration(jobId, segments, fullOptions);

    // 注册任务
    this.activeJobs.set(jobId, {
      segments,
      options: fullOptions,
      progress: initialProgress,
      startTime: Date.now(),
      promise: jobPromise,
      eventListeners: new Set()
    });

    // 发出初始进度事件
    this.emitEvent(jobId, 'progress', initialProgress);
    this.emitEvent(jobId, 'stage_changed', { stage: 'preparing' });

    return jobId;
  }

  // 🎯 执行总结生成的核心逻辑
  private async executeSummaryGeneration(
    jobId: string,
    segments: TranscriptionSegment[],
    options: SummaryGenerationOptions
  ): Promise<InterviewSummary> {
    const job = this.activeJobs.get(jobId);
    if (!job) throw new Error(`任务 ${jobId} 不存在`);

    try {
      // 阶段1: 数据准备
      this.updateProgress(jobId, {
        stage: 'preparing',
        progress: 10,
        currentStep: '准备面试数据...',
        completedSteps: 1
      });

      await this.delay(500); // 模拟处理时间

      // 验证数据质量
      if (segments.length === 0) {
        throw new Error('没有可用的面试转录数据');
      }

      const totalWords = segments.reduce((sum, s) => sum + s.wordCount, 0);
      if (totalWords < 50) {
        throw new Error('面试转录内容过少，无法生成有意义的总结');
      }

      // 阶段2: 文本分块
      this.updateProgress(jobId, {
        stage: 'chunking',
        progress: 25,
        currentStep: '分析和分块转录内容...',
        completedSteps: 2
      });

      await this.delay(1000);

      // 阶段3: 智能分析
      this.updateProgress(jobId, {
        stage: 'analyzing',
        progress: 40,
        currentStep: '使用GPT-4分析面试表现...',
        completedSteps: 3,
        estimatedTimeRemaining: this.estimateRemainingTime(jobId, segments.length)
      });

      // 这里是实际的GPT-4调用，可能需要较长时间
      const summary = await this.callSummaryServiceWithTimeout(
        segments,
        options.timeoutMs
      );

      // 阶段4: 总结整合
      this.updateProgress(jobId, {
        stage: 'summarizing',
        progress: 80,
        currentStep: '整合分析结果...',
        completedSteps: 4
      });

      await this.delay(500);

      // 阶段5: 完成
      this.updateProgress(jobId, {
        stage: 'finalizing',
        progress: 95,
        currentStep: '完成总结生成...',
        completedSteps: 5
      });

      await this.delay(300);

      // 最终完成
      this.updateProgress(jobId, {
        stage: 'completed',
        progress: 100,
        currentStep: '面试总结已生成完成',
        completedSteps: 5
      });

      console.log('✅ 面试总结生成任务完成:', jobId);
      this.emitEvent(jobId, 'completed', { summary, jobId });

      return summary;

    } catch (error) {
      console.error('❌ 面试总结生成失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      this.updateProgress(jobId, {
        stage: 'error',
        progress: 0,
        currentStep: '生成失败',
        completedSteps: 0,
        error: errorMessage
      });

      this.emitEvent(jobId, 'error', { error: errorMessage, jobId });
      throw error;
    } finally {
      // 清理任务（在一定延迟后）
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 30000); // 30秒后清理
    }
  }

  // 🕐 带超时的总结服务调用
  private async callSummaryServiceWithTimeout(
    segments: TranscriptionSegment[],
    timeoutMs: number
  ): Promise<InterviewSummary> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`总结生成超时 (${timeoutMs / 1000}秒)`));
      }, timeoutMs);

      try {
        const summary = await this.summaryService.generateInterviewSummary(segments);
        clearTimeout(timeoutId);
        resolve(summary);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // 📊 更新任务进度
  private updateProgress(jobId: string, updates: Partial<SummaryGenerationProgress>) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.progress = { ...job.progress, ...updates };
    this.emitEvent(jobId, 'progress', job.progress);

    if (updates.stage && updates.stage !== job.progress.stage) {
      this.emitEvent(jobId, 'stage_changed', { stage: updates.stage });
    }
  }

  // ⏱️ 估算剩余时间
  private estimateRemainingTime(jobId: string, segmentCount: number): number {
    const job = this.activeJobs.get(jobId);
    if (!job) return 0;

    const elapsed = (Date.now() - job.startTime) / 1000;
    const progressRatio = job.progress.progress / 100;
    
    if (progressRatio <= 0) return 0;
    
    const totalEstimated = elapsed / progressRatio;
    const remaining = Math.max(0, totalEstimated - elapsed);
    
    // 基于分段数量调整估算
    const segmentMultiplier = Math.max(1, segmentCount / 10);
    
    return Math.round(remaining * segmentMultiplier);
  }

  // 📡 事件发射
  private emitEvent(jobId: string, type: SummaryGenerationEventType, data: any) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const event: SummaryGenerationEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    job.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`❌ 事件监听器错误 [${type}]:`, error);
      }
    });
  }

  // 📝 注册事件监听器
  addEventListener(
    jobId: string,
    listener: (event: SummaryGenerationEvent) => void
  ): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.eventListeners.add(listener);
    }
  }

  // 🗑️ 移除事件监听器
  removeEventListener(
    jobId: string,
    listener: (event: SummaryGenerationEvent) => void
  ): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.eventListeners.delete(listener);
    }
  }

  // 📊 获取任务进度
  getProgress(jobId: string): SummaryGenerationProgress | null {
    const job = this.activeJobs.get(jobId);
    return job ? { ...job.progress } : null;
  }

  // 📋 获取任务状态
  getJobStatus(jobId: string): {
    exists: boolean;
    isActive: boolean;
    progress: SummaryGenerationProgress | null;
    elapsed: number;
  } {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      return {
        exists: false,
        isActive: false,
        progress: null,
        elapsed: 0
      };
    }

    return {
      exists: true,
      isActive: job.progress.stage !== 'completed' && job.progress.stage !== 'error',
      progress: { ...job.progress },
      elapsed: (Date.now() - job.startTime) / 1000
    };
  }

  // 🎯 等待任务完成
  async waitForCompletion(jobId: string): Promise<InterviewSummary> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`任务 ${jobId} 不存在`);
    }

    return job.promise;
  }

  // 🛑 取消任务
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    try {
      // 更新状态为取消
      this.updateProgress(jobId, {
        stage: 'error',
        progress: 0,
        currentStep: '任务已取消',
        error: '用户取消了任务'
      });

      this.emitEvent(jobId, 'error', { error: '任务已取消', jobId });
      
      // 从活跃任务中移除
      this.activeJobs.delete(jobId);
      
      console.log('🛑 任务已取消:', jobId);
      return true;
      
    } catch (error) {
      console.error('❌ 取消任务失败:', error);
      return false;
    }
  }

  // 📋 获取所有活跃任务
  getActiveJobs(): Array<{
    jobId: string;
    progress: SummaryGenerationProgress;
    elapsed: number;
    segmentCount: number;
  }> {
    const jobs = [];
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      jobs.push({
        jobId,
        progress: { ...job.progress },
        elapsed: (Date.now() - job.startTime) / 1000,
        segmentCount: job.segments.length
      });
    }
    
    return jobs;
  }

  // 🧹 清理完成的任务
  cleanupCompletedJobs(): number {
    let cleaned = 0;
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.progress.stage === 'completed' || job.progress.stage === 'error') {
        const elapsed = (Date.now() - job.startTime) / 1000;
        if (elapsed > 300) { // 5分钟后清理
          this.activeJobs.delete(jobId);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 清理了 ${cleaned} 个完成的任务`);
    }
    
    return cleaned;
  }

  // ⏱️ 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 📊 获取服务统计
  getServiceStats(): {
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalProcessingTime: number;
  } {
    const active = Array.from(this.activeJobs.values());
    const activeTasks = active.filter(job => 
      job.progress.stage !== 'completed' && job.progress.stage !== 'error'
    ).length;
    
    const completedTasks = active.filter(job => 
      job.progress.stage === 'completed'
    ).length;
    
    const failedTasks = active.filter(job => 
      job.progress.stage === 'error'
    ).length;
    
    const totalProcessingTime = active.reduce((sum, job) => 
      sum + (Date.now() - job.startTime), 0
    ) / 1000;
    
    return {
      activeTasks,
      completedTasks,
      failedTasks,
      totalProcessingTime
    };
  }
}

export type { 
  SummaryGenerationProgress, 
  SummaryGenerationOptions, 
  SummaryGenerationEvent 
};