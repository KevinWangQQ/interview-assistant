// 🔐 Supabase客户端配置 - 支持SSR和客户端渲染

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// 环境变量类型检查
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少Supabase环境变量: NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// 🌐 浏览器客户端 - 用于客户端组件
export const createClientComponentClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// Note: 服务器端客户端已移至单独文件 server.ts 以避免在客户端组件中导入 next/headers

// 📡 API路由客户端 - 用于API路由（auth callback等）
export const createRouteHandlerClient = (cookieStore: any) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options: any) {
        cookieStore.set(name, '', { ...options, maxAge: 0 });
      },
    },
  });
};

// 🔧 管理客户端 - 用于需要服务角色权限的操作
export const createAdminClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    throw new Error('缺少Supabase服务角色密钥: SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// 🎯 默认客户端 - 向后兼容
export const supabase = createClientComponentClient();