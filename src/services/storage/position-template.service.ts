// 📋 岗位模板管理服务 - 支持优雅降级的岗位模板功能

import { createClientComponentClient } from '@/lib/supabase/client';
import { PositionTemplate } from '../interfaces';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IPositionTemplateService {
  setUserId(userId: string | null): void;
  getPositionTemplates(): Promise<PositionTemplate[]>;
  getPositionTemplate(id: string): Promise<PositionTemplate | null>;
  createPositionTemplate(template: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<PositionTemplate>;
  updatePositionTemplate(id: string, updates: Partial<PositionTemplate>): Promise<void>;
  deletePositionTemplate(id: string): Promise<void>;
  isFeatureAvailable(): Promise<boolean>;
}

/**
 * 岗位模板管理服务
 * 
 * 设计原则：优雅降级
 * - 当数据库表不存在时，提供默认模板
 * - 功能可用性检测
 * - 错误不会中断主流程
 */
export class PositionTemplateService implements IPositionTemplateService {
  private supabase: SupabaseClient;
  private userId: string | null = null;
  private featureEnabled: boolean | null = null; // 功能可用性缓存

  // 默认模板数据（当数据库不可用时使用）
  private static readonly DEFAULT_TEMPLATES: Omit<PositionTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
    {
      name: '软件工程师（通用）',
      description: '通用软件开发岗位的面试模板',
      requirements: '编程基础、算法思维、系统设计、项目经验',
      evaluation_criteria: {
        technical_skills: 40,
        problem_solving: 30,
        communication: 20,
        experience: 10
      },
      is_active: true,
      is_default: true
    },
    {
      name: '产品经理（通用）',
      description: '通用产品管理岗位的面试模板',
      requirements: '产品思维、数据分析、用户体验、项目管理',
      evaluation_criteria: {
        product_sense: 35,
        analytical_skills: 25,
        leadership: 25,
        communication: 15
      },
      is_active: true,
      is_default: true
    }
  ];

  constructor() {
    this.supabase = createClientComponentClient();
  }

  setUserId(userId: string | null): void {
    this.userId = userId;
    this.featureEnabled = null; // 重置缓存
  }

  /**
   * 检测岗位模板功能是否可用
   */
  async isFeatureAvailable(): Promise<boolean> {
    if (this.featureEnabled !== null) {
      return this.featureEnabled;
    }

    try {
      // 尝试查询表结构来检测功能可用性
      const { error } = await this.supabase
        .from('position_templates')
        .select('id')
        .limit(1);

      this.featureEnabled = !error;
      return this.featureEnabled;

    } catch (error) {
      console.warn('📋 岗位模板功能不可用，使用默认模板');
      this.featureEnabled = false;
      return false;
    }
  }

  /**
   * 获取岗位模板列表（支持降级）
   */
  async getPositionTemplates(): Promise<PositionTemplate[]> {
    const isAvailable = await this.isFeatureAvailable();
    
    if (!isAvailable) {
      // 降级：返回静态默认模板
      return this.getDefaultTemplates();
    }

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
        console.warn('获取岗位模板失败，使用默认模板:', error);
        return this.getDefaultTemplates();
      }

      return (data || []).map(template => ({
        ...template,
        created_at: new Date(template.created_at),
        updated_at: new Date(template.updated_at)
      }));

    } catch (error) {
      console.warn('获取岗位模板异常，使用默认模板:', error);
      return this.getDefaultTemplates();
    }
  }

  /**
   * 获取单个岗位模板
   */
  async getPositionTemplate(id: string): Promise<PositionTemplate | null> {
    const isAvailable = await this.isFeatureAvailable();
    
    if (!isAvailable) {
      // 降级：从默认模板中查找
      const defaultTemplates = this.getDefaultTemplates();
      return defaultTemplates.find(t => t.id === id) || null;
    }

    if (!this.userId) return null;

    try {
      const { data, error } = await this.supabase
        .from('position_templates')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
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

  /**
   * 创建岗位模板
   */
  async createPositionTemplate(template: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<PositionTemplate> {
    const isAvailable = await this.isFeatureAvailable();
    
    if (!isAvailable) {
      throw new Error('岗位模板功能暂时不可用，请联系管理员');
    }

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

  /**
   * 更新岗位模板
   */
  async updatePositionTemplate(id: string, updates: Partial<Omit<PositionTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const isAvailable = await this.isFeatureAvailable();
    
    if (!isAvailable) {
      throw new Error('岗位模板功能暂时不可用，请联系管理员');
    }

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

  /**
   * 删除岗位模板
   */
  async deletePositionTemplate(id: string): Promise<void> {
    const isAvailable = await this.isFeatureAvailable();
    
    if (!isAvailable) {
      throw new Error('岗位模板功能暂时不可用，请联系管理员');
    }

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

    } catch (error) {
      console.error('❌ 删除岗位模板失败:', error);
      throw error;
    }
  }

  /**
   * 获取默认模板（降级模式）
   */
  private getDefaultTemplates(): PositionTemplate[] {
    const now = new Date();
    
    return PositionTemplateService.DEFAULT_TEMPLATES.map((template, index) => ({
      id: `default-template-${index + 1}`,
      user_id: this.userId || 'anonymous',
      ...template,
      created_at: now,
      updated_at: now
    }));
  }

  /**
   * 重置功能可用性缓存（用于测试或手动刷新）
   */
  resetFeatureAvailabilityCache(): void {
    this.featureEnabled = null;
  }
}