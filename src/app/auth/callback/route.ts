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
      
      // 2. 用户登录成功日志
      if (data?.session?.user) {
        console.log('✅ 用户登录成功:', data.session.user.email);
        // 注意：用户初始化将在客户端进行，避免数据库触发器问题
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

