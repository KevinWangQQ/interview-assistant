// OpenAI翻译服务实现

import { ITranslationService, TranslationOptions } from '../interfaces';
import { TranslationResult, QuestionSuggestion, InterviewSummary, TranscriptionSegment } from '@/types';
import { apiKeyManager } from '@/lib/api-key-manager';
import OpenAI from 'openai';

export class OpenAITranslationService implements ITranslationService {
  private client: OpenAI | null = null;
  private usageStats = {
    tokensUsed: 0,
    requestsCount: 0,
    costEstimate: 0
  };

  constructor(apiKey?: string) {
    // 延迟初始化，避免SSR问题
    try {
      this.client = new OpenAI({
        apiKey: apiKey || this.getApiKey(),
        dangerouslyAllowBrowser: true // 在生产环境中应该通过后端API调用
      });
    } catch (error) {
      console.warn('OpenAI client 初始化失败，将在首次使用时重试:', error);
      // 不在构造函数中抛出错误，延迟到实际使用时处理
    }
  }

  private getApiKey(): string {
    try {
      return apiKeyManager.getOpenAIApiKey();
    } catch (error) {
      console.warn('获取API密钥失败:', error);
      throw error;
    }
  }

  private ensureClientInitialized(): void {
    if (!this.client) {
      try {
        this.client = new OpenAI({
          apiKey: this.getApiKey(),
          dangerouslyAllowBrowser: true
        });
        console.log('OpenAI client 重新初始化成功');
      } catch (error) {
        console.error('OpenAI client 初始化失败:', error);
        throw new Error('OpenAI client 初始化失败，请检查API密钥设置');
      }
    }
  }

  async translate(text: string, from: string, to: string): Promise<TranslationResult> {
    const translateId = Date.now();
    
    try {
      console.log(`[${translateId}] 开始翻译:`, { text, from, to });
      
      if (!text.trim()) {
        console.log(`[${translateId}] 空文本，跳过翻译`);
        return {
          translatedText: '',
          confidence: 1.0,
          originalText: text
        };
      }

      this.ensureClientInitialized();
      console.log(`[${translateId}] 客户端初始化完成`);
      
      // 🎯 优化的翻译API调用 - 减少重复翻译
      const optimizedSystemPrompt = this.buildAntiRepetitionSystemPrompt();
      const contextAwarePrompt = await this.buildContextAwarePrompt(text, from, to);
      console.log(`[${translateId}] 发送优化翻译请求...`);
      
      const translationPromise = this.client!.chat.completions.create({
        model: 'gpt-4o-mini',  // 升级到更智能的模型
        messages: [
          {
            role: 'system',
            content: optimizedSystemPrompt
          },
          {
            role: 'user',
            content: contextAwarePrompt
          }
        ],
        temperature: 0.1,  // 降低温度减少创造性重复
        max_tokens: 800,   // 增加token限制避免截断重复
        presence_penalty: 0.3,  // 减少重复内容
        frequency_penalty: 0.5   // 降低词频重复
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Translation timeout')), 15000);
      });
      
      const response = await Promise.race([translationPromise, timeoutPromise]) as any;
      console.log(`[${translateId}] 翻译API响应成功`);

      this.updateUsageStats(response.usage);

      const translatedText = response.choices[0]?.message?.content?.trim() || '';
      console.log(`[${translateId}] 翻译结果:`, translatedText);

      return {
        translatedText,
        confidence: 0.9,
        originalText: text
      };
    } catch (error) {
      console.error(`[${translateId}] 翻译失败:`, error);
      
      // 根据错误类型提供更有用的错误信息
      if (error instanceof Error) {
        if (error.message.includes('Translation timeout')) {
          throw new Error(`翻译超时，请检查网络连接`);
        } else if (error.message.includes('401')) {
          throw new Error(`API密钥无效，请检查配置`);
        } else if (error.message.includes('429')) {
          throw new Error(`API调用频率限制，请稍后重试`);
        }
      }
      
      throw new Error(`翻译失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    
    // 批量处理，每次最多处理5个文本
    const batchSize = 5;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.translate(text, from, to));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async suggestQuestions(context: string[], interviewType = 'general'): Promise<QuestionSuggestion[]> {
    try {
      this.ensureClientInitialized();
      
      const contextText = context.slice(-5).join('\n'); // 使用最近5个对话作为上下文
      
      const prompt = `Based on the following interview conversation context, suggest 3-5 relevant follow-up questions that an interviewer might ask. 
      
Context:
${contextText}

Interview Type: ${interviewType}

Please provide questions in both English and Chinese, formatted as JSON array with this structure:
[
  {
    "question": "English question",
    "questionChinese": "中文问题",
    "category": "technical|behavioral|experience|follow-up",
    "relevanceScore": 0.8
  }
]

Focus on questions that naturally follow from the conversation and help assess the candidate's qualifications.`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced interview consultant. Generate relevant and insightful interview questions based on the conversation context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      this.updateUsageStats(response.usage);

      const content = response.choices[0]?.message?.content?.trim() || '[]';
      
      try {
        const parsedQuestions = JSON.parse(content);
        return parsedQuestions.map((q: any, index: number) => ({
          id: `q-${Date.now()}-${index}`,
          question: q.question || '',
          questionChinese: q.questionChinese || '',
          context: contextText,
          relevanceScore: q.relevanceScore || 0.7,
          category: q.category || 'follow-up'
        }));
      } catch (parseError) {
        console.warn('Failed to parse question suggestions:', parseError);
        return [];
      }
    } catch (error) {
      throw new Error(`Question suggestion failed: ${error}`);
    }
  }

  async generateSummary(segments: TranscriptionSegment[]): Promise<InterviewSummary> {
    try {
      this.ensureClientInitialized();
      
      const conversationText = segments
        .map(s => `${s.speaker === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${s.originalText}`)
        .join('\n');

      const prompt = `Analyze the following interview conversation and provide a comprehensive summary and evaluation.

Conversation:
${conversationText}

Please provide a detailed analysis in Chinese including:
1. Overall conversation summary (3-4 sentences)
2. Candidate's key strengths and weaknesses
3. Technical competencies demonstrated
4. Communication skills assessment
5. Cultural fit indicators
6. Recommended next steps or areas for follow-up

Format your response as JSON:
{
  "content": "Overall summary in Chinese",
  "evaluation": "Detailed evaluation in Chinese",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendation": "hiring recommendation and next steps"
}`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced HR professional and interview assessor. Provide objective and insightful interview analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });

      this.updateUsageStats(response.usage);

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      
      try {
        const analysis = JSON.parse(content);
        
        return {
          id: `summary-${Date.now()}`,
          interviewId: segments[0]?.id.split('-')[0] || 'unknown',
          content: analysis.content || '无法生成总结',
          evaluation: analysis.evaluation || '无法生成评价',
          keyPoints: analysis.keyPoints || [],
          suggestedQuestions: [], // 可以在这里添加基于总结的问题建议
          createdAt: new Date()
        };
      } catch (parseError) {
        console.warn('Failed to parse summary:', parseError);
        return {
          id: `summary-${Date.now()}`,
          interviewId: 'unknown',
          content: '总结生成失败',
          evaluation: '评价生成失败',
          keyPoints: [],
          suggestedQuestions: [],
          createdAt: new Date()
        };
      }
    } catch (error) {
      throw new Error(`Summary generation failed: ${error}`);
    }
  }

  async detectLanguage(text: string): Promise<string> {
    try {
      this.ensureClientInitialized();
      
      const response = await this.client!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Detect the language of the given text. Respond with just the language code (e.g., "en", "zh", "es", etc.)'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0,
        max_tokens: 10
      });

      this.updateUsageStats(response.usage);

      return response.choices[0]?.message?.content?.trim().toLowerCase() || 'unknown';
    } catch (error) {
      console.warn('Language detection failed:', error);
      return 'unknown';
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.ensureClientInitialized();
      
      // 发送一个简单的测试请求
      await this.client!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUsageStats() {
    return { ...this.usageStats };
  }

  // 私有方法
  private buildTranslationPrompt(text: string, from: string, to: string): string {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean'
    };

    const fromLang = languageNames[from] || from;
    const toLang = languageNames[to] || to;

    return `Translate the following ${fromLang} text to ${toLang}. Maintain the original meaning, tone, and context. Do not add explanations or additional text.

Text to translate:
${text}`;
  }

  // 🧠 构建反重复的系统提示词
  private buildAntiRepetitionSystemPrompt(): string {
    return `You are a professional translator specializing in interview conversations. Your task is to provide accurate, concise translations while avoiding repetition.

Key guidelines:
1. Detect and eliminate redundant phrases or repeated content in the source text before translating
2. If the source contains obvious repetitions, consolidate them into a single, clear translation
3. Focus on the core meaning rather than literal word-for-word translation of repetitive elements
4. Maintain professional tone suitable for interview contexts
5. Do not add explanations, just provide the clean translation
6. If the source text is low quality or heavily repetitive, provide the most coherent interpretation

Prioritize clarity and conciseness over literal preservation of repetitive elements.`;
  }

  // 🔄 构建上下文感知的翻译提示
  private async buildContextAwarePrompt(text: string, from: string, to: string): Promise<string> {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean'
    };

    const fromLang = languageNames[from] || from;
    const toLang = languageNames[to] || to;

    // 预处理文本 - 检测和标记重复模式
    const textAnalysis = this.analyzeTextForRepetition(text);
    let processedText = text;
    
    if (textAnalysis.hasRepetition) {
      console.log(`🔍 检测到翻译源文本重复，重复比例: ${Math.round(textAnalysis.repetitionRatio * 100)}%`);
      processedText = this.consolidateRepetitiveText(text);
      console.log(`🧹 文本预处理完成: "${text.substring(0, 50)}..." -> "${processedText.substring(0, 50)}..."`);
    }

    return `Translate the following ${fromLang} text to ${toLang}. This is from an interview conversation context.

${textAnalysis.hasRepetition ? 'Note: The source text contained repetitive elements that have been consolidated.' : ''}

Text to translate:
${processedText}`;
  }

  // 📊 分析文本重复模式
  private analyzeTextForRepetition(text: string): { hasRepetition: boolean; repetitionRatio: number } {
    if (!text || text.trim().length < 20) {
      return { hasRepetition: false, repetitionRatio: 0 };
    }

    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    
    // 检测短语级重复
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const sentenceRepetitionRatio = 1 - (uniqueSentences.size / sentences.length);
    
    const hasRepetition = repetitionRatio > 0.3 || sentenceRepetitionRatio > 0.2;
    
    return {
      hasRepetition,
      repetitionRatio: Math.max(repetitionRatio, sentenceRepetitionRatio)
    };
  }

  // 🔧 整理重复文本
  private consolidateRepetitiveText(text: string): string {
    let consolidated = text;
    
    // 1. 移除重复的短句
    consolidated = consolidated.replace(/\b([^.!?]{1,30}[.!?])\s*\1{2,}/gi, '$1');
    
    // 2. 移除连续相同的词汇组合
    consolidated = consolidated.replace(/\b(\w+(?:\s+\w+){0,3})\s+\1{2,}/gi, '$1');
    
    // 3. 清理过多的填充词
    consolidated = consolidated.replace(/\b(um|uh|er|ah|like|you know)\s*\1+/gi, '$1');
    
    // 4. 句子级去重
    const sentences = consolidated.split(/[.!?]+/).filter(s => s.trim());
    const uniqueSentences: string[] = [];
    const seenSentences = new Set<string>();
    
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (!seenSentences.has(normalized) && normalized.length > 5) {
        uniqueSentences.push(sentence.trim());
        seenSentences.add(normalized);
      }
    }
    
    const result = uniqueSentences.join('. ') + (uniqueSentences.length > 0 ? '.' : '');
    
    return result || text; // 如果清理后为空，返回原文
  }

  private updateUsageStats(usage?: any): void {
    if (usage) {
      this.usageStats.tokensUsed += usage.total_tokens || 0;
      this.usageStats.requestsCount += 1;
      
      // 简单的成本估算（基于GPT-3.5-turbo定价）
      const inputCost = (usage.prompt_tokens || 0) * 0.001 / 1000;
      const outputCost = (usage.completion_tokens || 0) * 0.002 / 1000;
      this.usageStats.costEstimate += inputCost + outputCost;
    }
  }


  // 重置使用统计
  resetUsageStats(): void {
    this.usageStats = {
      tokensUsed: 0,
      requestsCount: 0,
      costEstimate: 0
    };
  }
}