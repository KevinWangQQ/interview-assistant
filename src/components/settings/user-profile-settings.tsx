// 👤 用户配置设置页面 - V2.0个性化配置

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Calendar,
  Settings2,
  Check,
  AlertTriangle,
  Loader2,
  Cloud,
  Database,
  Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { UserProfileService, SettingsService } from '@/services/storage';
import { UserProfile } from '@/services/interfaces';

interface UserProfileSettingsProps {
  className?: string;
}

export function UserProfileSettings({ className }: UserProfileSettingsProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    display_name: '',
    settings: {
      language: 'zh',
      theme: 'system',
      notifications: true,
      autoGenerateSummary: true,
      defaultPrivacyLevel: 'internal'
    }
  });

  const userProfileService = new UserProfileService();
  const settingsService = new SettingsService();

  // 设置用户ID并加载配置
  useEffect(() => {
    if (user?.id) {
      userProfileService.setUserId(user.id);
      settingsService.setUserId(user.id);
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) {
      console.log('用户未登录，跳过加载用户资料');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      console.log('开始加载用户资料，用户ID:', user.id);
      
      let userProfile = await userProfileService.getProfile();
      console.log('获取到的用户资料:', userProfile);
      
      // 如果用户资料不存在，创建默认资料
      if (!userProfile) {
        console.log('用户资料不存在，创建默认资料...');
        userProfile = await userProfileService.upsertProfile({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '用户',
          avatar_url: user.user_metadata?.avatar_url || null,
          settings: {
            language: 'zh',
            theme: 'system',
            notifications: true,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          }
        });
        console.log('创建的用户资料:', userProfile);
      }
      
      if (userProfile) {
        setProfile(userProfile);
        setFormData({
          display_name: userProfile.display_name || '',
          settings: {
            ...formData.settings,
            ...userProfile.settings
          }
        });
        console.log('用户资料加载完成');
      }
    } catch (error) {
      console.error('加载用户配置失败:', error);
      setError('加载用户配置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      await userProfileService.updateProfile({
        display_name: formData.display_name.trim() || undefined,
        settings: formData.settings
      });

      setSuccess('用户配置更新成功');
      await loadProfile(); // 重新加载配置

    } catch (error) {
      console.error('更新用户配置失败:', error);
      setError('更新用户配置失败，请重试');
    } finally {
      setUpdating(false);
    }
  };

  const handleMigrateData = async () => {
    if (!confirm('确定要将本地数据迁移到云端吗？这个过程可能需要几分钟时间。')) {
      return;
    }

    setMigrating(true);
    setError(null);
    setSuccess(null);

    try {
      // 数据迁移功能暂时不可用，需要专门的迁移服务
      console.warn('数据迁移功能暂时不可用');
      setError('数据迁移功能暂时不可用，请联系管理员');
      return;

    } catch (error) {
      console.error('数据迁移失败:', error);
      setError('数据迁移失败，请重试');
    } finally {
      setMigrating(false);
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>请先登录以访问用户配置</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            用户配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayName = formData.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '用户';
  const joinDate = user.created_at ? new Date(user.created_at) : new Date();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 用户基本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            个人信息
          </CardTitle>
          <CardDescription>
            管理您的个人资料和账号设置
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <Check className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-start gap-6">
            {/* 头像部分 */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                {user.user_metadata?.avatar_url && (
                  <AvatarImage src={user.user_metadata.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Badge variant="secondary" className="text-xs">
                <Cloud className="h-3 w-3 mr-1" />
                云端账号
              </Badge>
            </div>

            {/* 基本信息 */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">邮箱：</span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">加入时间：</span>
                  <span className="font-medium">{joinDate.toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="display_name">显示名称</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="输入您希望显示的名称"
                    className="max-w-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    这将在界面中显示为您的名称
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <Button type="submit" disabled={updating}>
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        更新资料
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 应用设置卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            应用设置
          </CardTitle>
          <CardDescription>
            个性化您的使用体验
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 语言设置 */}
          <div>
            <Label htmlFor="language">界面语言</Label>
            <select
              id="language"
              value={formData.settings.language}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: { ...prev.settings, language: e.target.value }
              }))}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* 主题设置 */}
          <div>
            <Label htmlFor="theme">界面主题</Label>
            <select
              id="theme"
              value={formData.settings.theme}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: { ...prev.settings, theme: e.target.value }
              }))}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色模式</option>
              <option value="dark">深色模式</option>
            </select>
          </div>

          {/* 功能设置 */}
          <div className="space-y-4">
            <h4 className="font-medium">功能设置</h4>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoGenerateSummary"
                checked={formData.settings.autoGenerateSummary}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, autoGenerateSummary: e.target.checked }
                }))}
                className="rounded border-input"
              />
              <Label htmlFor="autoGenerateSummary">面试结束后自动生成总结</Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="notifications"
                checked={formData.settings.notifications}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, notifications: e.target.checked }
                }))}
                className="rounded border-input"
              />
              <Label htmlFor="notifications">接收系统通知</Label>
            </div>
          </div>

          {/* 隐私设置 */}
          <div>
            <Label htmlFor="defaultPrivacyLevel">默认面试记录隐私级别</Label>
            <select
              id="defaultPrivacyLevel"
              value={formData.settings.defaultPrivacyLevel}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: { ...prev.settings, defaultPrivacyLevel: e.target.value }
              }))}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="public">公开</option>
              <option value="internal">内部</option>
              <option value="confidential">机密</option>
              <option value="restricted">受限</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* 数据迁移卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据迁移
          </CardTitle>
          <CardDescription>
            将V1.0本地数据迁移到云端账号
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium mb-2">本地数据迁移</h4>
              <p className="text-sm text-muted-foreground mb-4">
                将浏览器本地存储的面试记录迁移到您的云端账号。迁移后，您可以在任何设备上访问这些数据。
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>此操作不会删除本地数据，仅做备份迁移</span>
              </div>
            </div>
            <Button 
              onClick={handleMigrateData}
              disabled={migrating}
              className="ml-4"
            >
              {migrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  迁移中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  开始迁移
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}