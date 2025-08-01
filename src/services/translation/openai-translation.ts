// OpenAI翻译服务实现

import { ITranslationService, TranslationOptions } from '../interfaces';
import { TranslationResult, QuestionSuggestion, InterviewSummary, TranscriptionSegment } from '@/types';
import OpenAI from 'openai';

export class OpenAITranslationService implements ITranslationService {
  private client: OpenAI;
  private usageStats = {
    tokensUsed: 0,
    requestsCount: 0,
    costEstimate: 0
  };

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || this.getApiKey(),
      dangerouslyAllowBrowser: true // 在生产环境中应该通过后端API调用
    });
  }

  async translate(text: string, from: string, to: string): Promise<TranslationResult> {
    try {
      if (!text.trim()) {
        return {
          translatedText: '',
          confidence: 1.0,
          originalText: text
        };
      }

      const prompt = this.buildTranslationPrompt(text, from, to);
      
      const response = await this.client.chat.completions.create({
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

      this.updateUsageStats(response.usage);

      const translatedText = response.choices[0]?.message?.content?.trim() || '';

      return {
        translatedText,
        confidence: 0.9, // 默认置信度
        originalText: text
      };
    } catch (error) {
      throw new Error(`Translation failed: ${error}`);
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

      const response = await this.client.chat.completions.create({
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

      const response = await this.client.chat.completions.create({
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
      const response = await this.client.chat.completions.create({
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
      // 发送一个简单的测试请求
      await this.client.chat.completions.create({
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

  private getApiKey(): string {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
                   (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null);
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set NEXT_PUBLIC_OPENAI_API_KEY or save it in localStorage.');
    }
    
    return apiKey;
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