// 🔄 认证回调处理 - Google OAuth登录后的回调处理
// 职责：仅处理OAuth认证流程，用户初始化交给专门的服务

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get('redirect_to')?.toString();

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient(cookieStore);
    
    try {
      // 1. 交换授权码为会话
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('认证回调错误:', error);
        console.error('错误详情:', { code: error.status, message: error.message });
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
      
      // 2. 用户初始化（独立处理，不影响认证流程）
      if (data?.session?.user) {
        console.log('✅ 用户登录成功:', data.session.user.email);
        
        // 使用专门的用户服务处理初始化
        await handleUserInitialization(data.session.user, supabase);
      }
      
      // 3. 重定向到目标页面
      const finalRedirectTo = redirectTo || '/';
      return NextResponse.redirect(`${origin}${finalRedirectTo}`);
      
    } catch (error) {
      console.error('认证处理异常:', error);
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent('认证处理失败')}`);
    }
  }

  // 没有code参数，重定向到首页
  return NextResponse.redirect(`${origin}/`);
}

/**
 * 用户初始化处理 - 简化的直接数据库操作版本
 * 职责：仅创建基本用户Profile，避免复杂服务依赖
 */
async function handleUserInitialization(user: any, supabase: any): Promise<void> {
  try {
    console.log('🔄 开始用户初始化...');
    
    // 直接使用Supabase客户端，避免服务层的复杂依赖
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!existingProfile) {
      // 只创建基本的用户Profile，不涉及其他表
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '用户',
          avatar_url: user.user_metadata?.avatar_url || null,
          settings: {
            ui: { theme: 'system', language: 'zh-CN' },
            audio: { quality: 'high', enableSystemAudio: true },
            privacy: { enableCloudSync: true }
          },
          preferences: {
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('❌ 用户Profile创建失败:', error);
      } else {
        console.log('✅ 用户Profile创建成功:', data.id);
      }
    } else {
      console.log('✅ 用户Profile已存在，跳过创建');
    }

  } catch (error) {
    // 用户初始化失败不应该影响登录流程
    console.warn('⚠️ 用户初始化异常（不影响登录）:', error);
  }
}