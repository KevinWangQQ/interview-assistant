// 🏗️ 存储服务统一导出 - 提供统一的存储服务访问接口

// 导出各个服务类
export { UserProfileService } from './user-profile.service';
export { InterviewSessionService } from './interview-session.service';
export { PositionTemplateService } from './position-template.service';
export { SettingsService } from './settings.service';

// 导出服务接口
export type { IPositionTemplateService } from './position-template.service';
export type { ISettingsService } from './settings.service';

// 为了向后兼容，暂时保留原有的统一服务类
// TODO: 逐步迁移到拆分的服务类，然后移除这个兼容层

import { UserProfileService } from './user-profile.service';
import { InterviewSessionService } from './interview-session.service';
import { PositionTemplateService } from './position-template.service';
import { SettingsService } from './settings.service';
import { IUserProfileService, IInterviewStorageService } from '../interfaces';

/**
 * 统一存储服务 - 兼容性包装器
 * 
 * @deprecated 请直接使用拆分后的专门服务类：
 * - UserProfileService: 用户资料管理
 * - InterviewSessionService: 面试会话管理  
 * - PositionTemplateService: 岗位模板管理
 * - SettingsService: 用户设置管理
 */
export class SupabaseUserProfileService implements IUserProfileService, IInterviewStorageService {
  private userProfileService: UserProfileService;
  private interviewSessionService: InterviewSessionService;
  private positionTemplateService: PositionTemplateService;
  private settingsService: SettingsService;

  constructor() {
    this.userProfileService = new UserProfileService();
    this.interviewSessionService = new InterviewSessionService();
    this.positionTemplateService = new PositionTemplateService();
    this.settingsService = new SettingsService();
  }

  // 设置用户ID（同步到所有服务）
  setUserId(userId: string | null): void {
    this.userProfileService.setUserId(userId);
    this.interviewSessionService.setUserId(userId);
    this.positionTemplateService.setUserId(userId);
    this.settingsService.setUserId(userId);
  }

  // 用户资料相关方法（委托给 UserProfileService）
  async getProfile() {
    return this.userProfileService.getProfile();
  }

  async updateProfile(updates: any) {
    return this.userProfileService.updateProfile(updates);
  }

  async deleteProfile() {
    return this.userProfileService.deleteProfile();
  }

  // 面试会话相关方法（委托给 InterviewSessionService）
  async saveInterviewSession(session: any) {
    return this.interviewSessionService.saveInterviewSession(session);
  }

  async getInterviewSession(sessionId: string) {
    return this.interviewSessionService.getInterviewSession(sessionId);
  }

  async updateInterviewSession(sessionId: string, updates: any) {
    return this.interviewSessionService.updateInterviewSession(sessionId, updates);
  }

  async deleteInterviewSession(sessionId: string) {
    return this.interviewSessionService.deleteInterviewSession(sessionId);
  }

  async getInterviewSessions(options: any = {}) {
    return this.interviewSessionService.getInterviewSessions(options);
  }

  async saveTranscriptionSegments(sessionId: string, segments: any[]) {
    return this.interviewSessionService.saveTranscriptionSegments(sessionId, segments);
  }

  async getTranscriptionSegments(sessionId: string) {
    return this.interviewSessionService.getTranscriptionSegments(sessionId);
  }

  // 岗位模板相关方法（委托给 PositionTemplateService）
  async getPositionTemplates() {
    return this.positionTemplateService.getPositionTemplates();
  }

  async getPositionTemplate(id: string) {
    return this.positionTemplateService.getPositionTemplate(id);
  }

  async createPositionTemplate(template: any) {
    return this.positionTemplateService.createPositionTemplate(template);
  }

  async updatePositionTemplate(id: string, updates: any) {
    return this.positionTemplateService.updatePositionTemplate(id, updates);
  }

  async deletePositionTemplate(id: string) {
    return this.positionTemplateService.deletePositionTemplate(id);
  }

  // 设置相关方法（委托给 SettingsService）
  async getSetting(key: string) {
    return this.settingsService.getSetting(key);
  }

  async setSetting(key: string, value: any) {
    return this.settingsService.setSetting(key, value);
  }

  async getSettings() {
    return this.settingsService.getSettings();
  }

  async updateSettings(settings: any) {
    return this.settingsService.updateSettings(settings);
  }

  // 扩展方法 - 访问独立服务实例
  get userProfile() {
    return this.userProfileService;
  }

  get interviewSession() {
    return this.interviewSessionService;
  }

  get positionTemplate() {
    return this.positionTemplateService;
  }

  get settings() {
    return this.settingsService;
  }
}

/**
 * 创建存储服务实例的工厂函数
 */
export function createStorageServices() {
  return {
    userProfile: new UserProfileService(),
    interviewSession: new InterviewSessionService(),
    positionTemplate: new PositionTemplateService(),
    settings: new SettingsService(),
    
    // 设置统一的用户ID
    setUserId(userId: string | null) {
      this.userProfile.setUserId(userId);
      this.interviewSession.setUserId(userId);
      this.positionTemplate.setUserId(userId);
      this.settings.setUserId(userId);
    }
  };
}

// 默认导出兼容性服务
export default SupabaseUserProfileService;