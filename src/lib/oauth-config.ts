// 🔐 OAuth配置管理 - 确保生产环境不使用localhost

/**
 * 获取正确的OAuth回调URL，绝不返回localhost
 */
export function getOAuthCallbackUrl(): string {
  // 强制生产域名列表
  const PRODUCTION_DOMAINS = [
    'interview.cnbu.link',
    'interview-assistant.vercel.app'
  ];
  
  let appUrl: string;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 1. 检查是否为已知的生产域名
    if (PRODUCTION_DOMAINS.includes(hostname)) {
      appUrl = `${protocol}//${hostname}`;
    }
    // 2. 检查环境变量（排除localhost）
    else if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL;
    }
    // 3. Vercel部署域名
    else if (hostname.includes('vercel.app')) {
      appUrl = `${protocol}//${hostname}`;
    }
    // 4. 其他非localhost域名
    else if (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168')) {
      appUrl = window.location.origin;
    }
    // 5. 开发环境fallback到生产域名
    else {
      appUrl = 'https://interview.cnbu.link';
      console.warn('🚨 开发环境检测到，使用生产域名作为OAuth回调');
    }
  } else {
    // SSR环境 - 使用环境变量或默认生产域名
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://interview.cnbu.link';
  }
  
  // 最终安全检查
  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    appUrl = 'https://interview.cnbu.link';
    console.error('🚨 检测到localhost配置，强制使用生产域名');
  }
  
  return `${appUrl}/auth/callback`;
}

/**
 * 验证OAuth配置是否正确
 */
export function validateOAuthConfig(): {
  isValid: boolean;
  warnings: string[];
  config: {
    callbackUrl: string;
    environment: string;
    hostname: string;
  };
} {
  const callbackUrl = getOAuthCallbackUrl();
  const warnings: string[] = [];
  
  // 检查是否使用了localhost
  if (callbackUrl.includes('localhost')) {
    warnings.push('OAuth回调URL包含localhost，这会导致生产环境登录失败');
  }
  
  // 检查环境变量
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('缺少NEXT_PUBLIC_APP_URL环境变量');
  }
  
  // 检查Supabase配置
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    warnings.push('缺少Supabase URL配置');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
    config: {
      callbackUrl,
      environment: process.env.NODE_ENV || 'unknown',
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR'
    }
  };
}