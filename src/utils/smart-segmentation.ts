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

  // 🎯 改进的分段判断 - 减少重复和避免长句切断
  private shouldCreateNewSegment(
    newText: string, 
    currentTime: number,
    forceSegment: boolean = false,
    silenceDetected: boolean = false
  ): boolean {
    const { text: currentText, startTime } = this.currentBuffer;
    
    // 强制分段
    if (forceSegment) return true;
    
    // 如果缓冲区为空，不分段
    if (!currentText.trim()) return false;
    
    // 时间相关的分段条件
    const segmentDuration = currentTime - startTime;
    
    // 计算词数而不是行数（更准确）
    const wordCount = currentText.split(/\s+/).filter(word => word.length > 0).length;
    
    // 检测完整句子结尾
    const sentences = this.detectSentenceBoundaries(currentText);
    const hasCompleteSentence = sentences.length > 0 && 
      this.config.sentenceEndMarkers.some(marker => 
        currentText.trim().endsWith(marker)
      );
    
    // 检测是否在句子中间（避免切断）
    const endsWithIncompleteMarker = ['and', 'but', 'or', 'so', 'because', 'that', 'which', 'who', 'when', 'where', 'how', 'what', 'if', 'although', 'while']
      .some(word => currentText.toLowerCase().trim().endsWith(' ' + word));
    
    // 检测大量重复文本 - 紧急分段条件（降低触发条件）
    if (currentText.length > 500) {
      // 计算重复词汇比例
      const words = currentText.split(/\s+/);
      const uniqueWords = new Set(words.filter((w: string) => w.length > 2));
      const repetitionRatio = 1 - (uniqueWords.size / words.length);
      
      if (repetitionRatio > 0.4) {
        console.log(`🚨 检测到大量重复(${Math.round(repetitionRatio*100)}%)，强制分段`);
        return true;
      }
    }
    
    // 检测连续相同词汇 - 立即分段
    const words = currentText.split(/\s+/);
    let consecutiveCount = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < words.length; i++) {
      if (words[i].toLowerCase() === words[i-1].toLowerCase()) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }
    
    if (maxConsecutive >= 3) {
      console.log(`🚨 检测到连续重复词汇(${maxConsecutive}次)，强制分段`);
      return true;
    }
    
    // 避免在不完整的地方分段
    if (endsWithIncompleteMarker) {
      console.log(`🚫 避免在不完整位置分段: "${currentText.slice(-20)}"`);
      return false;
    }
    
    // 主要分段条件1：词数超过120词且有完整句子（减少分段频次）
    if (wordCount >= 120 && hasCompleteSentence) {
      console.log(`📏 文本超过120词(${wordCount}词)且有完整句子，触发分段`);
      return true;
    }
    
    // 主要分段条件2：静音检测+完整句子+最小时长
    if (silenceDetected && hasCompleteSentence && segmentDuration >= 5) {
      console.log('🔇 检测到静音+完整句子，触发分段');
      return true;
    }
    
    // 兜底条件：超过最大时长，强制分段
    if (segmentDuration >= this.config.maxSegmentDuration) {
      console.log('🕐 达到最大分段时长，强制分段');
      return true;
    }
    
    // 兜底条件：句子过多，强制分段
    if (sentences.length >= this.config.maxSentencesPerSegment) {
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
    updatedBuffer: {
      text: string;
      translation: string;
      startTime: number;
      lastUpdateTime: number;
      sentences: string[];
    };
  } {
    console.log('🔄 处理转录更新:', { newText: newText.substring(0, 50), currentTime });
    
    // 初始化缓冲区
    if (!this.currentBuffer.text) {
      this.currentBuffer.startTime = currentTime;
    }
    
    // 智能文本合并 - 减少重复
    const mergedText = this.mergeTextIntelligently(this.currentBuffer.text, newText);
    
    // 更新缓冲区
    this.currentBuffer.text = mergedText;
    this.currentBuffer.translation = translation;
    this.currentBuffer.lastUpdateTime = currentTime;
    this.currentBuffer.sentences = this.detectSentenceBoundaries(mergedText);
    
    // 检查是否需要创建新分段
    let newSegment: TranscriptionSegment | null = null;
    
    if (this.shouldCreateNewSegment(mergedText, currentTime, false, silenceDetected)) {
      newSegment = this.createSegmentFromBuffer(currentTime, confidence, speaker);
      this.resetBuffer();
    }
    
    return {
      newSegment,
      updatedBuffer: { ...this.currentBuffer }
    };
  }

  // 🧠 智能文本合并 - 减少重复内容
  private mergeTextIntelligently(existingText: string, newText: string): string {
    if (!existingText) return newText;
    if (!newText) return existingText;
    
    // 检查是否完全相同
    if (existingText.trim() === newText.trim()) {
      console.log('🚫 检测到完全相同的文本，跳过合并');
      return existingText;
    }
    
    // 如果新文本完全包含在现有文本中，返回现有文本
    if (existingText.includes(newText.trim())) {
      console.log('🚫 新文本已包含在现有文本中，跳过合并');
      return existingText;
    }
    
    // 如果新文本完全包含现有文本，返回新文本
    if (newText.includes(existingText.trim())) {
      console.log('🔄 新文本包含现有文本，使用新文本');
      return newText;
    }
    
    // 检查大量重复的情况 - 如果新文本超过80%都是重复的
    const existingWords = existingText.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);
    
    // 检查新文本中有多少词在现有文本中重复出现
    const duplicateWords = newWords.filter((word: string) => 
      existingWords.includes(word) && word.length > 2 // 忽略短词
    );
    
    if (duplicateWords.length > newWords.length * 0.5) {
      console.log(`🚫 检测到大量重复(${Math.round(duplicateWords.length/newWords.length*100)}%)，跳过合并`);
      return existingText;
    }
    
    // 查找最长的公共后缀（现有文本的结尾和新文本的开头）
    let overlapLength = 0;
    const maxOverlap = Math.min(existingWords.length, newWords.length, 15); // 增加到15个词
    
    for (let i = 1; i <= maxOverlap; i++) {
      const existingSuffix = existingWords.slice(-i).join(' ').toLowerCase();
      const newPrefix = newWords.slice(0, i).join(' ').toLowerCase();
      
      if (existingSuffix === newPrefix) {
        overlapLength = i;
      }
    }
    
    if (overlapLength > 0) {
      // 有重复，合并去重
      const mergedWords = [...existingWords, ...newWords.slice(overlapLength)];
      const result = mergedWords.join(' ');
      console.log(`🔀 检测到${overlapLength}词重复，智能合并`);
      return result;
    }
    
    // 检查文本长度是否合理 - 防止异常长的文本
    if (existingText.length > 2000) {
      console.log('⚠️ 现有文本过长，强制创建新分段');
      return newText; // 返回新文本，触发分段
    }
    
    // 没有重复，直接拼接
    return existingText + ' ' + newText;
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