// 🎵 增强版WAV流式转录服务 - 支持多音频源组合和智能分段
// 专门解决Teams会议等复杂音频场景

import { SmartSegmentationProcessor, TranscriptionSegment } from '@/utils/smart-segmentation';

interface EnhancedWAVStreamingConfig {
  chunkInterval: number;
  translationDelay: number;
  enableSystemAudio: boolean;
  audioQualityThreshold: number;
  silenceThreshold: number; // 静音检测阈值
  silenceDuration: number; // 静音持续时间（毫秒）
  minConfidenceScore: number; // 最小置信度分数
  maxLinesPerSegment: number; // 每段最大行数
}

interface AudioSourceInfo {
  type: 'microphone' | 'system' | 'combined';
  stream: MediaStream | null;
  isActive: boolean;
  quality: number;
}

interface AudioQualityMetrics {
  volume: number;
  clarity: number;
  timestamp: number;
}

type EnhancedWAVEventType = 
  | 'transcription_update' 
  | 'translation_update' 
  | 'error' 
  | 'audio_source_changed'
  | 'audio_quality_update'
  | 'segment_created'
  | 'segment_updated';

interface EnhancedWAVEvent {
  type: EnhancedWAVEventType;
  data: any;
  timestamp: number;
}

export class EnhancedWAVStreamingTranscriptionService {
  private config: EnhancedWAVStreamingConfig;
  private audioContext: AudioContext | null = null;
  
  // 智能分段处理器
  private segmentationProcessor: SmartSegmentationProcessor;
  private recordingStartTime: number = 0;
  
  // 多音频源管理
  private microphoneSource: AudioSourceInfo = {
    type: 'microphone',
    stream: null,
    isActive: false,
    quality: 0
  };
  
  private systemAudioSource: AudioSourceInfo = {
    type: 'system',
    stream: null,
    isActive: false,
    quality: 0
  };
  
  // 音频处理
  private combinedStream: MediaStream | null = null;
  private audioChunks: Float32Array[] = [];
  private isRecording = false;
  private currentText = '';
  private currentTranslation = '';
  
  // 新增：连续音频管理
  private continuousAudioBuffer: Float32Array[] = [];
  private lastAudioTime: number = 0;
  private silenceStartTime: number = 0;
  private isSilent: boolean = false;
  
  // 音频质量监控
  private qualityAnalyser: AnalyserNode | null = null;
  private qualityDataArray: Uint8Array | null = null;
  
  // 事件系统
  private eventListeners: Map<EnhancedWAVEventType, Set<(event: EnhancedWAVEvent) => void>> = new Map();
  
  // 定时器
  private recordTimer: NodeJS.Timeout | null = null;
  private translationTimer: NodeJS.Timeout | null = null;
  private qualityTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<EnhancedWAVStreamingConfig> = {}) {
    this.config = {
      chunkInterval: 1000, // 缩短到1秒，提高响应速度
      translationDelay: 500, // 缩短翻译延迟
      enableSystemAudio: true,
      audioQualityThreshold: 0.1,
      silenceThreshold: 0.01, // 静音阈值
      silenceDuration: 1000, // 1秒静音触发分段
      minConfidenceScore: 0.6, // 提高置信度要求，过滤幻觉
      maxLinesPerSegment: 10, // 最多10行后分段
      ...config
    };
    
    // 初始化智能分段处理器 - 优化分段参数减少过度分段
    this.segmentationProcessor = new SmartSegmentationProcessor({
      maxSentencesPerSegment: 8,
      minSegmentDuration: 15,
      maxSegmentDuration: 60,
      pauseThreshold: 5,
    });
    
    this.initializeEventMaps();
  }

  private initializeEventMaps() {
    const eventTypes: EnhancedWAVEventType[] = [
      'transcription_update', 
      'translation_update', 
      'error',
      'audio_source_changed',
      'audio_quality_update',
      'segment_created',
      'segment_updated'
    ];
    eventTypes.forEach(type => {
      this.eventListeners.set(type, new Set());
    });
  }

  // 🎤 检测可用音频源
  async detectAudioSources(): Promise<{
    microphoneAvailable: boolean;
    systemAudioAvailable: boolean;
    recommendedSetup: string;
  }> {
    try {
      console.log('🔍 检测可用音频源...');
      
      // 检测麦克风
      let microphoneAvailable = false;
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneAvailable = true;
        micStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('麦克风不可用:', error);
      }

      // 检测系统音频支持 - 针对iMac Chrome优化
      let systemAudioAvailable = false;
      if (this.config.enableSystemAudio) {
        try {
          // 检查浏览器支持
          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            console.warn('浏览器不支持屏幕共享音频');
          } else {
            // 尝试获取显示媒体的音频
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                ...(typeof (window as any).chrome !== 'undefined' && {
                  suppressLocalAudioPlayback: false // Chrome特有参数
                })
              } as MediaTrackConstraints,
              video: false
            });
            systemAudioAvailable = true;
            displayStream.getTracks().forEach(track => track.stop());
          }
        } catch (error) {
          console.warn('系统音频不可用:', error);
          console.warn('请在Chrome中允许"共享系统音频"选项');
        }
      }

      // 推荐设置
      let recommendedSetup = '';
      if (microphoneAvailable && systemAudioAvailable) {
        recommendedSetup = 'Teams会议最佳配置：麦克风 + 系统音频组合';
      } else if (microphoneAvailable) {
        recommendedSetup = '标准配置：仅麦克风录音';
      } else {
        recommendedSetup = '音频源不可用，请检查权限设置';
      }

      const result = {
        microphoneAvailable,
        systemAudioAvailable,
        recommendedSetup
      };

      console.log('🔍 音频源检测结果:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 音频源检测失败:', error);
      throw error;
    }
  }

  // 🎵 初始化多音频源
  async initializeAudioSources(): Promise<void> {
    try {
      console.log('🎵 初始化多音频源...');

      // 获取麦克风音频
      try {
        this.microphoneSource.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        this.microphoneSource.isActive = true;
        console.log('✅ 麦克风音频源已连接');
      } catch (error) {
        console.warn('⚠️ 麦克风获取失败:', error);
      }

      // 获取系统音频（如果启用） - iMac Chrome优化
      if (this.config.enableSystemAudio) {
        try {
          this.systemAudioSource.stream = await navigator.mediaDevices.getDisplayMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              ...(typeof (window as any).chrome !== 'undefined' && {
                suppressLocalAudioPlayback: false
              }),
              sampleRate: 16000,
              channelCount: 1
            } as MediaTrackConstraints,
            video: false
          });
          this.systemAudioSource.isActive = true;
          console.log('✅ 系统音频源已连接 (iMac Chrome优化)');
        } catch (error) {
          console.warn('⚠️ 系统音频获取失败:', error);
          console.warn('💡 请确保在Chrome中选择"共享系统音频"选项');
        }
      }

      // 创建组合音频流
      await this.createCombinedAudioStream();
      
    } catch (error) {
      console.error('❌ 音频源初始化失败:', error);
      throw error;
    }
  }

  // 🔀 创建组合音频流
  private async createCombinedAudioStream(): Promise<void> {
    try {
      console.log('🔀 创建组合音频流...');

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // 创建音频混合器
      const mixerNode = this.audioContext.createGain();
      const destination = this.audioContext.createMediaStreamDestination();
      
      // 连接麦克风源
      if (this.microphoneSource.stream && this.microphoneSource.isActive) {
        const micSource = this.audioContext.createMediaStreamSource(this.microphoneSource.stream);
        const micGain = this.audioContext.createGain();
        micGain.gain.value = 0.8; // 麦克风音量权重
        micSource.connect(micGain).connect(mixerNode);
        console.log('🎤 麦克风已连接到混合器');
      }

      // 连接系统音频源
      if (this.systemAudioSource.stream && this.systemAudioSource.isActive) {
        const systemSource = this.audioContext.createMediaStreamSource(this.systemAudioSource.stream);
        const systemGain = this.audioContext.createGain();
        systemGain.gain.value = 0.6; // 系统音频音量权重
        systemSource.connect(systemGain).connect(mixerNode);
        console.log('🔊 系统音频已连接到混合器');
      }

      // 设置音频质量监控
      this.qualityAnalyser = this.audioContext.createAnalyser();
      this.qualityAnalyser.fftSize = 256;
      this.qualityDataArray = new Uint8Array(this.qualityAnalyser.frequencyBinCount);
      
      // 连接音频流
      mixerNode.connect(this.qualityAnalyser);
      mixerNode.connect(destination);
      
      // 创建组合媒体流
      this.combinedStream = destination.stream;
      
      // 开始质量监控
      this.startQualityMonitoring();
      
      console.log('✅ 组合音频流创建成功');
      
    } catch (error) {
      console.error('❌ 组合音频流创建失败:', error);
      throw error;
    }
  }

  // 📊 音频质量监控
  private startQualityMonitoring(): void {
    if (!this.qualityAnalyser || !this.qualityDataArray) return;

    this.qualityTimer = setInterval(() => {
      if (!this.qualityAnalyser || !this.qualityDataArray || !this.isRecording) return;

      this.qualityAnalyser.getByteFrequencyData(this.qualityDataArray);
      
      // 计算音频质量指标
      const sum = this.qualityDataArray.reduce((a, b) => a + b, 0);
      const average = sum / this.qualityDataArray.length;
      const volume = average / 255;
      
      // 计算清晰度（基于频谱分布）
      const highFreqSum = Array.from(this.qualityDataArray.slice(128)).reduce((a, b) => a + b, 0);
      const clarity = highFreqSum / (128 * 255);
      
      const metrics: AudioQualityMetrics = {
        volume,
        clarity,
        timestamp: Date.now()
      };

      // 更新音频源质量
      this.microphoneSource.quality = volume;
      this.systemAudioSource.quality = volume;

      // 发出质量更新事件
      this.emitEvent('audio_quality_update', metrics);
      
    }, 500); // 每500ms更新一次
  }

  // 🎬 开始录制
  async startStreaming(): Promise<void> {
    try {
      console.log('🎬 启动增强版WAV流式转录服务');
      
      // 记录录制开始时间
      this.recordingStartTime = Date.now();
      
      // 重置分段处理器
      this.segmentationProcessor.clearAllSegments();
      
      // 初始化音频源
      await this.initializeAudioSources();
      
      if (!this.combinedStream) {
        throw new Error('无法创建音频流');
      }

      // 设置PCM数据收集
      await this.setupPCMRecording();
      
      this.isRecording = true;
      this.startRecordingTimers();
      
      // 发出音频源变更事件
      this.emitEvent('audio_source_changed', {
        microphone: this.microphoneSource,
        systemAudio: this.systemAudioSource
      });
      
      console.log('✅ 增强版WAV流式转录服务启动成功');
      
    } catch (error) {
      this.emitEvent('error', { error, message: '启动增强版WAV流式转录失败' });
      throw error;
    }
  }

  // 🎧 设置PCM录制 - 增强版静音检测
  private async setupPCMRecording(): Promise<void> {
    if (!this.audioContext || !this.combinedStream) {
      throw new Error('AudioContext或音频流未准备就绪');
    }

    const source = this.audioContext.createMediaStreamSource(this.combinedStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // 复制音频数据到连续缓冲区
      const audioData = new Float32Array(inputData.length);
      audioData.set(inputData);
      this.continuousAudioBuffer.push(audioData);
      
      // 检测音频强度（用于静音检测）
      const audioLevel = this.calculateAudioLevel(inputData);
      const currentTime = Date.now();
      
      if (audioLevel < this.config.silenceThreshold) {
        // 静音状态
        if (!this.isSilent) {
          this.isSilent = true;
          this.silenceStartTime = currentTime;
        }
      } else {
        // 有声音状态
        if (this.isSilent) {
          // 从静音转为有声音，检查静音持续时间
          const silenceDuration = currentTime - this.silenceStartTime;
          if (silenceDuration >= this.config.silenceDuration) {
            console.log(`🔇 检测到${silenceDuration}ms静音，可能需要分段`);
            // 标记静音结束，可以用于分段决策
          }
        }
        this.isSilent = false;
        this.lastAudioTime = currentTime;
      }
      
      // 为了兼容现有逻辑，也放入原有的audioChunks
      this.audioChunks.push(audioData);
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    console.log('🎧 增强版PCM录制设置完成（包含静音检测）');
  }
  
  // 📊 计算音频强度
  private calculateAudioLevel(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return sum / audioData.length;
  }


  // 📝 处理音频块 - 改进版：避免音频遗漏  
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) {
      console.log('⚠️ 没有音频数据可处理');
      return;
    }

    try {
      // 合并PCM数据
      const pcmData = this.mergePCMChunks();
      
      // 转换为WAV格式
      const wavBlob = this.createWAVBlob(pcmData, 16000, 1);
      
      // 改进：保留最后25%的音频数据作为重叠，避免分段边界音频丢失
      const overlapSize = Math.floor(this.audioChunks.length * 0.25);
      if (overlapSize > 0) {
        this.audioChunks = this.audioChunks.slice(-overlapSize);
        console.log(`🔄 保留${overlapSize}个音频块作为重叠缓冲`);
      } else {
        this.audioChunks = [];
      }
      
      console.log('🎵 增强版WAV音频数据准备完成:', {
        size: wavBlob.size,
        type: wavBlob.type,
        sampleCount: pcmData.length,
        sources: {
          microphone: this.microphoneSource.isActive,
          systemAudio: this.systemAudioSource.isActive
        }
      });

      // 转录音频
      const transcriptionResult = await this.transcribeAudio(wavBlob);
      
      if (transcriptionResult.text && transcriptionResult.text.trim()) {
        const newText = transcriptionResult.text.trim();
        const confidence = transcriptionResult.confidence || 0.9;
        
        // 置信度过滤：过滤掉低置信度的结果（通常是幻觉或杂音）
        if (confidence < this.config.minConfidenceScore) {
          console.log(`🚫 低置信度转录被过滤: "${newText}" (置信度: ${confidence})`);
          return;
        }
        
        // 过滤常见的杂音幻觉词汇
        const noiseWords = ['thank you', 'bye', 'you', 'um', 'uh', 'yeah'];
        if (newText.length < 10 && noiseWords.some(word => newText.toLowerCase().includes(word))) {
          console.log(`🚫 疑似杂音词汇被过滤: "${newText}"`);
          return;
        }
        
        // 累积当前分段的文本
        this.currentText = this.currentText ? 
          this.currentText + ' ' + newText : newText;
        
        console.log('📝 增强版WAV转录更新 (当前分段):', this.currentText, `(置信度: ${confidence})`);
        
        this.emitEvent('transcription_update', {
          text: this.currentText,
          confidence: confidence,
          timestamp: Date.now(),
          audioSources: {
            microphone: this.microphoneSource.isActive,
            systemAudio: this.systemAudioSource.isActive
          }
        });
        
        this.scheduleTranslation();
      }
      
    } catch (error) {
      console.error('❌ 增强版WAV音频处理失败:', error);
      this.emitEvent('error', { 
        error, 
        message: `增强版WAV处理失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    }
  }

  // 🔀 合并PCM数据（复用原有逻辑）
  private mergePCMChunks(): Float32Array {
    if (this.audioChunks.length === 0) {
      throw new Error('没有PCM数据可合并');
    }

    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const mergedData = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of this.audioChunks) {
      mergedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log('🔀 增强版PCM数据合并完成:', {
      chunks: this.audioChunks.length,
      totalSamples: totalLength,
      durationSeconds: totalLength / 16000
    });
    
    return mergedData;
  }

  // 🎵 创建WAV格式Blob（复用原有逻辑）
  private createWAVBlob(pcmData: Float32Array, sampleRate: number, channels: number): Blob {
    const length = pcmData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // WAV文件头
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // 写入PCM数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, pcmData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // 🗣️ 转录音频（复用原有逻辑）
  private async transcribeAudio(audioBlob: Blob): Promise<any> {
    const { getAudioService } = await import('@/services');
    const audioService = getAudioService();
    
    console.log('🗣️ 开始增强版WAV音频转录:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isWAV: audioBlob.type === 'audio/wav'
    });
    
    return await audioService.transcribe(audioBlob, {
      language: 'en',
      temperature: 0.2
    });
  }

  // 🌍 调度翻译（复用原有逻辑）
  private scheduleTranslation(): void {
    if (this.translationTimer) {
      clearTimeout(this.translationTimer);
    }
    
    this.translationTimer = setTimeout(async () => {
      if (this.currentText && this.currentText.length > 3) {
        await this.translateText();
      }
    }, this.config.translationDelay);
  }

  // 🌐 翻译文本（集成智能分段）
  private async translateText(): Promise<void> {
    try {
      const { getTranslationService } = await import('@/services');
      const translationService = getTranslationService();
      
      console.log('🌐 开始翻译增强版WAV转录结果:', this.currentText.substring(0, 50) + '...');
      
      const result = await translationService.translate(
        this.currentText,
        'en',
        'zh'
      );
      
      // 更新当前翻译
      this.currentTranslation = result.translatedText;
      
      console.log('🌍 增强版WAV转录翻译完成:', result.translatedText);
      
      // 使用智能分段处理器处理转录和翻译结果
      const currentTime = (Date.now() - this.recordingStartTime) / 1000; // 转换为秒
      
      // 检查是否刚检测到静音结束（可能需要分段）
      const recentSilenceDetected = this.isSilent && 
        (Date.now() - this.silenceStartTime) >= this.config.silenceDuration;
      
      const segmentResult = this.segmentationProcessor.processTranscriptionUpdate(
        this.currentText,
        result.translatedText,
        currentTime,
        0.9, // 默认信心度
        'candidate', // 默认说话人，后续可以通过说话人识别来改进
        recentSilenceDetected // 传递静音检测信息
      );
      
      // 发出翻译更新事件
      this.emitEvent('translation_update', {
        text: this.currentText,
        translation: result.translatedText,
        timestamp: Date.now(),
        currentBuffer: segmentResult.updatedBuffer
      });
      
      // 关键修复：如果创建了新分段，重置当前文本和翻译，开始新的分段
      if (segmentResult.newSegment) {
        console.log('📦 智能分段创建新片段:', segmentResult.newSegment.id);
        console.log('🔄 重置当前文本缓冲区和音频缓冲区，开始新分段');
        
        // 重置当前分段的文本和翻译，避免累积
        this.currentText = '';
        this.currentTranslation = '';
        
        // 关键优化：清理音频缓冲区，确保下一个分段从干净的音频状态开始
        this.audioChunks = [];
        
        this.emitEvent('segment_created', {
          segment: segmentResult.newSegment,
          totalSegments: this.segmentationProcessor.getAllSegments().length,
          stats: this.segmentationProcessor.getSegmentationStats()
        });
      }
      
    } catch (error) {
      console.error('❌ 增强版WAV转录翻译失败:', error);
      this.emitEvent('error', { 
        error, 
        message: `翻译失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    }
  }

  // 🛑 停止服务
  async stopStreaming(): Promise<void> {
    console.log('🛑 停止增强版WAV流式转录服务');
    
    this.isRecording = false;
    
    // 完成待处理的分段
    const currentTime = (Date.now() - this.recordingStartTime) / 1000;
    const finalSegment = this.segmentationProcessor.finalizePendingSegment(currentTime, 0.9);
    if (finalSegment) {
      console.log('🏁 完成最终分段:', finalSegment.id);
      this.emitEvent('segment_created', {
        segment: finalSegment,
        totalSegments: this.segmentationProcessor.getAllSegments().length,
        stats: this.segmentationProcessor.getSegmentationStats(),
        isFinal: true
      });
    }
    
    // 清理定时器
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    
    if (this.translationTimer) {
      clearTimeout(this.translationTimer);
      this.translationTimer = null;
    }

    if (this.qualityTimer) {
      clearInterval(this.qualityTimer);
      this.qualityTimer = null;
    }
    
    // 清理音频资源
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // 停止所有音频轨道
    if (this.microphoneSource.stream) {
      this.microphoneSource.stream.getTracks().forEach(track => track.stop());
      this.microphoneSource.stream = null;
      this.microphoneSource.isActive = false;
    }
    
    if (this.systemAudioSource.stream) {
      this.systemAudioSource.stream.getTracks().forEach(track => track.stop());
      this.systemAudioSource.stream = null;
      this.systemAudioSource.isActive = false;
    }
    
    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
    }
    
    // 重置状态
    this.currentText = '';
    this.currentTranslation = '';
    this.audioChunks = [];
    this.continuousAudioBuffer = [];
    this.lastAudioTime = 0;
    this.silenceStartTime = 0;
    this.isSilent = false;
    
    console.log('✅ 增强版WAV流式转录服务已停止');
  }

  // ⏸️ 暂停流式转录
  async pauseStreaming(): Promise<void> {
    console.log('⏸️ 暂停增强版WAV流式转录服务');
    
    if (!this.isRecording) {
      console.warn('⚠️ 服务未在录制状态，无法暂停');
      return;
    }
    
    // 暂停录制但保持流状态
    this.isRecording = false;
    
    // 暂停定时器
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    
    if (this.translationTimer) {
      clearTimeout(this.translationTimer);
      this.translationTimer = null;
    }
    
    if (this.qualityTimer) {
      clearTimeout(this.qualityTimer);
      this.qualityTimer = null;
    }
    
    console.log('✅ 增强版WAV流式转录服务已暂停');
  }

  // ▶️ 恢复流式转录
  async resumeStreaming(): Promise<void> {
    console.log('▶️ 恢复增强版WAV流式转录服务');
    
    if (this.isRecording) {
      console.warn('⚠️ 服务已在录制状态，无需恢复');
      return;
    }
    
    if (!this.combinedStream) {
      console.error('❌ 无活跃音频流，无法恢复录制');
      throw new Error('无活跃音频流，请重新开始录制');
    }
    
    // 恢复录制状态
    this.isRecording = true;
    
    // 重新启动定时器
    this.startRecordingTimers();
    
    console.log('✅ 增强版WAV流式转录服务已恢复');
  }

  // ⏰ 启动录制定时器
  private startRecordingTimers(): void {
    // 启动录音循环
    this.recordTimer = setInterval(async () => {
      try {
        await this.processAudioChunks();
      } catch (error) {
        console.error('❌ 录音循环错误:', error);
        this.emitEvent('error', { error, message: '录音处理错误' });
      }
    }, this.config.chunkInterval);

    // 启动音频质量监控
    this.qualityTimer = setInterval(() => {
      if (!this.qualityAnalyser || !this.qualityDataArray || !this.isRecording) return;
      
      this.qualityAnalyser.getByteFrequencyData(this.qualityDataArray);
      
      const sum = this.qualityDataArray.reduce((a, b) => a + b, 0);
      const average = sum / this.qualityDataArray.length;
      const volume = average / 255;
      
      // 更新音频源质量
      this.microphoneSource.quality = volume;
      this.systemAudioSource.quality = volume;
    }, 500);
  }

  // 📡 事件系统（复用原有逻辑）
  addEventListener(type: EnhancedWAVEventType, listener: (event: EnhancedWAVEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
  }

  removeEventListener(type: EnhancedWAVEventType, listener: (event: EnhancedWAVEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emitEvent(type: EnhancedWAVEventType, data: any): void {
    const event: EnhancedWAVEvent = {
      type,
      data,
      timestamp: Date.now()
    };
    
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`❌ 增强版WAV事件监听器错误 [${type}]:`, error);
        }
      });
    }
  }

  // 📈 获取状态
  getStatus() {
    return {
      isRecording: this.isRecording,
      currentText: this.currentText,
      currentTranslation: this.currentTranslation,
      audioChunksCount: this.audioChunks.length,
      audioSources: {
        microphone: this.microphoneSource,
        systemAudio: this.systemAudioSource
      },
      segments: this.segmentationProcessor.getAllSegments(),
      segmentationStats: this.segmentationProcessor.getSegmentationStats(),
      config: this.config
    };
  }

  // 📝 获取所有分段
  getAllSegments(): TranscriptionSegment[] {
    return this.segmentationProcessor.getAllSegments();
  }

  // 📊 获取分段统计
  getSegmentationStats() {
    return this.segmentationProcessor.getSegmentationStats();
  }

  // 🎛️ 动态配置音频源
  async toggleSystemAudio(enabled: boolean): Promise<void> {
    if (enabled && !this.systemAudioSource.isActive) {
      try {
        this.systemAudioSource.stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: false
        });
        this.systemAudioSource.isActive = true;
        
        // 如果正在录制，重新创建组合流
        if (this.isRecording) {
          await this.createCombinedAudioStream();
        }
        
        console.log('✅ 系统音频已启用');
      } catch (error) {
        console.error('❌ 启用系统音频失败:', error);
        throw error;
      }
    } else if (!enabled && this.systemAudioSource.isActive) {
      if (this.systemAudioSource.stream) {
        this.systemAudioSource.stream.getTracks().forEach(track => track.stop());
        this.systemAudioSource.stream = null;
      }
      this.systemAudioSource.isActive = false;
      
      // 如果正在录制，重新创建组合流
      if (this.isRecording) {
        await this.createCombinedAudioStream();
      }
      
      console.log('⏸️ 系统音频已禁用');
    }

    // 发出音频源变更事件
    this.emitEvent('audio_source_changed', {
      microphone: this.microphoneSource,
      systemAudio: this.systemAudioSource
    });
  }
}