// 🎵 WAV格式流式转录服务 - 强制使用WAV格式确保Whisper兼容性
// 专门解决音频格式兼容问题

interface WAVStreamingConfig {
  chunkInterval: number;
  translationDelay: number;
}

type WAVEventType = 'transcription_update' | 'translation_update' | 'error';

interface WAVEvent {
  type: WAVEventType;
  data: any;
  timestamp: number;
}

export class WAVStreamingTranscriptionService {
  private config: WAVStreamingConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  
  // 简化状态
  private currentText = '';
  private isRecording = false;
  private audioChunks: Float32Array[] = [];
  
  // 事件系统
  private eventListeners: Map<WAVEventType, Set<(event: WAVEvent) => void>> = new Map();
  
  // 定时器
  private recordTimer: NodeJS.Timeout | null = null;
  private translationTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WAVStreamingConfig> = {}) {
    this.config = {
      chunkInterval: 3000,
      translationDelay: 1000,
      ...config
    };
    
    this.initializeEventMaps();
  }

  private initializeEventMaps() {
    const eventTypes: WAVEventType[] = ['transcription_update', 'translation_update', 'error'];
    eventTypes.forEach(type => {
      this.eventListeners.set(type, new Set());
    });
  }

  // 🎤 开始录音 - 使用AudioContext直接录制PCM数据
  async startStreaming(): Promise<void> {
    try {
      console.log('🎵 启动WAV格式流式转录服务');
      
      // 获取音频流
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,      // Whisper推荐采样率
          channelCount: 1,        // 单声道
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 初始化AudioContext进行PCM录制
      await this.initializeAudioContext();
      
      this.isRecording = true;
      this.startRecordingLoop();
      
      console.log('✅ WAV格式流式转录服务启动成功');
    } catch (error) {
      this.emitEvent('error', { error, message: '启动WAV流式转录失败' });
      throw error;
    }
  }

  // 🎧 初始化AudioContext - 直接录制PCM数据
  private async initializeAudioContext(): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 16000  // 强制16kHz采样率
    });
    
    const source = this.audioContext.createMediaStreamSource(this.audioStream!);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    // 收集PCM音频数据
    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // 复制音频数据
      const audioData = new Float32Array(inputData.length);
      audioData.set(inputData);
      this.audioChunks.push(audioData);
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    console.log('🎧 AudioContext初始化完成，采样率:', this.audioContext.sampleRate);
  }

  // 🔄 定时录音循环
  private startRecordingLoop(): void {
    this.recordTimer = setInterval(async () => {
      try {
        await this.processAudioChunks();
      } catch (error) {
        console.error('❌ WAV录音循环错误:', error);
        this.emitEvent('error', { error, message: 'WAV录音处理错误' });
      }
    }, this.config.chunkInterval);
  }

  // 📝 处理音频块 - 转换为WAV格式
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) {
      console.log('⚠️ 没有PCM音频数据可处理');
      return;
    }

    try {
      // 合并PCM数据
      const pcmData = this.mergePCMChunks();
      
      // 转换为WAV格式
      const wavBlob = this.createWAVBlob(pcmData, 16000, 1);
      
      // 重置音频块
      this.audioChunks = [];
      
      console.log('🎵 WAV音频数据准备完成:', {
        size: wavBlob.size,
        type: wavBlob.type,
        sampleCount: pcmData.length
      });

      // 转录音频
      const transcriptionResult = await this.transcribeAudio(wavBlob);
      
      if (transcriptionResult.text && transcriptionResult.text.trim()) {
        const newText = transcriptionResult.text.trim();
        this.currentText = this.currentText ? 
          this.currentText + ' ' + newText : newText;
        
        console.log('📝 WAV转录更新:', this.currentText);
        
        this.emitEvent('transcription_update', {
          text: this.currentText,
          confidence: transcriptionResult.confidence || 0.9,
          timestamp: Date.now()
        });
        
        this.scheduleTranslation();
      }
      
    } catch (error) {
      console.error('❌ WAV音频处理失败:', error);
      this.emitEvent('error', { 
        error, 
        message: `WAV处理失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    }
  }

  // 🔀 合并PCM数据
  private mergePCMChunks(): Float32Array {
    if (this.audioChunks.length === 0) {
      throw new Error('没有PCM数据可合并');
    }

    // 计算总长度
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    
    // 创建合并数组
    const mergedData = new Float32Array(totalLength);
    let offset = 0;
    
    for (const chunk of this.audioChunks) {
      mergedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    console.log('🔀 PCM数据合并完成:', {
      chunks: this.audioChunks.length,
      totalSamples: totalLength,
      durationSeconds: totalLength / 16000
    });
    
    return mergedData;
  }

  // 🎵 创建WAV格式Blob
  private createWAVBlob(pcmData: Float32Array, sampleRate: number, channels: number): Blob {
    const length = pcmData.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);  // ChunkSize
    writeString(8, 'WAVE');
    
    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);              // Subchunk1Size (PCM)
    view.setUint16(20, 1, true);               // AudioFormat (PCM)
    view.setUint16(22, channels, true);        // NumChannels
    view.setUint32(24, sampleRate, true);      // SampleRate
    view.setUint32(28, sampleRate * channels * 2, true); // ByteRate
    view.setUint16(32, channels * 2, true);    // BlockAlign
    view.setUint16(34, 16, true);              // BitsPerSample
    
    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);      // Subchunk2Size
    
    // 写入PCM数据 (转换Float32到Int16)
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, pcmData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // 🗣️ 转录音频
  private async transcribeAudio(audioBlob: Blob): Promise<any> {
    const { getAudioService } = await import('@/services');
    const audioService = getAudioService();
    
    console.log('🗣️ 开始WAV音频转录:', {
      size: audioBlob.size,
      type: audioBlob.type,
      isWAV: audioBlob.type === 'audio/wav'
    });
    
    return await audioService.transcribe(audioBlob, {
      language: 'en',
      temperature: 0.2
    });
  }

  // 🌍 调度翻译
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

  // 🌐 翻译文本
  private async translateText(): Promise<void> {
    try {
      const { getTranslationService } = await import('@/services');
      const translationService = getTranslationService();
      
      console.log('🌐 开始翻译WAV转录结果:', this.currentText.substring(0, 50) + '...');
      
      const result = await translationService.translate(
        this.currentText,
        'en',
        'zh'
      );
      
      console.log('🌍 WAV转录翻译完成:', result.translatedText);
      
      this.emitEvent('translation_update', {
        text: this.currentText,
        translation: result.translatedText,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ WAV转录翻译失败:', error);
      this.emitEvent('error', { 
        error, 
        message: `翻译失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    }
  }

  // 🛑 停止服务
  async stopStreaming(): Promise<void> {
    console.log('🛑 停止WAV流式转录服务');
    
    this.isRecording = false;
    
    // 清理定时器
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    
    if (this.translationTimer) {
      clearTimeout(this.translationTimer);
      this.translationTimer = null;
    }
    
    // 清理音频资源
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    // 重置状态
    this.currentText = '';
    this.audioChunks = [];
    
    console.log('✅ WAV流式转录服务已停止');
  }

  // 📡 事件系统
  addEventListener(type: WAVEventType, listener: (event: WAVEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.add(listener);
    }
  }

  removeEventListener(type: WAVEventType, listener: (event: WAVEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emitEvent(type: WAVEventType, data: any): void {
    const event: WAVEvent = {
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
          console.error(`❌ WAV事件监听器错误 [${type}]:`, error);
        }
      });
    }
  }

  // 📈 获取状态
  getStatus() {
    return {
      isRecording: this.isRecording,
      currentText: this.currentText,
      audioChunksCount: this.audioChunks.length,
      config: this.config
    };
  }
}