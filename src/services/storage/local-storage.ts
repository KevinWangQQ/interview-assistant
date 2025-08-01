// 本地存储服务实现（MVP版本）

import Dexie, { Table } from 'dexie';
import { IStorageService } from '../interfaces';
import { InterviewSession } from '@/types';

class InterviewDatabase extends Dexie {
  interviews!: Table<InterviewSession, string>;

  constructor() {
    super('InterviewAssistantDB');
    
    this.version(1).stores({
      interviews: 'id, candidateName, position, startTime, endTime, status'
    });
  }
}

export class LocalStorageService implements IStorageService {
  private db: InterviewDatabase;

  constructor() {
    this.db = new InterviewDatabase();
  }

  async saveInterview(interview: InterviewSession): Promise<void> {
    try {
      await this.db.interviews.put(interview);
    } catch (error) {
      throw new Error(`Failed to save interview: ${error}`);
    }
  }

  async getInterview(id: string): Promise<InterviewSession | null> {
    try {
      const interview = await this.db.interviews.get(id);
      return interview || null;
    } catch (error) {
      throw new Error(`Failed to get interview: ${error}`);
    }
  }

  async listInterviews(limit = 50, offset = 0): Promise<InterviewSession[]> {
    try {
      return await this.db.interviews
        .orderBy('startTime')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();
    } catch (error) {
      throw new Error(`Failed to list interviews: ${error}`);
    }
  }

  async deleteInterview(id: string): Promise<void> {
    try {
      await this.db.interviews.delete(id);
    } catch (error) {
      throw new Error(`Failed to delete interview: ${error}`);
    }
  }

  async updateInterview(id: string, updates: Partial<InterviewSession>): Promise<void> {
    try {
      await this.db.interviews.update(id, updates);
    } catch (error) {
      throw new Error(`Failed to update interview: ${error}`);
    }
  }

  async searchInterviews(query: string): Promise<InterviewSession[]> {
    try {
      const lowerQuery = query.toLowerCase();
      return await this.db.interviews
        .filter(interview => 
          interview.candidateName.toLowerCase().includes(lowerQuery) ||
          interview.position.toLowerCase().includes(lowerQuery) ||
          interview.segments.some(segment => 
            segment.originalText.toLowerCase().includes(lowerQuery) ||
            segment.translatedText.toLowerCase().includes(lowerQuery)
          )
        )
        .toArray();
    } catch (error) {
      throw new Error(`Failed to search interviews: ${error}`);
    }
  }

  async getInterviewsByDateRange(startDate: Date, endDate: Date): Promise<InterviewSession[]> {
    try {
      return await this.db.interviews
        .where('startTime')
        .between(startDate, endDate)
        .toArray();
    } catch (error) {
      throw new Error(`Failed to get interviews by date range: ${error}`);
    }
  }

  async exportData(): Promise<string> {
    try {
      const interviews = await this.db.interviews.toArray();
      return JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        interviews
      }, null, 2);
    } catch (error) {
      throw new Error(`Failed to export data: ${error}`);
    }
  }

  async importData(data: string): Promise<void> {
    try {
      const parsedData = JSON.parse(data);
      if (!parsedData.interviews || !Array.isArray(parsedData.interviews)) {
        throw new Error('Invalid data format');
      }

      await this.db.transaction('rw', this.db.interviews, async () => {
        for (const interview of parsedData.interviews) {
          await this.db.interviews.put(interview);
        }
      });
    } catch (error) {
      throw new Error(`Failed to import data: ${error}`);
    }
  }

  async getStorageStats() {
    try {
      const totalInterviews = await this.db.interviews.count();
      
      // 估算存储大小（简单实现）
      const interviews = await this.db.interviews.toArray();
      const totalSize = JSON.stringify(interviews).length;

      return {
        totalInterviews,
        totalSize,
        lastBackup: undefined // 本地存储不支持自动备份
      };
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error}`);
    }
  }

  // 清理旧数据的辅助方法
  async cleanupOldInterviews(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldInterviews = await this.db.interviews
        .where('startTime')
        .below(cutoffDate)
        .toArray();

      await this.db.interviews
        .where('startTime')
        .below(cutoffDate)
        .delete();

      return oldInterviews.length;
    } catch (error) {
      throw new Error(`Failed to cleanup old interviews: ${error}`);
    }
  }
}