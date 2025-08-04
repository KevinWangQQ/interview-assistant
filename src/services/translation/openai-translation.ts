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
      
      const prompt = this.buildTranslationPrompt(text, from, to);
      console.log(`[${translateId}] 发送翻译请求...`);
      
      // 使用Promise.race实现超时控制
      const translationPromise = this.client!.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text accurately while maintaining the original meaning and tone.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
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