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
        
        // 检查用户profile是否存在，不存在则创建
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', data.session.user.id)
          .single();
        
        // 如果用户profile不存在（无论是null还是查询错误），都创建新的profile
        if (!profile) {
          console.log('创建新用户profile...');
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: data.session.user.id,
              display_name: data.session.user.user_metadata?.full_name || data.session.user.email,
              avatar_url: data.session.user.user_metadata?.avatar_url
            });
          
          if (insertError) {
            console.error('创建用户profile失败:', insertError);
            // 不要因为profile创建失败就阻止用户登录
          } else {
            console.log('✅ 用户profile创建成功');
          }
        } else {
          console.log('✅ 用户profile已存在');
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