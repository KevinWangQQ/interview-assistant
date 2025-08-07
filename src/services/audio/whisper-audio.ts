// Whisper音频服务实现

import { IAudioService, RecordingOptions, TranscriptionOptions } from '../interfaces';
import { TranscriptionResult } from '@/types';
import { apiKeyManager } from '@/lib/api-key-manager';

export class WhisperAudioService implements IAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private isCurrentlyRecording = false;
  private isCurrentlyPaused = false;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  
  // 新增：增量式音频处理
  private processingTimer: NodeJS.Timeout | null = null;
  private lastProcessTime: number = 0;
  private lastProcessedChunkCount: number = 0; // 跟踪已处理的块数
  private readonly PROCESSING_INTERVAL = 3000; // 3秒处理一次
  private readonly MIN_CHUNK_SIZE = 8000; // 最小处理块大小

  // 事件回调
  private onStartCallback?: () => void;
  private onStopCallback?: () => void;
  private onErrorCallback?: (error: Error) => void;
  private onDataCallbacks: ((audioBlob: Blob, metadata?: any) => void)[] = [];

  async startRecording(options?: RecordingOptions): Promise<MediaStream> {
    try {
      if (this.isCurrentlyRecording) {
        throw new Error('Recording is already in progress');
      }

      // 请求麦克风权限
      const constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: options?.sampleRate || 44100,
          channelCount: options?.channels || 1,
          echoCancellation: options?.echoCancellation ?? true,
          noiseSuppression: options?.noiseSuppression ?? true,
          autoGainControl: options?.autoGainControl ?? true,
        }
      };

      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // 创建MediaRecorder
      const mimeType = this.getSupportedMimeType();
      const mediaRecorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 64000  // 降低比特率提高兼容性
      };
      
      // 只有在有有效mimeType时才添加
      if (mimeType) {
        mediaRecorderOptions.mimeType = mimeType;
      }
      
      console.log('创建MediaRecorder，配置:', mediaRecorderOptions);
      this.mediaRecorder = new MediaRecorder(this.audioStream, mediaRecorderOptions);

      // 重置记录状态
      this.recordedChunks = [];
      this.isCurrentlyRecording = true;
      this.isCurrentlyPaused = false;
      this.startTime = Date.now();
      this.pausedDuration = 0;

      // 设置事件处理器 - 仅收集音频数据，不立即处理
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log('收到音频数据块:', event.data.size, 'bytes, 总块数:', this.recordedChunks.length);
          
          // 不在这里立即处理，而是让定时器处理增量数据
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('录音开始');
        this.onStartCallback?.();
        // 启动定时处理机制
        this.startProcessingTimer();
      };

      this.mediaRecorder.onstop = () => {
        console.log('录音停止');
        this.stopProcessingTimer();
        this.onStopCallback?.();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('录音错误:', event.error);
        this.stopProcessingTimer();
        const error = new Error(`MediaRecorder error: ${event.error}`);
        this.onErrorCallback?.(error);
      };

      // 开始录制，定时生成数据块用于处理（但保持连续录制状态）
      this.mediaRecorder.start(this.PROCESSING_INTERVAL);

      return this.audioStream;
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isCurrentlyRecording) {
      return;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        this.cleanup();
        resolve();
      };
      
      this.mediaRecorder!.stop();
      this.isCurrentlyRecording = false;
      this.isCurrentlyPaused = false;
    });
  }

  async pauseRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isCurrentlyRecording || this.isCurrentlyPaused) {
      return;
    }

    this.mediaRecorder.pause();
    this.isCurrentlyPaused = true;
    this.pauseStartTime = Date.now();
  }

  async resumeRecording(): Promise<void> {
    if (!this.mediaRecorder || !this.isCurrentlyRecording || !this.isCurrentlyPaused) {
      return;
    }

    this.mediaRecorder.resume();
    this.isCurrentlyPaused = false;
    this.pausedDuration += Date.now() - this.pauseStartTime;
  }

  async transcribe(audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    const transcribeId = Date.now();
    
    try {
      console.log(`[${transcribeId}] 开始转录音频，原始音频大小:`, audioBlob.size, '类型:', audioBlob.type);
      
      // 检查音频大小是否合理
      if (audioBlob.size < 1000) { // 提高最小阈值到1KB
        console.warn(`[${transcribeId}] 音频太小 (${audioBlob.size} bytes)，跳过转录`);
        return { text: '', confidence: 0 };
      }
      
      if (audioBlob.size > 25 * 1024 * 1024) { // 25MB限制
        console.warn(`[${transcribeId}] 音频太大 (${audioBlob.size} bytes)，可能会失败`);
      }
      
      // 检查音频数据完整性
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error('音频数据为空的ArrayBuffer');
        }
        
        // 检查音频数据头部（简单验证）
        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 8));
        console.log(`[${transcribeId}] 音频数据头部:`, Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        // 重新创建Blob确保数据完整性
        audioBlob = new Blob([arrayBuffer], { type: audioBlob.type });
        console.log(`[${transcribeId}] 重建音频Blob完成，大小:`, audioBlob.size);
      } catch (error) {
        console.error(`[${transcribeId}] 音频数据完整性检查失败:`, error);
        throw new Error(`音频数据损坏: ${error instanceof Error ? error.message : '未知错误'}`);
      }
      
      // 检查API密钥
      const apiKey = this.getApiKey();
      console.log(`[${transcribeId}] API密钥状态:`, apiKey ? `有效 (前6位: ${apiKey.substring(0, 6)}...)` : '未找到');
      
      // 根据实际MIME类型确定文件格式
      console.log(`[${transcribeId}] 原始音频格式:`, audioBlob.type, '大小:', audioBlob.size);
      
      let fileName = `audio_${transcribeId}`;
      let audioToSend = audioBlob;
      
      // 🎯 Whisper API格式兼容性修复
      const mimeType = audioBlob.type.toLowerCase();
      
      // Whisper支持的格式映射表
      const whisperFormatMap = {
        'audio/webm': { ext: '.webm', mime: 'audio/webm' },
        'webm': { ext: '.webm', mime: 'audio/webm' },
        'audio/ogg': { ext: '.ogg', mime: 'audio/ogg' },
        'ogg': { ext: '.ogg', mime: 'audio/ogg' },
        'audio/wav': { ext: '.wav', mime: 'audio/wav' },
        'wav': { ext: '.wav', mime: 'audio/wav' },
        'audio/mp3': { ext: '.mp3', mime: 'audio/mp3' },
        'mp3': { ext: '.mp3', mime: 'audio/mp3' },
        'audio/mp4': { ext: '.mp4', mime: 'audio/mp4' },
        'mp4': { ext: '.mp4', mime: 'audio/mp4' },
        'audio/m4a': { ext: '.m4a', mime: 'audio/m4a' },
        'm4a': { ext: '.m4a', mime: 'audio/m4a' }
      };
      
      // 查找匹配的格式
      let formatInfo = null;
      for (const [key, info] of Object.entries(whisperFormatMap)) {
        if (mimeType.includes(key)) {
          formatInfo = info;
          break;
        }
      }
      
      // 如果没找到匹配格式，默认使用WebM
      if (!formatInfo) {
        console.warn(`[${transcribeId}] 未知音频格式 ${mimeType}，默认使用WebM`);
        formatInfo = { ext: '.webm', mime: 'audio/webm' };
      }
      
      fileName += formatInfo.ext;
      
      // 确保Blob有正确的MIME类型
      if (!audioBlob.type || audioBlob.type !== formatInfo.mime) {
        console.log(`[${transcribeId}] 修正MIME类型: ${audioBlob.type} -> ${formatInfo.mime}`);
        audioToSend = new Blob([audioBlob], { type: formatInfo.mime });
      }
      
      // 验证音频数据
      if (!audioToSend || audioToSend.size === 0) {
        throw new Error('音频数据为空');
      }
      
      console.log(`[${transcribeId}] 最终发送数据:`, {
        fileName,
        originalMimeType: audioBlob.type,
        finalMimeType: audioToSend.type,
        size: audioToSend.size,
        formatInfo: formatInfo
      });
      
      
      // 🎯 优化的Whisper API调用 - 减少重复生成
      const formData = new FormData();
      formData.append('file', audioToSend, fileName);
      formData.append('model', options?.model || 'whisper-1');
      
      // 使用verbose_json格式获取更多置信度信息
      formData.append('response_format', 'verbose_json');
      
      if (options?.language) {
        formData.append('language', options.language);
        console.log(`[${transcribeId}] 设置语言:`, options.language);
      }
      
      // 智能prompt：包含去重指导和上下文
      const optimizedPrompt = this.buildAntiRepetitionPrompt(options?.prompt);
      if (optimizedPrompt) {
        formData.append('prompt', optimizedPrompt);
        console.log(`[${transcribeId}] 设置优化提示词:`, optimizedPrompt);
      }

      // 🔧 优化温度参数：使用0.0完全确定性，减少随机重复
      const optimizedTemperature = 0.0; // 降低到0，完全确定性
      formData.append('temperature', optimizedTemperature.toString());
      console.log(`[${transcribeId}] 设置优化温度:`, optimizedTemperature);

      console.log(`[${transcribeId}] 发送Whisper API请求...`);
      
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // 不要手动设置Content-Type，让浏览器自动设置multipart/form-data边界
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`[${transcribeId}] Whisper API响应:`, response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${transcribeId}] API错误:`, errorText);
        throw new Error(`API错误 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log(`[${transcribeId}] 转录结果:`, result);
      
      // 🔍 基于verbose_json格式解析增强结果
      const enhancedResult = this.parseVerboseTranscriptionResult(result);
      console.log(`[${transcribeId}] 增强解析结果:`, enhancedResult);
      
      return enhancedResult;
    } catch (error) {
      console.error(`[${transcribeId}] 转录详细错误:`, error);
      
      // 根据错误类型提供更有用的错误信息
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`转录超时，请尝试较短的音频片段`);
        } else if (error.message.includes('API调用频率限制')) {
          throw error; // 保持原始错误信息
        }
      }
      
      throw new Error(`转录失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  isRecording(): boolean {
    return this.isCurrentlyRecording;
  }

  isPaused(): boolean {
    return this.isCurrentlyPaused;
  }

  getRecordingDuration(): number {
    if (!this.isCurrentlyRecording) {
      return 0;
    }

    const currentTime = Date.now();
    const totalTime = currentTime - this.startTime;
    const adjustedPausedDuration = this.isCurrentlyPaused 
      ? this.pausedDuration + (currentTime - this.pauseStartTime)
      : this.pausedDuration;
    
    return Math.max(0, totalTime - adjustedPausedDuration);
  }

  async convertAudioFormat(audioBlob: Blob, targetFormat: 'wav' | 'mp3' | 'webm'): Promise<Blob> {
    if (targetFormat === 'wav') {
      return this.convertToWav(audioBlob);
    }
    
    // 其他格式转换需要更复杂的实现，MVP版本暂不支持
    throw new Error(`Format conversion to ${targetFormat} not supported in MVP`);
  }

  onRecordingStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onRecordingStop(callback: () => void): void {
    this.onStopCallback = callback;
  }

  onRecordingError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  // 设置数据回调
  onDataAvailable(callback: (audioBlob: Blob, metadata?: any) => void): void {
    this.onDataCallbacks.push(callback);
  }

  offDataAvailable(callback: (audioBlob: Blob, metadata?: any) => void): void {
    const index = this.onDataCallbacks.indexOf(callback);
    if (index > -1) {
      this.onDataCallbacks.splice(index, 1);
    }
  }

  private notifyDataAvailable(audioBlob: Blob, metadata?: any): void {
    this.onDataCallbacks.forEach(callback => {
      try {
        callback(audioBlob, metadata);
      } catch (error) {
        console.error('音频数据回调执行失败:', error);
      }
    });
  }

  // 新增：定时处理机制
  private startProcessingTimer(): void {
    this.stopProcessingTimer(); // 确保只有一个定时器
    
    this.processingTimer = setInterval(() => {
      this.processAccumulatedAudio();
    }, this.PROCESSING_INTERVAL);
    
    console.log(`启动音频处理定时器，间隔: ${this.PROCESSING_INTERVAL}ms`);
  }

  private stopProcessingTimer(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      console.log('停止音频处理定时器');
    }
  }

  private processAccumulatedAudio(): void {
    if (!this.isCurrentlyRecording || this.recordedChunks.length <= this.lastProcessedChunkCount) {
      console.log('无新音频数据，跳过处理');
      return;
    }

    // 计算新增的音频数据
    const newChunks = this.recordedChunks.slice(this.lastProcessedChunkCount);
    const newAudioSize = newChunks.reduce((total, chunk) => total + chunk.size, 0);

    if (newAudioSize < this.MIN_CHUNK_SIZE) {
      console.log(`新音频数据太小 (${newAudioSize} bytes)，等待更多数据`);
      return;
    }

    console.log(`处理增量音频数据: ${newChunks.length} 新块, ${newAudioSize} bytes`);

    // 创建包含所有累积数据的音频文件（用于获得完整上下文）
    const completeAudio = new Blob(this.recordedChunks, { 
      type: this.mediaRecorder?.mimeType || 'audio/webm' 
    });

    console.log('发送增量音频处理:', {
      newChunks: newChunks.length,
      totalChunks: this.recordedChunks.length,
      newSize: newAudioSize,
      totalSize: completeAudio.size,
      mimeType: completeAudio.type
    });

    // 更新已处理计数
    this.lastProcessedChunkCount = this.recordedChunks.length;
    this.lastProcessTime = Date.now();

    // 通知监听器处理音频（带有增量标记）
    this.notifyDataAvailable(completeAudio, {
      isIncremental: true,
      newChunksCount: newChunks.length,
      totalChunksCount: this.recordedChunks.length
    });
  }

  // 私有方法
  private getSupportedMimeType(): string {
    // 优先选择Whisper API明确支持的格式
    const types = [
      'audio/webm',             // WebM是Whisper明确支持的
      'audio/mp4',              // MP4也明确支持
      'audio/wav',              // WAV格式支持
      'audio/ogg',              // OGG格式支持
      'audio/webm;codecs=opus', // 带编解码器的WebM
      'audio/ogg;codecs=opus',  // 带编解码器的OGG
    ];

    console.log('检查支持的音频格式:');
    for (const type of types) {
      const isSupported = MediaRecorder.isTypeSupported(type);
      console.log(`  ${type}: ${isSupported ? '✅' : '❌'}`);
      if (isSupported) {
        console.log('选择音频格式:', type);
        return type;
      }
    }

    // 如果都不支持，让浏览器选择默认格式
    console.warn('使用浏览器默认音频格式');
    return '';
  }

  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
      console.log('开始WAV转换，原始格式:', audioBlob.type, '大小:', audioBlob.size);
      
      // 如果已经是WAV格式，直接返回
      if (audioBlob.type === 'audio/wav') {
        console.log('已经是WAV格式，直接返回');
        return audioBlob;
      }
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('ArrayBuffer大小:', arrayBuffer.byteLength);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('音频上下文创建成功，采样率:', audioContext.sampleRate);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('音频解码成功 - 时长:', audioBuffer.duration, '采样率:', audioBuffer.sampleRate, '声道数:', audioBuffer.numberOfChannels);
      
      // 检查音频是否有有效数据
      if (audioBuffer.duration === 0) {
        throw new Error('音频时长为0，无有效数据');
      }
      
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      console.log('WAV编码完成，大小:', wavBuffer.byteLength);
      
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      console.error('WAV转换失败，详细错误:', error);
      
      // 尝试直接使用原始音频（可能是MP3或其他格式）
      if (audioBlob.type.startsWith('audio/')) {
        console.log('尝试直接使用原始音频格式:', audioBlob.type);
        return audioBlob;
      }
      
      // 如果完全无法处理，创建一个有效的空WAV文件
      console.warn('创建空WAV文件作为回退');
      return this.createEmptyWav();
    }
  }

  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV头部
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // 音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return arrayBuffer;
  }

  private getApiKey(): string {
    return apiKeyManager.getOpenAIApiKey();
  }

  private createEmptyWav(): Blob {
    // 创建一个1秒的空WAV文件
    const sampleRate = 44100;
    const duration = 1; // 1秒
    const length = sampleRate * duration;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);

    // WAV头部
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); // 单声道
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // 静音数据（全部为0）
    for (let i = 44; i < arrayBuffer.byteLength; i += 2) {
      view.setInt16(i, 0, true);
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  // 🧠 构建反重复的智能提示词
  private buildAntiRepetitionPrompt(originalPrompt?: string): string {
    const prompt = originalPrompt || '';
    
    // 添加反重复指导
    const antiRepetitionGuidance = [
      'Professional interview conversation.',
      'Avoid repeating phrases or words unnecessarily.',
      'Focus on clear, concise speech transcription.',
      'Technical interview context.'
    ].join(' ');
    
    // 合并原始prompt和反重复指导
    if (prompt) {
      return `${prompt} ${antiRepetitionGuidance}`;
    } else {
      return antiRepetitionGuidance;
    }
  }

  // 📊 解析verbose_json格式的转录结果
  private parseVerboseTranscriptionResult(result: any): TranscriptionResult {
    if (!result) {
      return { text: '', confidence: 0 };
    }
    
    const text = result.text || '';
    
    // 🚨 首先检测幻觉内容
    if (this.isHallucinationContent(text)) {
      console.log(`🚫 Whisper返回幻觉内容，直接过滤: "${text}"`);
      return { text: '', confidence: 0 };
    }
    
    let confidence = 0.9; // 默认置信度
    
    // 从segments中计算平均置信度
    if (result.segments && Array.isArray(result.segments) && result.segments.length > 0) {
      const validSegments = result.segments.filter((seg: any) => 
        seg && typeof seg.avg_logprob === 'number'
      );
      
      if (validSegments.length > 0) {
        // 使用avg_logprob计算置信度（范围通常是-1到0）
        const avgLogProb = validSegments.reduce((sum: number, seg: any) => 
          sum + seg.avg_logprob, 0) / validSegments.length;
        
        // 转换logprob到0-1范围的置信度
        confidence = Math.max(0, Math.min(1, Math.exp(avgLogProb)));
        
        console.log(`📊 计算得出置信度: ${confidence.toFixed(3)} (基于${validSegments.length}个片段)`);
        
        // 过滤低置信度片段的文本
        if (confidence < 0.3) {
          console.log('⚠️ 低置信度转录，可能包含幻觉内容');
          
          // 检查是否有明显的重复模式
          const words = text.split(/\s+/);
          const uniqueWords = new Set(words.filter((w: string) => w.length > 2));
          const repetitionRatio = 1 - (uniqueWords.size / words.length);
          
          if (repetitionRatio > 0.4) {
            console.log(`🚫 检测到高重复比例(${Math.round(repetitionRatio*100)}%)，返回空结果`);
            return { text: '', confidence: 0 };
          }
        }
      }
    }
    
    // 额外的重复检测和清理
    const cleanedText = this.cleanTranscriptionWithConfidence(text, confidence);
    
    return {
      text: cleanedText,
      confidence,
      segments: result.segments || undefined
    };
  }

  // 🧹 基于置信度的转录清理
  private cleanTranscriptionWithConfidence(text: string, confidence: number): string {
    if (!text || !text.trim()) return '';
    
    let cleaned = text.trim();
    
    // 低置信度时进行更严格的清理
    if (confidence < 0.5) {
      console.log(`🔍 低置信度(${confidence.toFixed(3)})，应用严格清理`);
      
      // 移除明显的重复短语
      cleaned = cleaned.replace(/\b([^.!?]{1,20}[.!?])\s*\1{2,}/gi, '$1');
      
      // 移除过多的填充词
      cleaned = cleaned.replace(/\b(um|uh|er|ah|like|you know)\b\s*/gi, '');
      
      // 检查整体重复模式
      const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim());
      if (sentences.length > 2) {
        const uniqueSentences = [...new Set(sentences.map(s => s.trim().toLowerCase()))];
        if (uniqueSentences.length < sentences.length * 0.7) {
          console.log('🚫 检测到句子级重复，进行去重');
          cleaned = uniqueSentences.join('. ') + '.';
        }
      }
    }
    
    return cleaned;
  }

  // 🚨 检测Whisper API幻觉内容 (与enhanced-wav-streaming同步)
  private isHallucinationContent(text: string): boolean {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) return false;
      
      const cleaned = text.toLowerCase().trim();
      
      // 1. 检测典型的广告/推广内容
      const advertisingPatterns = [
        /learn english/i,
        /www\./i,
        /\.com/i,
        /\.org/i,
        /\.net/i,
        /for free/i,
        /visit/i,
        /website/i,
        /transcripts? provided by/i,
        /outsourcing/i,
        /clear,? concise speech/i,
        /without repetition/i,
        /engvid/i
      ];
      
      // 2. 检测过度重复的短语模式
      const repetitivePatterns = [
        /\b(\w+)\s+\1\s+\1\b/i,                    // 三连重复词汇
        /\b([^.!?]{1,20})\s*\.\s*\1\s*\.\s*\1/i,  // 重复短句
        /(clear,?\s*concise)/i,                    // Whisper常见幻觉短语
        /(hello,?\s*hello)/i                       // 重复问候
      ];
      
      // 3. 检测典型的Whisper幻觉句式
      const hallucinationPhrases = [
        'thank you for watching',
        'subscribe to',
        'like and subscribe',
        'don\'t forget to',
        'see you next time',
        'bye bye',
        'transcription outsourcing',
        'provided by',
        'learn english for free',
        'clear concise speech',
        'without repetition'
      ];
      
      // 检查广告模式
      for (const pattern of advertisingPatterns) {
        if (pattern.test(cleaned)) {
          console.log(`🚫 检测到广告模式: ${pattern} 在 "${text}"`);
          return true;
        }
      }
      
      // 检查重复模式
      for (const pattern of repetitivePatterns) {
        if (pattern.test(cleaned)) {
          console.log(`🚫 检测到重复模式: ${pattern} 在 "${text}"`);
          return true;
        }
      }
      
      // 检查幻觉短语
      for (const phrase of hallucinationPhrases) {
        if (cleaned.includes(phrase)) {
          console.log(`🚫 检测到幻觉短语: "${phrase}" 在 "${text}"`);
          return true;
        }
      }
      
      // 4. 检查不合理的重复率
      const words = cleaned.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 5) {
        const uniqueWords = new Set(words);
        const repetitionRatio = 1 - (uniqueWords.size / words.length);
        
        if (repetitionRatio > 0.6) {
          console.log(`🚫 检测到过高重复率: ${Math.round(repetitionRatio * 100)}% 在 "${text}"`);
          return true;
        }
      }
      
      // 5. 检查URL和网站相关内容
      if (/\b(www\.|http|\.com|\.org|\.net)\b/i.test(cleaned)) {
        console.log(`🚫 检测到网址相关内容: "${text}"`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('幻觉内容检测出错:', error);
      return false; // 出错时保守处理，不过滤内容
    }
  }

  private cleanup(): void {
    console.log('清理音频资源...');
    
    // 停止定时器
    this.stopProcessingTimer();
    
    // 停止所有音轨
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => {
        track.stop();
        console.log('停止音轨:', track.kind, track.label);
      });
      this.audioStream = null;
    }
    
    // 清理MediaRecorder
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstart = null;
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.onerror = null;
      this.mediaRecorder = null;
    }
    
    // 重置状态
    this.isCurrentlyRecording = false;
    this.isCurrentlyPaused = false;
    this.recordedChunks = [];
    this.startTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
    this.lastProcessTime = 0;
    this.lastProcessedChunkCount = 0;
    
    // 清理回调数组（但不清理回调本身，让外界自己管理）
    // this.onDataCallbacks = [];
    
    console.log('音频资源清理完成');
  }

  // 获取录制的音频数据
  getRecordedAudio(): Blob | null {
    if (this.recordedChunks.length === 0) {
      return null;
    }

    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    return new Blob(this.recordedChunks, { type: mimeType });
  }
}