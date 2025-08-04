// 🧠 智能分段处理器 - 基于语义和时间的智能分段算法

interface SegmentationConfig {
  maxSentencesPerSegment: number;
  minSegmentDuration: number; // 秒
  maxSegmentDuration: number; // 秒
  pauseThreshold: number; // 秒，语音停顿阈值
  sentenceEndMarkers: string[];
}

export interface TranscriptionSegment {
  id: string;
  timestamp: Date;
  startTime: number; // 相对于录制开始的秒数
  endTime: number;
  englishText: string;
  chineseText: string;
  speaker?: 'interviewer' | 'candidate' | 'unknown';
  confidence: number;
  wordCount: number;
  isComplete: boolean;
}

export class SmartSegmentationProcessor {
  private config: SegmentationConfig;
  private segments: TranscriptionSegment[] = [];
  private currentBuffer: {
    text: string;
    translation: string;
    startTime: number;
    lastUpdateTime: number;
    sentences: string[];
  } = {
    text: '',
    translation: '',
    startTime: 0,
    lastUpdateTime: 0,
    sentences: []
  };

  constructor(config: Partial<SegmentationConfig> = {}) {
    this.config = {
      maxSentencesPerSegment: 8, // 增加到8句，减少分段频率
      minSegmentDuration: 15, // 增加到15秒，确保有足够内容
      maxSegmentDuration: 60, // 增加到60秒，允许更长对话
      pauseThreshold: 5, // 增加到5秒停顿才触发分段
      sentenceEndMarkers: ['.', '!', '?', '。', '！', '？'],
      ...config
    };
  }

  // 🔍 检测句子边界
  private detectSentenceBoundaries(text: string): string[] {
    const sentences: string[] = [];
    let currentSentence = '';
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      currentSentence += char;

      // 检查是否是句子结束标记
      if (this.config.sentenceEndMarkers.includes(char)) {
        // 检查下一个字符是否是空格或结束
        const nextChar = text[i + 1];
        if (!nextChar || nextChar === ' ' || nextChar === '\n') {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      }

      i++;
    }

    // 添加剩余的不完整句子
    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  // 📊 计算文本复杂度评分
  private calculateTextComplexity(text: string): number {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const sentences = this.detectSentenceBoundaries(text);
    
    if (sentences.length === 0 || words.length === 0) return 0;

    // 平均句子长度
    const avgSentenceLength = words.length / sentences.length;
    
    // 长单词比例
    const longWords = words.filter(word => word.length > 6).length;
    const longWordRatio = longWords / words.length;
    
    // 复杂度评分 (0-1)
    const lengthScore = Math.min(avgSentenceLength / 20, 1);
    const complexityScore = (lengthScore + longWordRatio) / 2;
    
    return complexityScore;
  }

  // 🎯 判断是否应该创建新分段 - 重新设计基于静音和行数
  private shouldCreateNewSegment(
    newText: string, 
    currentTime: number,
    forceSegment: boolean = false,
    silenceDetected: boolean = false
  ): boolean {
    const { text: currentText, startTime, lastUpdateTime, sentences } = this.currentBuffer;
    
    // 强制分段
    if (forceSegment) return true;
    
    // 如果缓冲区为空，不分段
    if (!currentText.trim()) return false;
    
    // 时间相关的分段条件
    const segmentDuration = currentTime - startTime;
    
    // 计算文本行数（按换行符或每60字符一行估算）
    const estimatedLines = Math.ceil(currentText.length / 60) + (currentText.match(/\n/g) || []).length;
    
    // 检测完整句子
    const currentSentences = this.detectSentenceBoundaries(currentText);
    const hasCompleteSentence = currentSentences.length > 0 && 
      this.config.sentenceEndMarkers.some(marker => 
        currentSentences[currentSentences.length - 1].endsWith(marker)
      );
    
    // 主要分段条件1：超过10行且有完整句子
    if (estimatedLines >= 10 && hasCompleteSentence) {
      console.log(`📏 文本超过10行(${estimatedLines}行)且有完整句子，触发分段`);
      return true;
    }
    
    // 主要分段条件2：静音检测+完整句子
    if (silenceDetected && hasCompleteSentence && segmentDuration >= 3) {
      console.log('🔇 检测到静音+完整句子，触发分段');
      return true;
    }
    
    // 兜底条件：超过最大时长，强制分段
    if (segmentDuration >= this.config.maxSegmentDuration) {
      console.log('🕐 达到最大分段时长，强制分段');
      return true;
    }
    
    // 兜底条件：句子过多，强制分段
    if (currentSentences.length >= this.config.maxSentencesPerSegment) {
      console.log('📝 达到最大句子数量，强制分段');
      return true;
    }
    
    return false;
  }

  // 🔄 处理新的转录更新 - 增加静音检测支持
  processTranscriptionUpdate(
    newText: string,
    translation: string,
    currentTime: number,
    confidence: number = 0.9,
    speaker?: 'interviewer' | 'candidate',
    silenceDetected: boolean = false
  ): {
    newSegment: TranscriptionSegment | null;
    updatedBuffer: typeof this.currentBuffer;
  } {
    console.log('🔄 处理转录更新:', { newText: newText.substring(0, 50), currentTime });
    
    // 初始化缓冲区
    if (!this.currentBuffer.text) {
      this.currentBuffer.startTime = currentTime;
    }
    
    // 更新缓冲区
    this.currentBuffer.text = newText;
    this.currentBuffer.translation = translation;
    this.currentBuffer.lastUpdateTime = currentTime;
    this.currentBuffer.sentences = this.detectSentenceBoundaries(newText);
    
    // 检查是否需要创建新分段 - 传递静音检测参数
    let newSegment: TranscriptionSegment | null = null;
    
    if (this.shouldCreateNewSegment(newText, currentTime, false, silenceDetected)) {
      newSegment = this.createSegmentFromBuffer(currentTime, confidence, speaker);
      this.resetBuffer();
    }
    
    return {
      newSegment,
      updatedBuffer: { ...this.currentBuffer }
    };
  }

  // 📦 从缓冲区创建分段
  private createSegmentFromBuffer(
    currentTime: number,
    confidence: number,
    speaker?: 'interviewer' | 'candidate'
  ): TranscriptionSegment {
    const { text, translation, startTime } = this.currentBuffer;
    
    const segment: TranscriptionSegment = {
      id: `segment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      startTime,
      endTime: currentTime,
      englishText: text.trim(),
      chineseText: translation.trim(),
      speaker: speaker || 'unknown',
      confidence,
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      isComplete: this.isSegmentComplete(text)
    };
    
    this.segments.push(segment);
    
    console.log('📦 创建新分段:', {
      id: segment.id,
      duration: segment.endTime - segment.startTime,
      wordCount: segment.wordCount,
      isComplete: segment.isComplete
    });
    
    return segment;
  }

  // ✅ 判断分段是否完整
  private isSegmentComplete(text: string): boolean {
    const sentences = this.detectSentenceBoundaries(text);
    if (sentences.length === 0) return false;
    
    const lastSentence = sentences[sentences.length - 1];
    return this.config.sentenceEndMarkers.some(marker => lastSentence.endsWith(marker));
  }

  // 🧹 重置缓冲区
  private resetBuffer(): void {
    this.currentBuffer = {
      text: '',
      translation: '',
      startTime: 0,
      lastUpdateTime: 0,
      sentences: []
    };
  }

  // 🏁 强制完成当前分段（录制结束时调用）
  finalizePendingSegment(currentTime: number, confidence: number = 0.9): TranscriptionSegment | null {
    if (!this.currentBuffer.text.trim()) return null;
    
    console.log('🏁 强制完成待处理分段');
    const segment = this.createSegmentFromBuffer(currentTime, confidence);
    this.resetBuffer();
    return segment;
  }

  // 📊 获取分段统计信息
  getSegmentationStats(): {
    totalSegments: number;
    totalDuration: number;
    averageSegmentDuration: number;
    completedSegments: number;
    totalWords: number;
    averageWordsPerSegment: number;
  } {
    const totalDuration = this.segments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
    const completedSegments = this.segments.filter(seg => seg.isComplete).length;
    const totalWords = this.segments.reduce((sum, seg) => sum + seg.wordCount, 0);
    
    return {
      totalSegments: this.segments.length,
      totalDuration,
      averageSegmentDuration: this.segments.length > 0 ? totalDuration / this.segments.length : 0,
      completedSegments,
      totalWords,
      averageWordsPerSegment: this.segments.length > 0 ? totalWords / this.segments.length : 0
    };
  }

  // 🔍 获取所有分段
  getAllSegments(): TranscriptionSegment[] {
    return [...this.segments];
  }

  // 🧹 清空所有分段
  clearAllSegments(): void {
    this.segments = [];
    this.resetBuffer();
  }

  // ⚙️ 更新配置
  updateConfig(newConfig: Partial<SegmentationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ 分段配置已更新:', this.config);
  }

  // 🔧 获取当前配置
  getConfig(): SegmentationConfig {
    return { ...this.config };
  }

  // 📈 分析文本质量
  analyzeTextQuality(text: string): {
    complexity: number;
    readability: number;
    completeness: number;
    quality: 'high' | 'medium' | 'low';
  } {
    const complexity = this.calculateTextComplexity(text);
    const sentences = this.detectSentenceBoundaries(text);
    const words = text.split(/\s+/).filter(word => word.length > 0);
    
    // 可读性评分 (基于句子长度和结构)
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const readability = Math.max(0, 1 - (avgWordsPerSentence - 15) / 20); // 理想句长15词
    
    // 完整性评分 (基于句子结束标记)
    const completesSentences = sentences.filter(s => 
      this.config.sentenceEndMarkers.some(marker => s.endsWith(marker))
    ).length;
    const completeness = sentences.length > 0 ? completesSentences / sentences.length : 0;
    
    // 综合质量评分
    const overallScore = (complexity + readability + completeness) / 3;
    let quality: 'high' | 'medium' | 'low';
    if (overallScore >= 0.7) quality = 'high';
    else if (overallScore >= 0.4) quality = 'medium';
    else quality = 'low';
    
    return {
      complexity,
      readability,
      completeness,
      quality
    };
  }
}