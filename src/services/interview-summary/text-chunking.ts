// 📚 文本分块处理算法 - 专门用于处理长面试转录的智能分块策略

interface ChunkingConfig {
  maxTokensPerChunk: number;
  overlapTokens: number;
  minChunkSize: number;
  preserveContext: boolean;
  chunkBoundaries: string[];
}

interface TextChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
  chunkIndex: number;
  hasOverlap: boolean;
  metadata: {
    speakerChanges: number;
    questionCount: number;
    sentenceCount: number;
    timeRange?: {
      start: number;
      end: number;
    };
  };
}

export class InterviewTextChunker {
  private config: ChunkingConfig;
  
  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      maxTokensPerChunk: 3000, // GPT-4的安全块大小
      overlapTokens: 300, // 重叠部分保持上下文
      minChunkSize: 500, // 最小块大小
      preserveContext: true,
      chunkBoundaries: [
        '\n\n', // 段落边界
        '. ', // 句子边界
        '? ', // 问句边界
        '! ', // 感叹句边界
        '。', // 中文句号
        '？', // 中文问号
        '！'  // 中文感叹号
      ],
      ...config
    };
  }

  // 🔢 估算token数量 (简化版本，实际应使用tiktoken)
  private estimateTokenCount(text: string): number {
    // 粗略估算：英文1个单词约1.3个token，中文1个字符约1个token
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
    const otherChars = text.replace(/[a-zA-Z\u4e00-\u9fff\s]/g, '').length;
    
    return Math.ceil(
      englishWords.length * 1.3 + 
      chineseChars.length * 1.0 + 
      otherChars * 0.5
    );
  }

  // 🔍 寻找最佳分割点
  private findBestSplitPoint(text: string, targetIndex: number): number {
    // 在目标位置附近寻找最佳分割点
    const searchRadius = 200; // 搜索半径
    const startSearch = Math.max(0, targetIndex - searchRadius);
    const endSearch = Math.min(text.length, targetIndex + searchRadius);
    
    // 按优先级搜索分割点
    for (const boundary of this.config.chunkBoundaries) {
      for (let i = targetIndex; i >= startSearch; i--) {
        if (text.substring(i, i + boundary.length) === boundary) {
          return i + boundary.length;
        }
      }
      
      for (let i = targetIndex; i <= endSearch - boundary.length; i++) {
        if (text.substring(i, i + boundary.length) === boundary) {
          return i + boundary.length;
        }
      }
    }
    
    // 如果找不到合适的边界，返回目标位置
    return targetIndex;
  }

  // 📊 分析文本元数据
  private analyzeTextMetadata(text: string, startTime?: number, endTime?: number): TextChunk['metadata'] {
    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    const questions = text.match(/[?？]/g) || [];
    
    // 简单的说话人变更检测（基于换行和冒号）
    const speakerChanges = (text.match(/\n[A-Za-z\u4e00-\u9fff]+:/g) || []).length;
    
    return {
      speakerChanges,
      questionCount: questions.length,
      sentenceCount: sentences.length,
      timeRange: startTime !== undefined && endTime !== undefined ? {
        start: startTime,
        end: endTime
      } : undefined
    };
  }

  // ✂️ 将文本分块
  chunkText(text: string, timeSegments?: Array<{ start: number; end: number; text: string }>): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    let currentIndex = 0;
    let chunkIndex = 0;
    
    console.log('📚 开始文本分块处理:', {
      totalLength: text.length,
      estimatedTokens: this.estimateTokenCount(text),
      maxTokensPerChunk: this.config.maxTokensPerChunk
    });

    while (currentIndex < text.length) {
      // 计算这个块的目标结束位置
      let targetEndIndex = currentIndex;
      let currentTokens = 0;
      
      // 逐步增加文本，直到接近token限制
      while (targetEndIndex < text.length && currentTokens < this.config.maxTokensPerChunk) {
        const nextChar = text[targetEndIndex];
        targetEndIndex++;
        
        // 每100个字符重新估算一次token数
        if (targetEndIndex % 100 === 0) {
          const currentText = text.substring(currentIndex, targetEndIndex);
          currentTokens = this.estimateTokenCount(currentText);
        }
      }
      
      // 如果超过了限制，回退找合适的分割点
      if (currentTokens >= this.config.maxTokensPerChunk) {
        targetEndIndex = this.findBestSplitPoint(text, targetEndIndex - 100);
      }
      
      // 确保不会创建过小的块（除非是最后一块）
      if (targetEndIndex - currentIndex < this.config.minChunkSize && targetEndIndex < text.length) {
        targetEndIndex = Math.min(text.length, currentIndex + this.config.minChunkSize);
      }
      
      // 提取块内容
      const chunkContent = text.substring(currentIndex, targetEndIndex).trim();
      
      if (chunkContent.length === 0) break;
      
      // 计算时间范围（如果提供了时间分段）
      let timeRange;
      if (timeSegments) {
        const relevantSegments = timeSegments.filter(segment => {
          const segmentStartInText = text.indexOf(segment.text);
          const segmentEndInText = segmentStartInText + segment.text.length;
          return segmentStartInText < targetEndIndex && segmentEndInText > currentIndex;
        });
        
        if (relevantSegments.length > 0) {
          timeRange = {
            start: Math.min(...relevantSegments.map(s => s.start)),
            end: Math.max(...relevantSegments.map(s => s.end))
          };
        }
      }
      
      // 创建块对象
      const chunk: TextChunk = {
        id: `chunk-${chunkIndex}-${Date.now()}`,
        content: chunkContent,
        startIndex: currentIndex,
        endIndex: targetEndIndex,
        tokenCount: this.estimateTokenCount(chunkContent),
        chunkIndex,
        hasOverlap: chunkIndex > 0 && this.config.preserveContext,
        metadata: this.analyzeTextMetadata(chunkContent, timeRange?.start, timeRange?.end)
      };
      
      chunks.push(chunk);
      
      console.log(`📄 创建文本块 ${chunkIndex}:`, {
        tokenCount: chunk.tokenCount,
        length: chunk.content.length,
        sentences: chunk.metadata.sentenceCount,
        questions: chunk.metadata.questionCount,
        timeRange: chunk.metadata.timeRange
      });
      
      // 计算下一块的起始位置
      if (this.config.preserveContext && chunkIndex > 0) {
        // 有重叠的情况
        const overlapStart = Math.max(0, targetEndIndex - this.config.overlapTokens * 4); // 粗略换算
        currentIndex = this.findBestSplitPoint(text, overlapStart);
      } else {
        // 无重叠的情况
        currentIndex = targetEndIndex;
      }
      
      chunkIndex++;
      
      // 安全检查，防止无限循环
      if (currentIndex <= chunks[chunks.length - 1]?.endIndex - 100) {
        console.warn('⚠️ 检测到可能的无限循环，强制跳转');
        currentIndex = chunks[chunks.length - 1].endIndex;
      }
    }
    
    console.log('✅ 文本分块完成:', {
      totalChunks: chunks.length,
      totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      averageTokensPerChunk: chunks.length > 0 ? Math.round(chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / chunks.length) : 0
    });
    
    return chunks;
  }

  // 🔄 重新合并小块
  mergeSmallChunks(chunks: TextChunk[]): TextChunk[] {
    const mergedChunks: TextChunk[] = [];
    let i = 0;
    
    while (i < chunks.length) {
      let currentChunk = chunks[i];
      
      // 如果当前块太小，尝试与下一块合并
      while (
        i + 1 < chunks.length && 
        currentChunk.tokenCount < this.config.minChunkSize &&
        currentChunk.tokenCount + chunks[i + 1].tokenCount <= this.config.maxTokensPerChunk
      ) {
        const nextChunk = chunks[i + 1];
        
        // 合并块
        currentChunk = {
          ...currentChunk,
          id: `merged-${currentChunk.id}-${nextChunk.id}`,
          content: currentChunk.content + '\n\n' + nextChunk.content,
          endIndex: nextChunk.endIndex,
          tokenCount: currentChunk.tokenCount + nextChunk.tokenCount,
          metadata: {
            speakerChanges: currentChunk.metadata.speakerChanges + nextChunk.metadata.speakerChanges,
            questionCount: currentChunk.metadata.questionCount + nextChunk.metadata.questionCount,
            sentenceCount: currentChunk.metadata.sentenceCount + nextChunk.metadata.sentenceCount,
            timeRange: currentChunk.metadata.timeRange && nextChunk.metadata.timeRange ? {
              start: Math.min(currentChunk.metadata.timeRange.start, nextChunk.metadata.timeRange.start),
              end: Math.max(currentChunk.metadata.timeRange.end, nextChunk.metadata.timeRange.end)
            } : currentChunk.metadata.timeRange || nextChunk.metadata.timeRange
          }
        };
        
        i++; // 跳过已合并的块
      }
      
      mergedChunks.push(currentChunk);
      i++;
    }
    
    console.log('🔄 小块合并完成:', {
      originalChunks: chunks.length,
      mergedChunks: mergedChunks.length,
      reduction: chunks.length - mergedChunks.length
    });
    
    return mergedChunks;
  }

  // 🧮 获取分块统计信息
  getChunkingStats(chunks: TextChunk[]): {
    totalChunks: number;
    totalTokens: number;
    averageTokensPerChunk: number;
    maxTokensInChunk: number;
    minTokensInChunk: number;
    totalQuestions: number;
    totalSpeakerChanges: number;
    processingRecommendation: string;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalTokens: 0,
        averageTokensPerChunk: 0,
        maxTokensInChunk: 0,
        minTokensInChunk: 0,
        totalQuestions: 0,
        totalSpeakerChanges: 0,
        processingRecommendation: '无内容需要处理'
      };
    }
    
    const tokenCounts = chunks.map(chunk => chunk.tokenCount);
    const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
    const totalQuestions = chunks.reduce((sum, chunk) => sum + chunk.metadata.questionCount, 0);
    const totalSpeakerChanges = chunks.reduce((sum, chunk) => sum + chunk.metadata.speakerChanges, 0);
    
    // 处理建议
    let processingRecommendation = '';
    if (chunks.length <= 3) {
      processingRecommendation = '小量内容，建议使用单次处理';
    } else if (chunks.length <= 10) {
      processingRecommendation = '中等内容，建议使用批处理模式';
    } else {
      processingRecommendation = '大量内容，建议使用流式处理和进度跟踪';
    }
    
    return {
      totalChunks: chunks.length,
      totalTokens,
      averageTokensPerChunk: Math.round(totalTokens / chunks.length),
      maxTokensInChunk: Math.max(...tokenCounts),
      minTokensInChunk: Math.min(...tokenCounts),
      totalQuestions,
      totalSpeakerChanges,
      processingRecommendation
    };
  }

  // ⚙️ 更新配置
  updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ 分块配置已更新:', this.config);
  }

  // 🔧 获取当前配置
  getConfig(): ChunkingConfig {
    return { ...this.config };
  }
}

export type { TextChunk, ChunkingConfig };