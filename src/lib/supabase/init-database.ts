// 🚀 数据库初始化工具 - 确保所有必要的表和策略都已创建

import { createClientComponentClient } from './client';

// 检查表是否存在的SQL
const CHECK_TABLE_SQL = `
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'position_templates', 'interview_sessions', 'transcription_segments')
ORDER BY table_name;
`;

// 创建用户配置表的SQL
const CREATE_USER_PROFILES_TABLE = `
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}' NOT NULL,
  preferences JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id)
);
`;

// 创建岗位模板表的SQL
const CREATE_POSITION_TEMPLATES_TABLE = `
CREATE TABLE IF NOT EXISTS position_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  requirements TEXT,
  evaluation_criteria JSONB DEFAULT '{}' NOT NULL,
  job_description TEXT,
  skills_required TEXT[],
  experience_level VARCHAR(50),
  department VARCHAR(100),
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

// 创建面试会话表的SQL
const CREATE_INTERVIEW_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position_template_id UUID REFERENCES position_templates(id) ON DELETE SET NULL,
  
  -- 基本信息
  candidate_name VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  interviewer_name VARCHAR(255),
  company VARCHAR(255),
  
  -- 会话状态
  status VARCHAR(50) DEFAULT 'active' NOT NULL,
  recording_status VARCHAR(50) DEFAULT 'stopped' NOT NULL,
  
  -- 录制信息
  recording_config JSONB DEFAULT '{}' NOT NULL,
  recording_stats JSONB DEFAULT '{}' NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  
  -- 分析结果
  summary JSONB,
  summary_status VARCHAR(50) DEFAULT 'pending',
  summary_progress INTEGER DEFAULT 0,
  
  -- 统计信息
  total_words INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  speaker_changes INTEGER DEFAULT 0,
  audio_quality_avg DECIMAL(3,2) DEFAULT 0,
  
  -- 标签和分类
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(50) DEFAULT 'mixed',
  difficulty VARCHAR(50) DEFAULT 'mid',
  confidentiality_level VARCHAR(50) DEFAULT 'internal',
  
  -- 元数据
  metadata JSONB DEFAULT '{}' NOT NULL,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

// 创建转录片段表的SQL
const CREATE_TRANSCRIPTION_SEGMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
  
  -- 内容
  english_text TEXT NOT NULL,
  chinese_text TEXT,
  speaker VARCHAR(50) DEFAULT 'unknown',
  
  -- 时间信息
  start_time INTEGER NOT NULL, -- 毫秒
  end_time INTEGER NOT NULL,   -- 毫秒
  duration INTEGER NOT NULL,   -- 毫秒
  
  -- 质量指标
  confidence_score DECIMAL(3,2) DEFAULT 0,
  audio_quality DECIMAL(3,2) DEFAULT 0,
  
  -- 标记
  is_complete BOOLEAN DEFAULT TRUE,
  is_final BOOLEAN DEFAULT TRUE,
  is_question BOOLEAN DEFAULT FALSE,
  
  -- 处理信息
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_version VARCHAR(50),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
`;

// 创建索引的SQL
const CREATE_INDEXES = `
-- 用户配置表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 岗位模板表索引
CREATE INDEX IF NOT EXISTS idx_position_templates_user_id ON position_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_position_templates_active ON position_templates(user_id, is_active) WHERE is_active = TRUE;

-- 面试会话表索引
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_created_at ON interview_sessions(user_id, created_at DESC);

-- 转录片段表索引
CREATE INDEX IF NOT EXISTS idx_transcription_segments_session_id ON transcription_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_transcription_segments_time ON transcription_segments(session_id, start_time);
`;

// 启用RLS并创建策略
const ENABLE_RLS_AND_POLICIES = `
-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_segments ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "用户只能访问自己的配置" ON user_profiles;
DROP POLICY IF EXISTS "用户只能访问自己的岗位模板" ON position_templates;
DROP POLICY IF EXISTS "用户只能访问自己的面试会话" ON interview_sessions;
DROP POLICY IF EXISTS "用户只能访问自己会话的转录片段" ON transcription_segments;

-- 创建RLS策略
CREATE POLICY "用户只能访问自己的配置" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "用户只能访问自己的岗位模板" ON position_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "用户只能访问自己的面试会话" ON interview_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "用户只能访问自己会话的转录片段" ON transcription_segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = transcription_segments.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );
`;

// 创建自动更新时间戳的函数和触发器
const CREATE_UPDATE_TRIGGERS = `
-- 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 删除已存在的触发器
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_position_templates_updated_at ON position_templates;
DROP TRIGGER IF EXISTS update_interview_sessions_updated_at ON interview_sessions;

-- 创建触发器
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_position_templates_updated_at 
  BEFORE UPDATE ON position_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at 
  BEFORE UPDATE ON interview_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export interface DatabaseInitResult {
  success: boolean;
  message: string;
  details: {
    tablesChecked: string[];
    tablesCreated: string[];
    indexesCreated: boolean;
    rlsEnabled: boolean;
    triggersCreated: boolean;
  };
  errors: string[];
}

/**
 * 初始化数据库表结构
 */
export async function initializeDatabase(): Promise<DatabaseInitResult> {
  const supabase = createClientComponentClient();
  const result: DatabaseInitResult = {
    success: false,
    message: '',
    details: {
      tablesChecked: [],
      tablesCreated: [],
      indexesCreated: false,
      rlsEnabled: false,
      triggersCreated: false
    },
    errors: []
  };

  try {
    console.log('🚀 开始数据库初始化...');

    // 1. 检查现有表
    console.log('📋 检查现有表...');
    const { data: existingTables, error: checkError } = await supabase.rpc('exec_sql', {
      sql: CHECK_TABLE_SQL
    });

    if (checkError) {
      // 如果RPC不可用，尝试直接查询
      console.log('尝试直接查询表结构...');
      try {
        const { data: tables } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .in('table_name', ['user_profiles', 'position_templates', 'interview_sessions', 'transcription_segments']);
        
        result.details.tablesChecked = tables?.map(t => t.table_name) || [];
      } catch {
        console.log('无法检查现有表，继续创建...');
      }
    } else {
      result.details.tablesChecked = existingTables || [];
    }

    console.log('现有表:', result.details.tablesChecked);

    // 2. 创建用户配置表
    console.log('👤 创建用户配置表...');
    const { error: userProfilesError } = await supabase.rpc('exec_sql', {
      sql: CREATE_USER_PROFILES_TABLE
    });

    if (!userProfilesError) {
      result.details.tablesCreated.push('user_profiles');
    } else {
      console.warn('创建user_profiles表失败:', userProfilesError);
      result.errors.push(`创建user_profiles表失败: ${userProfilesError.message}`);
    }

    // 3. 创建岗位模板表
    console.log('📋 创建岗位模板表...');
    const { error: positionTemplatesError } = await supabase.rpc('exec_sql', {
      sql: CREATE_POSITION_TEMPLATES_TABLE
    });

    if (!positionTemplatesError) {
      result.details.tablesCreated.push('position_templates');
    } else {
      console.warn('创建position_templates表失败:', positionTemplatesError);
      result.errors.push(`创建position_templates表失败: ${positionTemplatesError.message}`);
    }

    // 4. 创建面试会话表
    console.log('🎤 创建面试会话表...');
    const { error: interviewSessionsError } = await supabase.rpc('exec_sql', {
      sql: CREATE_INTERVIEW_SESSIONS_TABLE
    });

    if (!interviewSessionsError) {
      result.details.tablesCreated.push('interview_sessions');
    } else {
      console.warn('创建interview_sessions表失败:', interviewSessionsError);
      result.errors.push(`创建interview_sessions表失败: ${interviewSessionsError.message}`);
    }

    // 5. 创建转录片段表
    console.log('📝 创建转录片段表...');
    const { error: transcriptionSegmentsError } = await supabase.rpc('exec_sql', {
      sql: CREATE_TRANSCRIPTION_SEGMENTS_TABLE
    });

    if (!transcriptionSegmentsError) {
      result.details.tablesCreated.push('transcription_segments');
    } else {
      console.warn('创建transcription_segments表失败:', transcriptionSegmentsError);
      result.errors.push(`创建transcription_segments表失败: ${transcriptionSegmentsError.message}`);
    }

    // 6. 创建索引
    console.log('🔍 创建索引...');
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: CREATE_INDEXES
    });

    if (!indexesError) {
      result.details.indexesCreated = true;
    } else {
      console.warn('创建索引失败:', indexesError);
      result.errors.push(`创建索引失败: ${indexesError.message}`);
    }

    // 7. 启用RLS和创建策略
    console.log('🔒 启用RLS和创建策略...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: ENABLE_RLS_AND_POLICIES
    });

    if (!rlsError) {
      result.details.rlsEnabled = true;
    } else {
      console.warn('启用RLS失败:', rlsError);
      result.errors.push(`启用RLS失败: ${rlsError.message}`);
    }

    // 8. 创建触发器
    console.log('⚡ 创建触发器...');
    const { error: triggersError } = await supabase.rpc('exec_sql', {
      sql: CREATE_UPDATE_TRIGGERS
    });

    if (!triggersError) {
      result.details.triggersCreated = true;
    } else {
      console.warn('创建触发器失败:', triggersError);
      result.errors.push(`创建触发器失败: ${triggersError.message}`);
    }

    // 9. 检查最终结果
    const successCount = result.details.tablesCreated.length;
    if (successCount >= 2) { // 至少创建了用户配置和岗位模板表
      result.success = true;
      result.message = `数据库初始化成功！创建了${successCount}个表。`;
    } else {
      result.success = false;
      result.message = `数据库初始化部分失败，只创建了${successCount}个表。`;
    }

    console.log('✅ 数据库初始化完成', result);
    return result;

  } catch (error) {
    console.error('❌ 数据库初始化异常:', error);
    result.success = false;
    result.message = `数据库初始化异常: ${error}`;
    result.errors.push(`全局错误: ${error}`);
    return result;
  }
}

/**
 * 简化版数据库检查 - 检查表是否存在并可访问
 */
export async function initializeCoreDatabase(): Promise<DatabaseInitResult> {
  const supabase = createClientComponentClient();
  const result: DatabaseInitResult = {
    success: false,
    message: '',
    details: {
      tablesChecked: [],
      tablesCreated: [],
      indexesCreated: false,
      rlsEnabled: false,
      triggersCreated: false
    },
    errors: []
  };

  try {
    console.log('🚀 开始数据库表检查...');

    // 检查关键表是否存在
    const tables = ['user_profiles', 'position_templates'];
    
    for (const tableName of tables) {
      try {
        console.log(`检查表: ${tableName}`);
        
        // 尝试查询表来检查是否存在
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          console.log(`✅ 表 ${tableName} 存在并可访问`);
          result.details.tablesCreated.push(tableName);
        } else {
          console.warn(`❌ 表 ${tableName} 不可访问:`, error);
          
          if (error.code === '42P01') {
            result.errors.push(`表 ${tableName} 不存在`);
          } else if (error.code === '42501') {
            result.errors.push(`表 ${tableName} 权限不足`);
          } else {
            result.errors.push(`表 ${tableName}: ${error.message}`);
          }
        }
      } catch (err) {
        console.error(`检查表 ${tableName} 时出错:`, err);
        result.errors.push(`表 ${tableName} 检查失败: ${err}`);
      }
    }

    // 如果没有表可用，提供创建建议
    if (result.details.tablesCreated.length === 0) {
      result.success = false;
      result.message = '❌ 数据库表不存在或不可访问。请确保：\n1. Supabase项目配置正确\n2. 数据库表已创建\n3. RLS策略配置正确';
      
      // 给出具体的解决方案
      result.errors.push('解决方案：');
      result.errors.push('1. 在Supabase Dashboard的SQL编辑器中执行schema.sql');
      result.errors.push('2. 检查API密钥和项目URL配置');
      result.errors.push('3. 确保用户已通过认证');
    } else {
      result.success = true;
      result.message = `✅ 数据库检查成功！${result.details.tablesCreated.length}个表可用：${result.details.tablesCreated.join(', ')}`;
    }

    return result;

  } catch (error) {
    console.error('❌ 数据库检查异常:', error);
    result.success = false;
    result.message = `数据库检查异常: ${error}`;
    result.errors.push(`全局错误: ${error}`);
    return result;
  }
}