-- 🗃️ 面试助手V2.0 数据库Schema
-- 用户数据完全隔离，基于Row Level Security

-- 启用必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户配置表
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}' NOT NULL,
  preferences JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  
  UNIQUE(user_id)
);

-- 岗位模板表
CREATE TABLE position_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 面试会话表
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 转录片段表
CREATE TABLE transcription_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  processing_version VARCHAR(50),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_position_templates_user_id ON position_templates(user_id);
CREATE INDEX idx_position_templates_active ON position_templates(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status ON interview_sessions(user_id, status);
CREATE INDEX idx_interview_sessions_created_at ON interview_sessions(user_id, created_at DESC);
CREATE INDEX idx_transcription_segments_session_id ON transcription_segments(session_id);
CREATE INDEX idx_transcription_segments_time ON transcription_segments(session_id, start_time);

-- 🔒 Row Level Security (RLS) 策略
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_segments ENABLE ROW LEVEL SECURITY;

-- 用户配置表RLS策略
CREATE POLICY "用户只能访问自己的配置" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- 岗位模板表RLS策略  
CREATE POLICY "用户只能访问自己的岗位模板" ON position_templates
  FOR ALL USING (auth.uid() = user_id);

-- 面试会话表RLS策略
CREATE POLICY "用户只能访问自己的面试会话" ON interview_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 转录片段表RLS策略（通过session_id关联）
CREATE POLICY "用户只能访问自己会话的转录片段" ON transcription_segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM interview_sessions 
      WHERE interview_sessions.id = transcription_segments.session_id 
      AND interview_sessions.user_id = auth.uid()
    )
  );

-- 🔧 自动更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

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

-- 📝 插入默认岗位模板的函数
CREATE OR REPLACE FUNCTION create_default_position_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入通用软件工程师模板
  INSERT INTO position_templates (user_id, name, description, requirements, evaluation_criteria, is_default)
  VALUES (
    NEW.id,
    '软件工程师（通用）',
    '通用软件开发工程师岗位',
    '计算机相关专业，熟悉至少一门编程语言',
    '{
      "technical_skills": {"weight": 0.4, "description": "编程能力、算法思维、技术广度"},
      "problem_solving": {"weight": 0.3, "description": "问题分析和解决能力"},
      "communication": {"weight": 0.2, "description": "沟通表达和团队协作"},
      "learning_ability": {"weight": 0.1, "description": "学习能力和适应性"}
    }',
    TRUE
  );

  -- 插入产品经理模板
  INSERT INTO position_templates (user_id, name, description, requirements, evaluation_criteria, is_default)
  VALUES (
    NEW.id,
    '产品经理（通用）',
    '通用产品经理岗位',
    '产品相关经验，良好的逻辑思维和沟通能力',
    '{
      "product_sense": {"weight": 0.35, "description": "产品感知和业务理解"},
      "analytical_thinking": {"weight": 0.25, "description": "数据分析和逻辑思维"},
      "communication": {"weight": 0.25, "description": "沟通协调和团队管理"},
      "execution": {"weight": 0.15, "description": "执行力和项目管理"}
    }',
    TRUE
  );

  RETURN NEW;
END;
$$ language 'plpgsql';

-- 当新用户注册时自动创建默认模板
CREATE TRIGGER create_user_defaults
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_position_templates();

-- 🔍 有用的视图
CREATE VIEW user_session_stats AS
SELECT 
  user_id,
  COUNT(*) as total_sessions,
  SUM(duration_seconds) as total_duration_seconds,
  AVG(audio_quality_avg) as avg_audio_quality,
  COUNT(*) FILTER (WHERE summary IS NOT NULL) as sessions_with_summary,
  MAX(created_at) as last_session_date
FROM interview_sessions
GROUP BY user_id;

-- 📊 存储统计函数
CREATE OR REPLACE FUNCTION get_user_storage_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_sessions', COUNT(*),
    'total_segments', (
      SELECT COUNT(*) 
      FROM transcription_segments ts 
      JOIN interview_sessions sess ON ts.session_id = sess.id 
      WHERE sess.user_id = user_uuid
    ),
    'total_templates', (
      SELECT COUNT(*) 
      FROM position_templates 
      WHERE user_id = user_uuid
    ),
    'storage_used_mb', (
      -- 估算数据大小
      SELECT ROUND(
        (pg_total_relation_size('interview_sessions') + 
         pg_total_relation_size('transcription_segments') +
         pg_total_relation_size('position_templates')) / 1024.0 / 1024.0, 2
      )
    )
  ) INTO result
  FROM interview_sessions
  WHERE user_id = user_uuid;
  
  RETURN result;
END;
$$ language 'plpgsql';