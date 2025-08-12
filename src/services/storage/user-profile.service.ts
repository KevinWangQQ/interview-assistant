// 🔐 用户资料管理服务 - 专注于用户Profile的CRUD操作

import { createClientComponentClient } from '@/lib/supabase/client';
import { IUserProfileService, UserProfile } from '../interfaces';
import type { SupabaseClient } from '@supabase/supabase-js';

export class UserProfileService implements IUserProfileService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor() {
    this.supabase = createClientComponentClient();
  }

  // 设置当前用户ID
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  // 获取用户资料
  async getProfile(): Promise<UserProfile | null> {
    if (!this.userId) return null;

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
        throw error;
      }

      return {
        ...data,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 获取用户资料失败:', error);
      return null;
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
      console.error('❌ 更新用户资料失败:', error);
      throw error;
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