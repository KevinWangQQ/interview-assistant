// 🔐 用户认证上下文 - 全局用户状态管理

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClientComponentClient } from '@/lib/supabase/client';
import { DataMigrationService } from '@/services/migration/data-migration-service';

interface MigrationStatus {
  needsMigration: boolean;
  localSessionsCount: number;
  cloudSessionsCount: number;
  lastMigrationTime?: Date;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  migrationStatus: MigrationStatus | null;
  migrationChecked: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  checkMigrationStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必须在AuthProvider内部使用');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrationChecked, setMigrationChecked] = useState(false);
  
  const migrationService = new DataMigrationService();
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    // 获取初始会话
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('获取初始会话失败:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('认证状态变化:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // 当用户首次登录时，创建用户配置文件并检查数据迁移
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile(session.user);
          // 延迟检查迁移状态，确保用户配置完成
          setTimeout(() => {
            checkMigrationStatus();
          }, 1000);
        } else if (event === 'SIGNED_OUT') {
          // 用户登出时清除迁移状态
          setMigrationStatus(null);
          setMigrationChecked(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // 检查数据迁移状态
  const checkMigrationStatus = async () => {
    if (!user) {
      setMigrationChecked(true);
      return;
    }

    try {
      console.log('🔍 检查数据迁移状态...');
      const status = await migrationService.needsMigration();
      setMigrationStatus(status);
      
      if (status.needsMigration) {
        console.log('📊 发现需要迁移的数据:', {
          localSessions: status.localSessionsCount,
          cloudSessions: status.cloudSessionsCount
        });
      }
    } catch (error) {
      console.error('❌ 检查迁移状态失败:', error);
    } finally {
      setMigrationChecked(true);
    }
  };

  // 确保用户配置文件存在
  const ensureUserProfile = async (user: User) => {
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        // 用户配置不存在，创建新的
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '用户',
            avatar_url: user.user_metadata?.avatar_url || null,
            settings: {
              language: 'zh',
              theme: 'system',
              notifications: true
            },
            preferences: {
              autoGenerateSummary: true,
              defaultPrivacyLevel: 'internal'
            }
          });

        if (insertError) {
          console.error('创建用户配置失败:', insertError);
        } else {
          console.log('✅ 用户配置创建成功');
        }
      } else if (fetchError) {
        console.error('获取用户配置失败:', fetchError);
      }
    } catch (error) {
      console.error('确保用户配置失败:', error);
    }
  };

  // Google登录
  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // 获取正确的应用URL
      let appUrl: string;
      
      // 生产环境直接使用正确的域名
      if (typeof window !== 'undefined' && window.location.hostname === 'interview.cnbu.link') {
        appUrl = 'https://interview.cnbu.link';
      } else if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
        appUrl = window.location.origin;
      } else if (process.env.NEXT_PUBLIC_APP_URL) {
        appUrl = process.env.NEXT_PUBLIC_APP_URL;
      } else if (typeof window !== 'undefined') {
        appUrl = window.location.origin;
      } else {
        appUrl = 'https://interview.cnbu.link';
      }
      
      console.log('🔗 OAuth回调URL:', `${appUrl}/auth/callback`);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${appUrl}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Google登录失败:', error);
      setLoading(false);
      throw error;
    }
  };

  // 登出
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // 清除本地存储的相关数据
      if (typeof window !== 'undefined') {
        // 保留API密钥，但清除其他用户相关数据
        const apiKey = localStorage.getItem('openai_api_key');
        localStorage.clear();
        if (apiKey) {
          localStorage.setItem('openai_api_key', apiKey);
        }
      }
      
    } catch (error) {
      console.error('登出失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    migrationStatus,
    migrationChecked,
    signInWithGoogle,
    signOut,
    checkMigrationStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}