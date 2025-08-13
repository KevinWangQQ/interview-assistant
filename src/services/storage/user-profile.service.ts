// 🔐 用户资料管理服务 - 专注于用户Profile的CRUD操作

import { createClientComponentClient } from '@/lib/supabase/client';
import { IUserProfileService, UserProfile } from '../interfaces';
import type { SupabaseClient } from '@supabase/supabase-js';

export class UserProfileService {
  private supabase: SupabaseClient;
  private userId: string | null = null;
  private useLocalFallback = false;

  constructor() {
    this.supabase = createClientComponentClient();
  }

  // 设置当前用户ID
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  // 本地存储键名
  private getLocalStorageKey(): string {
    return `user_profile_${this.userId}`;
  }

  // 从本地存储获取用户配置
  private getLocalProfile(): UserProfile | null {
    if (!this.userId || typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(this.getLocalStorageKey());
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        created_at: new Date(parsed.created_at),
        updated_at: new Date(parsed.updated_at)
      };
    } catch (error) {
      console.error('读取本地用户配置失败:', error);
      return null;
    }
  }

  // 保存用户配置到本地存储
  private saveLocalProfile(profile: UserProfile): void {
    if (!this.userId || typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(profile));
    } catch (error) {
      console.error('保存本地用户配置失败:', error);
    }
  }

  // 检查是否应使用本地存储降级
  private async shouldUseLocalFallback(): Promise<boolean> {
    if (this.useLocalFallback) return true;

    try {
      // 快速测试数据库连接
      const { error } = await this.supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (error && (error.code === '42P01' || error.code === '42501')) {
        console.warn('数据库不可用，启用本地存储降级模式');
        this.useLocalFallback = true;
        return true;
      }

      return false;
    } catch (error) {
      console.warn('数据库连接测试失败，启用本地存储降级模式:', error);
      this.useLocalFallback = true;
      return true;
    }
  }

  // 获取用户资料
  async getProfile(): Promise<UserProfile | null> {
    if (!this.userId) return null;

    // 检查是否应使用本地存储降级
    if (await this.shouldUseLocalFallback()) {
      console.log('使用本地存储获取用户配置');
      return this.getLocalProfile();
    }

    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // 用户资料不存在
        }
        
        if (error.code === '42P01' || error.code === '42501') {
          // 表不存在或权限不足，启用本地存储降级
          console.warn('数据库表不可用，启用本地存储降级模式');
          this.useLocalFallback = true;
          return this.getLocalProfile();
        }
        
        console.warn('获取用户资料时出现错误:', error);
        return null;
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 获取用户资料异常:', error);
      // 发生异常时也尝试本地存储
      console.log('尝试从本地存储获取用户配置');
      return this.getLocalProfile();
    }
  }

  // 创建或更新用户资料（Upsert操作）
  async upsertProfile(profileData: {
    user_id: string;
    display_name?: string;
    avatar_url?: string;
    settings?: Record<string, any>;
  }): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .upsert({
          user_id: profileData.user_id,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url,
          settings: profileData.settings || {},
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('用户资料upsert失败:', error);
        return null;
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('用户资料处理异常:', error);
      return null;
    }
  }

  // 更新用户资料
  async updateProfile(updates: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    // 检查是否应使用本地存储降级
    if (await this.shouldUseLocalFallback()) {
      console.log('使用本地存储更新用户配置');
      
      let existingProfile = this.getLocalProfile();
      if (!existingProfile) {
        // 创建默认配置
        existingProfile = {
          id: crypto.randomUUID(),
          user_id: this.userId,
          display_name: updates.display_name || '用户',
          avatar_url: undefined,
          settings: updates.settings || {
            language: 'zh',
            theme: 'system',
            notifications: true,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          },
          preferences: {},
          created_at: new Date(),
          updated_at: new Date()
        };
      } else {
        // 更新现有配置
        existingProfile = {
          ...existingProfile,
          ...updates,
          updated_at: new Date()
        };
      }
      
      this.saveLocalProfile(existingProfile);
      return;
    }

    try {
      // 首先尝试获取现有资料
      const existingProfile = await this.getProfile();
      
      if (!existingProfile) {
        // 如果资料不存在，先创建资料
        console.log('用户资料不存在，先创建资料...');
        const newProfile = await this.upsertProfile({
          user_id: this.userId,
          display_name: updates.display_name || '用户',
          settings: updates.settings || {
            language: 'zh',
            theme: 'system',
            notifications: true,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          }
        });
        
        if (!newProfile) {
          throw new Error('创建用户资料失败');
        }
        return;
      }

      // 如果资料存在，正常更新
      const { error } = await this.supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.userId);

      if (error) {
        // 如果更新失败，可能是表权限问题，启用本地存储降级
        console.warn('数据库更新失败，启用本地存储降级模式:', error);
        this.useLocalFallback = true;
        
        const updatedProfile = {
          ...existingProfile,
          ...updates,
          updated_at: new Date()
        };
        
        this.saveLocalProfile(updatedProfile);
        return;
      }

    } catch (error) {
      console.error('❌ 更新用户资料失败，尝试本地存储降级:', error);
      
      // 异常时使用本地存储降级
      this.useLocalFallback = true;
      let existingProfile = this.getLocalProfile();
      
      if (!existingProfile) {
        existingProfile = {
          id: crypto.randomUUID(),
          user_id: this.userId,
          display_name: updates.display_name || '用户',
          avatar_url: undefined,
          settings: updates.settings || {
            language: 'zh',
            theme: 'system',
            notifications: true,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          },
          preferences: {},
          created_at: new Date(),
          updated_at: new Date()
        };
      } else {
        existingProfile = {
          ...existingProfile,
          ...updates,
          updated_at: new Date()
        };
      }
      
      this.saveLocalProfile(existingProfile);
    }
  }

  // 删除用户资料
  async deleteProfile(): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 删除用户资料失败:', error);
      throw error;
    }
  }

  // 用户设置快捷操作
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

  // 批量操作支持
  async bulkUpdateProfiles(updates: Array<{
    user_id: string;
    data: Partial<UserProfile>;
  }>): Promise<void> {
    try {
      const upsertData = updates.map(({ user_id, data }) => ({
        user_id,
        ...data,
        updated_at: new Date().toISOString()
      }));

      const { error } = await this.supabase
        .from('user_profiles')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 批量更新用户资料失败:', error);
      throw error;
    }
  }
}