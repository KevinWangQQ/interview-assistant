// 🔄 认证回调处理 - Google OAuth登录后的回调处理

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
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('认证回调错误:', error);
        console.error('错误详情:', { code: error.status, message: error.message });
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
      
      if (data?.session?.user) {
        console.log('✅ 用户登录成功:', data.session.user.email);
        
        // 简化用户profile创建逻辑，避免复杂的数据库操作
        try {
          // 使用upsert来处理用户profile，更安全
          const { error: upsertError } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: data.session.user.id,
              display_name: data.session.user.user_metadata?.full_name || data.session.user.email,
              avatar_url: data.session.user.user_metadata?.avatar_url,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            });
          
          if (upsertError) {
            console.error('用户profile upsert失败:', upsertError);
            // 即使profile操作失败，也继续登录流程
          } else {
            console.log('✅ 用户profile已更新');
          }
        } catch (error) {
          console.error('用户profile处理异常:', error);
          // 捕获所有异常，确保不影响登录
        }
      }
      
      // 重定向到指定页面或首页
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