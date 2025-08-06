// 🤖 GPT-4面试总结生成服务 - 基于英文原文的高质量面试分析

import { InterviewTextChunker, TextChunk } from './text-chunking';
import { TranscriptionSegment } from '@/utils/smart-segmentation';
import { 
  matchPositionTemplate, 
  PositionTemplate, 
  AssessmentDimension,
  calculateWeightedScore 
} from '@/config/position-assessment-templates';

interface InterviewSummaryConfig {
  model: string;
  temperature: number;
  maxTokensPerRequest: number;
  summaryLanguage: 'zh' | 'en';
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
}

interface InterviewMetadata {
  duration: number; // 分钟
  participantCount: number;
  totalWords: number;
  questionCount: number;
  interactionCount: number;
  candidateName?: string;
  position?: string;
}

// 🎯 维度评估结果
interface DimensionAssessment {
  name: string;
  score: number; // 1-10分
  evidence: string[]; // 支撑证据
  insufficientInfo: boolean; // 是否信息不足
  reasoning: string; // 评分理由
}

// 📊 岗位匹配评估
interface PositionMatchAssessment {
  matchedTemplate: PositionTemplate;
  professionalAssessment: {
    dimensions: DimensionAssessment[];
    overallScore: number;
    summary: string;
  };
  personalAssessment: {
    dimensions: DimensionAssessment[];
    overallScore: number;
    summary: string;
  };
  overallFit: {
    score: number;
    reasoning: string;
    recommendations: string[];
  };
}

interface InterviewSummary {
  id: string;
  timestamp: Date;
  metadata: InterviewMetadata;
  
  // 核心总结内容
  executiveSummary: string;
  
  // 🎯 新增：岗位匹配评估
  positionAssessment?: PositionMatchAssessment;
  
  // 传统评估（保持兼容性）
  candidatePerformance: {
    overall: string;
    strengths: string[];
    weaknesses: string[];
    communicationSkills: string;
    technicalSkills: string;
  };
  keyInsights: {
    standoutMoments: string[];
    concerningAreas: string[];
    improvementSuggestions: string[];
  };
  recommendation: {
    decision: 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend' | 'strongly_not_recommend';
    reasoning: string;
    nextSteps: string[];
  };
  
  // 详细分析
  detailedAnalysis?: {
    questionResponseAnalysis: Array<{
      question: string;
      response: string;
      analysis: string;
      score: number; // 1-10
    }>;
    skillsAssessment: {
      [skillArea: string]: {
        score: number;
        evidence: string[];
        improvement: string;
      };
    };
  };
  
  // 原始数据引用
  sourceSegments: string[]; // 分段ID列表
  processingStats: {
    totalChunks: number;
    processingTime: number;
    confidenceScore: number;
  };
}

export class GPT4InterviewSummaryService {
  private config: InterviewSummaryConfig;
  private textChunker: InterviewTextChunker;

  constructor(config: Partial<InterviewSummaryConfig> = {}) {
    this.config = {
      model: 'gpt-4o-mini', // 使用GPT-4o-mini模型降低成本
      temperature: 0.3, // 较低温度确保一致性
      maxTokensPerRequest: 4000,
      summaryLanguage: 'zh',
      analysisDepth: 'detailed',
      ...config
    };

    this.textChunker = new InterviewTextChunker({
      maxTokensPerChunk: 3000,
      overlapTokens: 300,
      preserveContext: true
    });
  }

  // 🎯 生成面试总结的主要方法
  async generateInterviewSummary(
    segments: TranscriptionSegment[],
    metadata?: Partial<InterviewMetadata>,
    interviewInfo?: { candidateName: string; position: string }
  ): Promise<InterviewSummary> {
    console.log('🤖 开始生成GPT-4面试总结');
    
    const startTime = Date.now();
    
    try {
      // 1. 准备和分析原始数据
      const interviewData = this.prepareInterviewData(segments, metadata);
      
      // 2. 分块处理长文本
      const chunks = this.textChunker.chunkText(
        interviewData.fullTranscript,
        interviewData.timeSegments
      );
      
      console.log('📚 文本分块完成:', {
        chunks: chunks.length,
        totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0)
      });
      
      // 3. 生成分块分析
      const chunkAnalyses = await this.analyzeChunks(chunks, interviewData.metadata);
      
      // 4. 综合生成最终总结
      const finalSummary = await this.generateComprehensiveSummary(
        chunkAnalyses,
        interviewData,
        chunks,
        interviewInfo
      );
      
      const processingTime = Date.now() - startTime;
      
      // 5. 构建完整总结对象
      const summary: InterviewSummary = {
        id: `summary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        metadata: interviewData.metadata,
        ...finalSummary,
        sourceSegments: segments.map(s => s.id),
        processingStats: {
          totalChunks: chunks.length,
          processingTime,
          confidenceScore: this.calculateConfidenceScore(chunkAnalyses)
        }
      };
      
      console.log('✅ GPT-4面试总结生成完成:', {
        id: summary.id,
        processingTime: `${processingTime}ms`,
        recommendationDecision: summary.recommendation.decision,
        confidenceScore: summary.processingStats.confidenceScore
      });
      
      return summary;
      
    } catch (error) {
      console.error('❌ GPT-4面试总结生成失败:', error);
      throw new Error(`面试总结生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 📊 准备面试数据
  private prepareInterviewData(
    segments: TranscriptionSegment[],
    metadata?: Partial<InterviewMetadata>
  ) {
    // 按时间排序分段
    const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);
    
    // 构建完整转录文本（使用英文原文）
    const fullTranscript = sortedSegments
      .map(segment => {
        const timestamp = `[${Math.floor(segment.startTime / 60)}:${(segment.startTime % 60).toFixed(0).padStart(2, '0')}]`;
        const speaker = segment.speaker === 'interviewer' ? 'Interviewer' : 'Candidate';
        return `${timestamp} ${speaker}: ${segment.englishText}`;
      })
      .join('\n\n');
    
    // 计算统计信息
    const duration = sortedSegments.length > 0 ? 
      Math.max(...sortedSegments.map(s => s.endTime)) / 60 : 0;
    
    const totalWords = sortedSegments.reduce((sum, s) => sum + s.wordCount, 0);
    const questionCount = sortedSegments.reduce((sum, s) => 
      sum + (s.englishText.match(/\?/g) || []).length, 0
    );
    
    const interviewMetadata: InterviewMetadata = {
      duration: Math.round(duration),
      participantCount: 2, // 默认面试官和候选人
      totalWords,
      questionCount,
      interactionCount: sortedSegments.length,
      ...metadata
    };
    
    // 准备时间分段信息
    const timeSegments = sortedSegments.map(segment => ({
      start: segment.startTime,
      end: segment.endTime,
      text: segment.englishText
    }));
    
    return {
      fullTranscript,
      timeSegments,
      metadata: interviewMetadata,
      segments: sortedSegments
    };
  }

  // 🔍 分析文本块
  private async analyzeChunks(
    chunks: TextChunk[],
    metadata: InterviewMetadata
  ): Promise<Array<{
    chunkId: string;
    analysis: any;
    keyPoints: string[];
    concerns: string[];
    questions: Array<{ question: string; response: string; quality: number }>;
  }>> {
    console.log('🔍 开始分块分析...');
    
    const analyses = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`📄 分析块 ${i + 1}/${chunks.length}...`);
      
      try {
        const prompt = this.buildChunkAnalysisPrompt(chunk, metadata, i, chunks.length);
        const analysis = await this.callGPT4(prompt);
        
        // 解析GPT-4响应
        const parsedAnalysis = this.parseChunkAnalysis(analysis);
        
        analyses.push({
          chunkId: chunk.id,
          analysis: parsedAnalysis,
          keyPoints: parsedAnalysis.keyPoints || [],
          concerns: parsedAnalysis.concerns || [],
          questions: parsedAnalysis.questions || []
        });
        
        // 添加延迟避免API限制
        await this.delay(200);
        
      } catch (error) {
        console.error(`❌ 分析块 ${chunk.id} 失败:`, error);
        // 添加错误占位符
        analyses.push({
          chunkId: chunk.id,
          analysis: { error: '分析失败' },
          keyPoints: [],
          concerns: ['此部分分析失败'],
          questions: []
        });
      }
    }
    
    console.log('✅ 分块分析完成');
    return analyses;
  }

  // 🏗️ 构建分块分析提示词
  private buildChunkAnalysisPrompt(
    chunk: TextChunk,
    metadata: InterviewMetadata,
    chunkIndex: number,
    totalChunks: number
  ): string {
    return `你是专业的面试分析专家。请分析以下面试转录片段，这是第${chunkIndex + 1}/${totalChunks}个片段。

面试基本信息：
- 总时长：${metadata.duration}分钟
- 总词数：${metadata.totalWords}
- 问题数量：${metadata.questionCount}

转录片段内容：
${chunk.content}

请按以下JSON格式分析此片段：

{
  "keyPoints": ["关键表现点1", "关键表现点2"],
  "concerns": ["关注点1", "关注点2"],
  "questions": [
    {
      "question": "问题内容",
      "response": "回答内容", 
      "quality": 8,
      "analysis": "回答质量分析"
    }
  ],
  "skills": {
    "communication": { "score": 8, "evidence": ["证据1"] },
    "technical": { "score": 7, "evidence": ["证据1"] },
    "problemSolving": { "score": 6, "evidence": ["证据1"] }
  },
  "overall": "此片段的整体评价"
}

要求：
1. 专注于候选人的表现分析
2. 基于具体证据给出评分
3. 识别突出的优缺点
4. 保持客观专业的分析角度
5. 使用中文输出`;
  }

  // 🔄 综合生成最终总结
  private async generateComprehensiveSummary(
    chunkAnalyses: any[],
    interviewData: any,
    chunks: TextChunk[],
    interviewInfo?: { candidateName: string; position: string }
  ) {
    console.log('🔄 生成综合总结...');
    
    // 整合所有分块分析
    const consolidatedAnalysis = this.consolidateChunkAnalyses(chunkAnalyses);
    
    // 构建综合分析提示词
    const prompt = this.buildComprehensiveSummaryPrompt(
      consolidatedAnalysis,
      interviewData.metadata,
      chunks,
      interviewInfo
    );
    
    try {
      const summaryResponse = await this.callGPT4(prompt, 'comprehensive');
      return this.parseComprehensiveSummary(summaryResponse);
    } catch (error) {
      console.error('❌ 综合总结生成失败:', error);
      throw error;
    }
  }

  // 🏗️ 构建综合总结提示词
  private buildComprehensiveSummaryPrompt(
    consolidatedAnalysis: any,
    metadata: InterviewMetadata,
    chunks: TextChunk[],
    interviewInfo?: { candidateName: string; position: string }
  ): string {
    // 🎯 获取岗位评估模板
    const positionTemplate = interviewInfo?.position 
      ? matchPositionTemplate(interviewInfo.position)
      : matchPositionTemplate('general');

    const candidateInfo = interviewInfo ? `
应聘人信息：
- 姓名：${interviewInfo.candidateName}
- 应聘岗位：${interviewInfo.position}
- 匹配模板：${positionTemplate.displayName}` : `
- 使用通用评估模板`;

    // 构建岗位评估维度说明
    const professionalDimensions = positionTemplate.professionalDimensions.map(dim => 
      `${dim.name}（权重${(dim.weight * 100).toFixed(0)}%）: ${dim.description}
   评估标准: ${dim.evaluationCriteria.join(', ')}`
    ).join('\n');

    const personalDimensions = positionTemplate.personalDimensions.map(dim => 
      `${dim.name}（权重${(dim.weight * 100).toFixed(0)}%）: ${dim.description}
   评估标准: ${dim.evaluationCriteria.join(', ')}`
    ).join('\n');

    // 构建完整的原始转录内容 - 确保基于整体对话评估
    const fullTranscript = chunks.map(chunk => chunk.content).join('\n\n');

    // 🔍 面试时长判断逻辑
    const isShortInterview = metadata.duration < 3; // 少于3分钟视为过短面试
    const isValidInterview = metadata.totalWords > 50 && metadata.interactionCount > 2;

    return `你是资深的HR面试专家，拥有20年面试评估经验。请基于完整的面试转录内容进行全面、客观的评估。

${candidateInfo}

面试基本信息：
- 时长：${metadata.duration}分钟
- 总词数：${metadata.totalWords}
- 互动次数：${metadata.interactionCount}
- 问题数量：${metadata.questionCount}

🎯 岗位专业能力评估维度：
${professionalDimensions}

👤 综合素质评估维度：
${personalDimensions}

📝 完整面试转录内容：
${fullTranscript}

💡 分析结果参考：
${JSON.stringify(consolidatedAnalysis, null, 2)}

🧠 高级评估指导原则：

**第一步：面试有效性判断**
${isShortInterview ? `
⚠️ 检测到短时长面试（${metadata.duration}分钟）：
- 如果内容有效但时长过短，需在总结中说明"面试时间较短，评估维度有限"
- 对信息不足的维度标注insufficientInfo=true，但仍基于现有信息给出合理评估
- 在recommendation中建议延长面试时间或安排后续面试` : `
✅ 标准时长面试（${metadata.duration}分钟）：
- 进行全面评估，基于完整对话内容
- 重点分析候选人在各个维度的具体表现`}

${!isValidInterview ? `
⚠️ 检测到可能的无效面试内容：
- 词数过少（${metadata.totalWords}词）或互动过少（${metadata.interactionCount}次）
- 请仔细检查转录内容是否为真实面试对话
- 如确认无效，在executiveSummary中说明原因并建议重新面试` : `
✅ 有效面试内容检测通过`}

**第二步：全面深度分析方法**
1. **整体对话流程分析**：
   - 从头到尾阅读完整转录，理解面试的整体脉络
   - 识别面试的主要阶段：开场、技能评估、行为面试、问答环节等
   - 分析候选人回答的逻辑性、连贯性和深度

2. **多维度交叉验证**：
   - 不要仅基于单个关键词或片段评分
   - 寻找多个证据支撑每个维度的评估
   - 考虑候选人在不同话题下的一致性表现

3. **上下文理解**：
   - 理解面试官问题的背景和意图
   - 评估候选人是否真正理解问题并给出相关回答
   - 识别候选人的思维过程和问题解决方法

4. **岗位契合度分析**：
   - 将候选人表现与具体岗位要求对照
   - 评估技能匹配度、经验相关性、发展潜力
   - 考虑团队配合和文化适配性

**第三步：客观评分标准**
- 1-3分：明显不符合要求，有重大缺陷
- 4-5分：基本符合要求，但有明显改进空间  
- 6-7分：符合要求，表现良好
- 8-9分：超出预期，表现优秀
- 10分：卓越表现，远超预期

**第四步：证据支撑要求**
- 每个评分必须有具体的对话内容作为证据
- 引用原文时提供中文解释和分析
- 避免主观印象，基于客观事实评估

**第五步：输出要求**

${isShortInterview || !isValidInterview ? `
⚠️ 特殊情况处理：
- 在executiveSummary中首先说明面试时长或内容的限制
- 所有维度评估需要标注信息是否充足
- 在recommendation中提供具体的改进建议
- 即使信息有限，也要基于现有内容给出客观评估` : `
✅ 标准评估要求：
- 基于完整转录内容进行深入分析
- 每个维度提供具体证据支撑
- 综合多个表现点进行评分
- 提供具体可行的发展建议`}

请生成完整的面试评估报告，严格遵循以下JSON格式：

{
  "executiveSummary": "${isShortInterview ? '首先说明面试时长限制，然后' : ''}概述候选人整体表现，150-200字",
  "positionAssessment": {
    "matchedTemplate": {
      "position": "${positionTemplate.position}",
      "displayName": "${positionTemplate.displayName}",
      "description": "${positionTemplate.description}"
    },
    "professionalAssessment": {
      "dimensions": [
        ${positionTemplate.professionalDimensions.map(dim => `{
          "name": "${dim.name}",
          "score": 评分1-10,
          "evidence": ["具体对话证据1", "具体对话证据2"],
          "insufficientInfo": ${isShortInterview || !isValidInterview ? 'true/false' : 'false'},
          "reasoning": "详细评分理由，解释为什么给出这个分数"
        }`).join(',\n        ')}
      ],
      "overallScore": 加权平均分,
      "summary": "专业能力整体评价，结合各维度表现"
    },
    "personalAssessment": {
      "dimensions": [
        ${positionTemplate.personalDimensions.map(dim => `{
          "name": "${dim.name}",
          "score": 评分1-10,
          "evidence": ["具体表现证据1", "具体表现证据2"],
          "insufficientInfo": ${isShortInterview || !isValidInterview ? 'true/false' : 'false'},
          "reasoning": "详细评分理由"
        }`).join(',\n        ')}
      ],
      "overallScore": 加权平均分,
      "summary": "综合素质整体评价"
    },
    "overallFit": {
      "score": 综合匹配度评分,
      "reasoning": "基于专业能力和综合素质的岗位匹配度分析",
      "recommendations": ["具体发展建议1", "具体发展建议2", "具体发展建议3"]
    }
  },
  "candidatePerformance": {
    "overall": "整体表现客观评价，避免模糊表述",
    "strengths": ["具体优势1（附原文证据）", "具体优势2（附原文证据）", "具体优势3（附原文证据）"],
    "weaknesses": ["具体不足1（附改进建议）", "具体不足2（附改进建议）"],
    "communicationSkills": "沟通能力的具体表现分析，包括表达清晰度、逻辑性、互动能力",
    "technicalSkills": "专业技能的具体表现分析，基于面试中的技术讨论"
  },
  "keyInsights": {
    "standoutMoments": ["令人印象深刻的回答或表现", "展现潜力的关键时刻"],
    "concerningAreas": ["需要关注的问题领域", "潜在的风险点"],
    "improvementSuggestions": ["针对性改进建议1", "针对性改进建议2", "发展方向建议"]
  },
  "recommendation": {
    "decision": "${isShortInterview || !isValidInterview ? '"neutral"或合适的决策' : '"strongly_recommend"/"recommend"/"neutral"/"not_recommend"/"strongly_not_recommend"'}",
    "reasoning": "基于以上分析的推荐理由，解释为什么做出这个决策",
    "nextSteps": ["下一步行动建议1", "下一步行动建议2"]
  }
}

🎯 关键评估要求：
- 每个评分必须有具体对话内容作为证据支撑
- 避免使用模糊词汇如"还不错"、"比较好"等
- 基于整体表现而非个别亮点或问题进行评估
- ${isShortInterview ? '短面试需要在recommendation中建议延长面试时间' : ''}
- ${!isValidInterview ? '无效内容需要建议重新安排正式面试' : ''}
- 所有数值必须在合理范围内，避免极端评分
- 提供的建议要具体可执行，避免空洞建议`;
  }

  // 🔧 调用GPT-4 API
  private async callGPT4(prompt: string, type: 'chunk' | 'comprehensive' = 'chunk'): Promise<string> {
    const maxTokens = type === 'comprehensive' ? 2000 : 1000;
    
    try {
      // 获取API密钥
      const apiKey = await this.getAPIKey();
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是专业的面试分析专家，擅长分析候选人表现并提供客观准确的评估。请始终使用中文回复，并提供结构化的分析结果。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`GPT-4 API调用失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('GPT-4 API返回空结果');
      }

      return data.choices[0].message.content;
      
    } catch (error) {
      console.error('❌ GPT-4 API调用失败:', error);
      throw error;
    }
  }

  // 🔑 获取API密钥 - 使用统一的API密钥管理器
  private async getAPIKey(): Promise<string> {
    try {
      // 动态导入API密钥管理器（避免循环导入）
      const { ApiKeyManager } = await import('@/lib/api-key-manager');
      const apiKeyManager = ApiKeyManager.getInstance();
      return apiKeyManager.getOpenAIApiKey();
    } catch (error) {
      console.error('❌ 获取API密钥失败:', error);
      throw new Error('未找到OpenAI API密钥，请在设置页面配置');
    }
  }

  // 📖 解析分块分析结果
  private parseChunkAnalysis(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('❌ 解析分块分析结果失败:', error);
      return {
        keyPoints: [],
        concerns: ['解析失败'],
        questions: [],
        skills: {},
        overall: '分析解析失败'
      };
    }
  }

  // 📖 解析综合总结结果
  private parseComprehensiveSummary(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('❌ 解析综合总结失败:', error);
      throw new Error('总结结果解析失败');
    }
  }

  // 🔄 整合分块分析
  private consolidateChunkAnalyses(analyses: any[]): any {
    const allKeyPoints = analyses.flatMap(a => a.keyPoints || []);
    const allConcerns = analyses.flatMap(a => a.concerns || []);
    const allQuestions = analyses.flatMap(a => a.questions || []);
    
    // 技能评分平均值
    const skillScores: { [key: string]: number[] } = {};
    analyses.forEach(analysis => {
      if (analysis.analysis && analysis.analysis.skills) {
        Object.entries(analysis.analysis.skills).forEach(([skill, data]: [string, any]) => {
          if (!skillScores[skill]) skillScores[skill] = [];
          if (data.score) skillScores[skill].push(data.score);
        });
      }
    });
    
    const averageSkillScores = Object.entries(skillScores).reduce((acc, [skill, scores]) => {
      acc[skill] = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      keyPoints: [...new Set(allKeyPoints)], // 去重
      concerns: [...new Set(allConcerns)],
      questions: allQuestions,
      averageSkillScores,
      totalAnalyses: analyses.length
    };
  }

  // 🎯 计算信心度评分
  private calculateConfidenceScore(analyses: any[]): number {
    const successfulAnalyses = analyses.filter(a => !a.analysis.error).length;
    const successRate = analyses.length > 0 ? successfulAnalyses / analyses.length : 0;
    
    // 基础信心度基于成功率
    let confidence = successRate * 0.7;
    
    // 根据数据量调整
    if (analyses.length >= 5) confidence += 0.2;
    else if (analyses.length >= 3) confidence += 0.1;
    
    // 根据分析质量调整
    const avgQuestions = analyses.reduce((sum, a) => sum + (a.questions?.length || 0), 0) / analyses.length;
    if (avgQuestions >= 2) confidence += 0.1;
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  // ⏱️ 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ⚙️ 更新配置
  updateConfig(newConfig: Partial<InterviewSummaryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ GPT-4总结服务配置已更新:', this.config);
  }

  // 🔧 获取当前配置
  getConfig(): InterviewSummaryConfig {
    return { ...this.config };
  }
}

export type { InterviewSummary, InterviewSummaryConfig, InterviewMetadata };