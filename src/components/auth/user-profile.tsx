// 👤 用户头像和菜单组件

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface UserProfileProps {
  className?: string;
  onSettingsClick?: () => void;
}

export function UserProfile({ className, onSettingsClick }: UserProfileProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, signOut } = useAuth();

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '用户';
  const avatarUrl = user.user_metadata?.avatar_url;
  const email = user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`relative h-8 w-8 rounded-full hover:ring-2 hover:ring-primary/20 transition-all ${className}`}
        >
          <Avatar className="h-8 w-8">
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {email && (
              <p className="text-xs leading-none text-muted-foreground">
                {email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => {
            // 这里可以添加用户信息页面
            console.log('查看用户信息');
          }}
        >
          <User className="mr-2 h-4 w-4" />
          个人信息
        </DropdownMenuItem>
        
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={onSettingsClick}
        >
          <Settings className="mr-2 h-4 w-4" />
          设置
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          {isSigningOut ? '正在登出...' : '登出'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 用户信息展示组件（用于其他地方）
export function UserInfo({ className }: { className?: string }) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || '用户';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Avatar className="h-6 w-6">
        {user.user_metadata?.avatar_url && (
          <AvatarImage src={user.user_metadata.avatar_url} alt={displayName} />
        )}
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{displayName}</span>
    </div>
  );
}