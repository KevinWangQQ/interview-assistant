// 🚀 增强版GPT-4面试总结服务 - V2.0集成岗位JD的智能分析

import OpenAI from 'openai';
import { InterviewTextChunker, TextChunk } from './text-chunking';
import { TranscriptionSegment } from '@/utils/smart-segmentation';
import { PositionTemplate } from '@/services/interfaces';
import { SupabaseUserProfileService } from '@/services/storage/supabase-storage';

interface EnhancedInterviewSummaryConfig {
  model: string;
  temperature: number;
  maxTokensPerRequest: number;
  summaryLanguage: 'zh' | 'en';
  analysisDepth: 'basic' | 'detailed' | 'comprehensive';
  usePositionTemplate: boolean;
}

interface InterviewMetadata {
  duration: number; // 分钟
  participantCount: number;
  totalWords: number;
  questionCount: number;
  interactionCount: number;
  candidateName?: string;
  position?: string;
  positionTemplateId?: string;
}

// 维度评估结果
interface DimensionAssessment {
  name: string;
  description: string;
  weight: number;
  score: number; // 1-10分
  evidence: string[]; // 支撑证据
  strengths: string[]; // 优势表现
  weaknesses: string[]; // 待改进点
  reasoning: string; // 评分理由
  improvementSuggestions: string[]; // 改进建议
}

// 岗位匹配评估
interface PositionMatchAssessment {
  templateInfo: {
    id: string;
    name: string;
    description?: string;
    experienceLevel?: string;
    department?: string;
  };
  
  dimensionAssessments: DimensionAssessment[];
  
  overallFit: {
    score: number; // 1-100分
    level: 'excellent' | 'good' | 'fair' | 'poor';
    reasoning: string;
    confidence: number; // 0-1
  };
  
  skillsMatching: {
    requiredSkills: string[];
    demonstratedSkills: string[];
    missingSkills: string[];
    additionalSkills: string[];
    matchingScore: number; // 0-100%
  };
  
  recommendationLevel: 'strongly_recommend' | 'recommend' | 'conditional' | 'not_recommend' | 'strongly_not_recommend';
  recommendations: string[];
  nextSteps: string[];
}

interface EnhancedInterviewSummary {
  id: string;
  timestamp: Date;
  metadata: InterviewMetadata;
  
  // 核心总结内容
  executiveSummary: string;
  
  // V2.0新增：基于JD的岗位匹配评估
  positionAssessment?: PositionMatchAssessment;
  
  // 通用候选人表现评估（无JD时使用）
  generalAssessment: {
    overall: string;
    strengths: string[];
    weaknesses: string[];
    communicationSkills: {
      score: number;
      analysis: string;
      evidence: string[];
    };
    technicalSkills: {
      score: number;
      analysis: string;
      evidence: string[];
    };
    problemSolving: {
      score: number;
      analysis: string;
      evidence: string[];
    };
    culturalFit: {
      score: number;
      analysis: string;
      evidence: string[];
    };
  };
  
  // 面试质量分析
  interviewQuality: {
    questionQuality: number; // 1-10分
    flowAndPacing: number;
    depthOfProbing: number;
    coverageCompleteness: number;
    suggestions: string[];
  };
  
  // 关键洞察
  keyInsights: {
    standoutMoments: Array<{
      timestamp: number;
      description: string;
      significance: string;
    }>;
    redFlags: Array<{
      area: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      evidence: string[];
    }>;
    uniqueStrengths: string[];
    developmentAreas: string[];
  };
  
  // 决策建议
  recommendation: {
    decision: 'strongly_recommend' | 'recommend' | 'conditional' | 'not_recommend' | 'strongly_not_recommend';
    confidence: number; // 0-1
    reasoning: string;
    conditions?: string[]; // 有条件推荐时的条件
    nextSteps: string[];
    timelineRecommendation: string;
  };
  
  // 处理统计
  processingStats: {
    chunksProcessed: number;
    totalTokensUsed: number;
    processingTimeMs: number;
    confidenceScore: number;
    modelVersion: string;
    templateUsed: boolean;
  };
}

export class EnhancedGPT4SummaryService {
  private openai: OpenAI | null = null;
  private config: EnhancedInterviewSummaryConfig;
  private textChunker: InterviewTextChunker;
  private userProfileService: SupabaseUserProfileService;

  constructor(config?: Partial<EnhancedInterviewSummaryConfig>) {
    this.config = {
      model: 'gpt-4-1106-preview',
      temperature: 0.3,
      maxTokensPerRequest: 4000,
      summaryLanguage: 'zh',
      analysisDepth: 'detailed',
      usePositionTemplate: true,
      ...config
    };
    
    this.textChunker = new InterviewTextChunker();
    this.userProfileService = new SupabaseUserProfileService();
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    let apiKey = '';
    
    // 尝试从环境变量获取
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENAI_API_KEY) {
      apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    }
    
    // 尝试从localStorage获取
    if (!apiKey && typeof window !== 'undefined' && localStorage) {
      apiKey = localStorage.getItem('openai_api_key') || '';
    }
    
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }

  async generateSummary(
    segments: TranscriptionSegment[], 
    metadata: InterviewMetadata,
    positionTemplateId?: string
  ): Promise<EnhancedInterviewSummary> {
    if (!this.openai) {
      throw new Error('OpenAI服务未正确初始化，请检查API密钥配置');
    }

    const startTime = Date.now();
    console.log('🤖 开始生成增强版面试总结...', { 
      segments: segments.length, 
      useTemplate: !!positionTemplateId 
    });

    try {
      // 获取岗位模板（如果提供）
      let positionTemplate: PositionTemplate | null = null;
      if (positionTemplateId && this.config.usePositionTemplate) {
        positionTemplate = await this.userProfileService.getPositionTemplate(positionTemplateId);
        console.log('📋 已加载岗位模板:', positionTemplate?.name);
      }

      // 准备转录文本
      const fullTranscript = segments
        .filter(seg => seg.englishText && seg.englishText.trim())
        .map(seg => `[${this.formatTimestamp(typeof seg.timestamp === 'number' ? seg.timestamp : seg.timestamp.getTime())}] ${seg.speaker || 'Speaker'}: ${seg.englishText}`)
        .join('\n\n');

      if (!fullTranscript.trim()) {
        throw new Error('转录内容为空，无法生成总结');
      }

      // 文本分块处理 - 准备时间段数据
      const timeSegments = segments
        .filter(seg => seg.englishText && seg.englishText.trim())
        .map(seg => ({
          start: seg.startTime,
          end: seg.endTime,
          text: seg.englishText
        }));
        
      const chunks = this.textChunker.chunkText(fullTranscript, timeSegments);
      console.log('📝 文本分块完成:', chunks.length, '个块');

      let summary: EnhancedInterviewSummary;

      if (positionTemplate) {
        // 使用岗位模板进行针对性分析
        summary = await this.generatePositionBasedSummary(chunks, metadata, positionTemplate);
      } else {
        // 使用通用分析
        summary = await this.generateGeneralSummary(chunks, metadata);
      }

      // 更新处理统计
      summary.processingStats = {
        chunksProcessed: chunks.length,
        totalTokensUsed: 0, // TODO: 统计实际token使用量
        processingTimeMs: Date.now() - startTime,
        confidenceScore: this.calculateConfidenceScore(summary),
        modelVersion: this.config.model,
        templateUsed: !!positionTemplate
      };

      console.log('✅ 面试总结生成完成', {
        duration: `${Date.now() - startTime}ms`,
        chunks: chunks.length,
        hasPositionAssessment: !!summary.positionAssessment
      });

      return summary;

    } catch (error) {
      console.error('❌ 生成面试总结失败:', error);
      throw error;
    }
  }

  private async generatePositionBasedSummary(
    chunks: TextChunk[],
    metadata: InterviewMetadata,
    positionTemplate: PositionTemplate
  ): Promise<EnhancedInterviewSummary> {
    console.log('🎯 基于岗位模板生成针对性总结...');

    const analysisPrompt = this.buildPositionBasedPrompt(positionTemplate);
    const chunkAnalyses = [];

    // 分析每个文本块
    for (const chunk of chunks) {
      try {
        const response = await this.openai!.chat.completions.create({
          model: this.config.model,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'system',
              content: analysisPrompt
            },
            {
              role: 'user',
              content: `请分析以下面试片段：\n\n${chunk.content}`
            }
          ],
          max_tokens: this.config.maxTokensPerRequest
        });

        const analysis = response.choices[0]?.message?.content;
        if (analysis) {
          chunkAnalyses.push(analysis);
        }
      } catch (error) {
        console.error('分析文本块失败:', error);
        chunkAnalyses.push('分析失败');
      }
    }

    // 生成最终综合总结
    const finalSummaryResponse = await this.openai!.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'system',
          content: this.buildFinalSummaryPrompt(positionTemplate)
        },
        {
          role: 'user',
          content: `基于以下分析片段，生成完整的面试总结：\n\n${chunkAnalyses.join('\n\n---\n\n')}\n\n面试元数据：\n候选人：${metadata.candidateName}\n职位：${metadata.position}\n时长：${metadata.duration}分钟`
        }
      ],
      max_tokens: this.config.maxTokensPerRequest
    });

    const finalAnalysis = finalSummaryResponse.choices[0]?.message?.content;
    
    // 解析并构建总结对象
    return this.parseSummaryResponse(finalAnalysis || '', metadata, positionTemplate);
  }

  private async generateGeneralSummary(
    chunks: TextChunk[],
    metadata: InterviewMetadata
  ): Promise<EnhancedInterviewSummary> {
    console.log('📊 生成通用面试总结...');

    const analysisPrompt = this.buildGeneralAnalysisPrompt();
    const chunkAnalyses = [];

    // 分析每个文本块
    for (const chunk of chunks) {
      try {
        const response = await this.openai!.chat.completions.create({
          model: this.config.model,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'system',
              content: analysisPrompt
            },
            {
              role: 'user',
              content: `请分析以下面试片段：\n\n${chunk.content}`
            }
          ],
          max_tokens: this.config.maxTokensPerRequest
        });

        const analysis = response.choices[0]?.message?.content;
        if (analysis) {
          chunkAnalyses.push(analysis);
        }
      } catch (error) {
        console.error('分析文本块失败:', error);
        chunkAnalyses.push('分析失败');
      }
    }

    // 生成最终综合总结
    const finalSummaryResponse = await this.openai!.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'system',
          content: this.buildGeneralSummaryPrompt()
        },
        {
          role: 'user',
          content: `基于以下分析片段，生成完整的面试总结：\n\n${chunkAnalyses.join('\n\n---\n\n')}\n\n面试元数据：\n候选人：${metadata.candidateName}\n职位：${metadata.position}\n时长：${metadata.duration}分钟`
        }
      ],
      max_tokens: this.config.maxTokensPerRequest
    });

    const finalAnalysis = finalSummaryResponse.choices[0]?.message?.content;
    
    // 解析并构建总结对象
    return this.parseSummaryResponse(finalAnalysis || '', metadata);
  }

  private buildPositionBasedPrompt(positionTemplate: PositionTemplate): string {
    const criteriaText = Object.entries(positionTemplate.evaluation_criteria)
      .map(([key, criteria]: [string, any]) => 
        `- ${criteria.description || key}: 权重${Math.round(criteria.weight * 100)}%`
      ).join('\n');

    return `你是一位专业的面试官和HR专家，正在分析一场面试记录。

岗位信息：
- 岗位名称：${positionTemplate.name}
- 岗位描述：${positionTemplate.description || '未提供'}
- 经验要求：${positionTemplate.experience_level || '不限'}
- 所属部门：${positionTemplate.department || '未指定'}

岗位要求：
${positionTemplate.requirements || '请参考岗位描述'}

JD详情：
${positionTemplate.job_description || '未提供详细JD'}

所需技能：
${positionTemplate.skills_required?.join(', ') || '请参考岗位要求'}

评估维度：
${criteriaText}

请基于以上岗位信息，对面试内容进行专业分析。重点关注：
1. 候选人是否符合岗位技能要求
2. 在各个评估维度上的表现
3. 与岗位匹配度的具体分析
4. 基于JD的针对性建议

请用中文进行分析，保持客观专业。`;
  }

  private buildFinalSummaryPrompt(positionTemplate: PositionTemplate): string {
    return `基于前面的分析，请生成一份完整的面试总结报告。报告应包括：

1. 执行摘要（200-300字）
2. 岗位匹配度评估（针对${positionTemplate.name}）
3. 各维度详细评分和分析
4. 技能匹配情况
5. 优势和待改进点
6. 最终推荐决策和理由
7. 后续步骤建议

请确保分析客观、具体，有充分的证据支撑。用中文撰写，专业但易于理解。

输出格式请尽量结构化，便于后续解析处理。`;
  }

  private buildGeneralAnalysisPrompt(): string {
    return `你是一位经验丰富的面试官，请对面试片段进行专业分析。

分析维度：
1. 沟通表达能力
2. 专业技术能力
3. 问题解决能力
4. 学习适应能力
5. 团队合作意识
6. 工作态度和动机

请关注：
- 候选人的回答质量和深度
- 表达的清晰度和逻辑性
- 展现出的专业素养
- 潜在的红旗信号
- 突出的亮点表现

请用中文进行客观、专业的分析。`;
  }

  private buildGeneralSummaryPrompt(): string {
    return `基于前面的分析，请生成一份完整的面试总结报告。报告应包括：

1. 执行摘要（200-300字）
2. 候选人整体表现评估
3. 各能力维度分析
4. 关键优势和亮点
5. 需要关注的问题点
6. 最终推荐决策和理由
7. 改进建议和后续步骤

请确保分析客观、具体，有充分的证据支撑。用中文撰写，专业但易于理解。`;
  }

  private parseSummaryResponse(
    response: string, 
    metadata: InterviewMetadata, 
    positionTemplate?: PositionTemplate
  ): EnhancedInterviewSummary {
    // 这里应该实现更智能的解析逻辑
    // 目前先返回基础结构，后续可以用更复杂的NLP技术解析GPT的结构化回复
    
    return {
      id: `summary_${Date.now()}`,
      timestamp: new Date(),
      metadata,
      executiveSummary: response.substring(0, 500), // 简化处理，取前500字符作为摘要
      
      // 如果有岗位模板，创建岗位评估
      positionAssessment: positionTemplate ? {
        templateInfo: {
          id: positionTemplate.id,
          name: positionTemplate.name,
          description: positionTemplate.description,
          experienceLevel: positionTemplate.experience_level,
          department: positionTemplate.department
        },
        dimensionAssessments: [],
        overallFit: {
          score: 75, // 默认分数，应该从GPT响应中解析
          level: 'good',
          reasoning: '基于面试表现和岗位要求的综合评估',
          confidence: 0.8
        },
        skillsMatching: {
          requiredSkills: positionTemplate.skills_required || [],
          demonstratedSkills: [],
          missingSkills: [],
          additionalSkills: [],
          matchingScore: 75
        },
        recommendationLevel: 'recommend',
        recommendations: ['需要进一步技术面试', '建议安排团队面试'],
        nextSteps: ['安排二面', '准备offer讨论']
      } : undefined,
      
      // 通用评估
      generalAssessment: {
        overall: '候选人整体表现良好，具备基本的专业素养。',
        strengths: ['沟通表达清晰', '学习能力强'],
        weaknesses: ['某些技术细节需要加强'],
        communicationSkills: { score: 8, analysis: '表达清晰，逻辑性强', evidence: [] },
        technicalSkills: { score: 7, analysis: '技术基础扎实', evidence: [] },
        problemSolving: { score: 7, analysis: '思路清晰', evidence: [] },
        culturalFit: { score: 8, analysis: '与团队文化匹配', evidence: [] }
      },
      
      interviewQuality: {
        questionQuality: 8,
        flowAndPacing: 8,
        depthOfProbing: 7,
        coverageCompleteness: 8,
        suggestions: ['可以增加更多技术深度问题']
      },
      
      keyInsights: {
        standoutMoments: [],
        redFlags: [],
        uniqueStrengths: ['学习能力强'],
        developmentAreas: ['技术深度']
      },
      
      recommendation: {
        decision: 'recommend',
        confidence: 0.8,
        reasoning: '候选人展现出良好的基础能力和学习潜力',
        nextSteps: ['安排技术面试'],
        timelineRecommendation: '建议一周内安排后续面试'
      },
      
      processingStats: {
        chunksProcessed: 0,
        totalTokensUsed: 0,
        processingTimeMs: 0,
        confidenceScore: 0.8,
        modelVersion: this.config.model,
        templateUsed: !!positionTemplate
      }
    };
  }

  private calculateConfidenceScore(summary: EnhancedInterviewSummary): number {
    // 基于多个因素计算置信度分数
    let confidence = 0.5; // 基础分数
    
    // 如果使用了岗位模板，增加置信度
    if (summary.positionAssessment) {
      confidence += 0.2;
    }
    
    // 根据转录长度调整置信度
    if (summary.metadata.totalWords > 1000) {
      confidence += 0.1;
    }
    
    // 根据面试时长调整
    if (summary.metadata.duration > 30) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private formatTimestamp(timestamp: number): string {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // 公共方法：检查服务可用性
  async isAvailable(): Promise<boolean> {
    return this.openai !== null;
  }

  // 公共方法：更新API密钥
  updateApiKey(apiKey: string): void {
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
}

// 导出类型
export type { 
  EnhancedInterviewSummary, 
  PositionMatchAssessment, 
  DimensionAssessment,
  InterviewMetadata
};