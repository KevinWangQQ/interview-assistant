// 🤖 GPT-4面试总结生成服务 - 基于英文原文的高质量面试分析

import { InterviewTextChunker, TextChunk } from './text-chunking';
import { TranscriptionSegment } from '@/utils/smart-segmentation';

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
}

interface InterviewSummary {
  id: string;
  timestamp: Date;
  metadata: InterviewMetadata;
  
  // 核心总结内容
  executiveSummary: string;
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
      model: 'gpt-4o', // 使用最新的GPT-4o模型
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
    metadata?: Partial<InterviewMetadata>
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
        chunks
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
    chunks: TextChunk[]
  ) {
    console.log('🔄 生成综合总结...');
    
    // 整合所有分块分析
    const consolidatedAnalysis = this.consolidateChunkAnalyses(chunkAnalyses);
    
    // 构建综合分析提示词
    const prompt = this.buildComprehensiveSummaryPrompt(
      consolidatedAnalysis,
      interviewData.metadata,
      chunks
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
    chunks: TextChunk[]
  ): string {
    return `你是资深的HR面试专家。基于以下面试分析数据，生成完整的面试评估报告。

面试基本信息：
- 时长：${metadata.duration}分钟
- 总词数：${metadata.totalWords}
- 互动次数：${metadata.interactionCount}
- 问题数量：${metadata.questionCount}

分块分析汇总：
${JSON.stringify(consolidatedAnalysis, null, 2)}

请生成完整的面试评估报告，使用以下JSON格式：

{
  "executiveSummary": "200字内的执行摘要，概述候选人整体表现",
  "candidatePerformance": {
    "overall": "整体表现评价",
    "strengths": ["优势1", "优势2", "优势3"],
    "weaknesses": ["不足1", "不足2"],
    "communicationSkills": "沟通能力具体评价",
    "technicalSkills": "技术能力具体评价"
  },
  "keyInsights": {
    "standoutMoments": ["亮点时刻1", "亮点时刻2"],
    "concerningAreas": ["关注领域1", "关注领域2"],
    "improvementSuggestions": ["改进建议1", "改进建议2", "改进建议3"]
  },
  "recommendation": {
    "decision": "recommend",
    "reasoning": "推荐理由的详细说明",
    "nextSteps": ["后续步骤1", "后续步骤2"]
  },
  "detailedAnalysis": {
    "skillsAssessment": {
      "communication": {
        "score": 8,
        "evidence": ["证据1", "证据2"],
        "improvement": "改进建议"
      },
      "technical": {
        "score": 7,
        "evidence": ["证据1", "证据2"],
        "improvement": "改进建议"
      },
      "problemSolving": {
        "score": 6,
        "evidence": ["证据1", "证据2"],
        "improvement": "改进建议"
      },
      "leadership": {
        "score": 5,
        "evidence": ["证据1", "证据2"],
        "improvement": "改进建议"
      }
    }
  }
}

评估标准：
- decision选项：strongly_recommend, recommend, neutral, not_recommend, strongly_not_recommend
- score范围：1-10分
- 基于具体事实和证据进行评价
- 保持客观专业的评估态度
- 提供具体可行的改进建议`;
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