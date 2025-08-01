// Whisper音频服务实现

import { IAudioService, RecordingOptions, TranscriptionOptions } from '../interfaces';
import { TranscriptionResult } from '@/types';

export class WhisperAudioService implements IAudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private isCurrentlyRecording = false;
  private isCurrentlyPaused = false;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;

  // 事件回调
  private onStartCallback?: () => void;
  private onStopCallback?: () => void;
  private onErrorCallback?: (error: Error) => void;
  private onDataCallback?: (audioBlob: Blob) => void;

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

      // 设置事件处理器
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          // 回调给外部处理器
          this.onDataCallback?.(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('录音开始');
        this.onStartCallback?.();
      };

      this.mediaRecorder.onstop = () => {
        console.log('录音停止');
        this.onStopCallback?.();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('录音错误:', event.error);
        const error = new Error(`MediaRecorder error: ${event.error}`);
        this.onErrorCallback?.(error);
      };

      // 开始录音，每5秒生成一个数据块（减少API调用频率）
      this.mediaRecorder.start(5000);

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
      
      // 检查API密钥
      const apiKey = this.getApiKey();
      console.log(`[${transcribeId}] API密钥状态:`, apiKey ? `有效 (前6位: ${apiKey.substring(0, 6)}...)` : '未找到');
      
      // 直接使用原始音频格式，让Whisper API处理格式转换
      console.log(`[${transcribeId}] 直接使用原始音频格式:`, audioBlob.type);
      
      // 根据音频类型确定文件扩展名 - 直接使用原始格式
      let fileName = `audio_${transcribeId}`;
      const audioToSend = audioBlob; // 始终使用原始音频
      
      // 根据MIME类型确定扩展名
      if (audioBlob.type.includes('webm')) {
        fileName += '.webm';
      } else if (audioBlob.type.includes('mp4')) {
        fileName += '.mp4';  
      } else if (audioBlob.type.includes('wav')) {
        fileName += '.wav';
      } else if (audioBlob.type.includes('ogg')) {
        fileName += '.ogg';
      } else if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
        fileName += '.mp3';
      } else {
        // 对于未知类型，使用通用扩展名但不转换格式
        console.log(`[${transcribeId}] 未知音频类型 (${audioBlob.type})，使用原始格式`);
        fileName += '.webm'; // 默认扩展名，但仍使用原始数据
      }
      
      // 验证音频数据
      if (!audioToSend || audioToSend.size === 0) {
        throw new Error('音频数据为空');
      }
      
      console.log(`[${transcribeId}] 发送音频文件:`, fileName, '大小:', audioToSend.size, '类型:', audioToSend.type);
      
      // 调用Whisper API
      const formData = new FormData();
      formData.append('file', audioToSend, fileName);
      formData.append('model', options?.model || 'whisper-1');
      
      if (options?.language) {
        formData.append('language', options.language);
        console.log(`[${transcribeId}] 设置语言:`, options.language);
      }
      
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
        console.log(`[${transcribeId}] 设置提示词:`, options.prompt);
      }

      if (options?.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
        console.log(`[${transcribeId}] 设置温度:`, options.temperature);
      }

      console.log(`[${transcribeId}] 发送Whisper API请求...`);
      
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`[${transcribeId}] Whisper API响应状态:`, response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${transcribeId}] Whisper API错误响应:`, errorText);
        
        // 针对不同错误码的处理
        if (response.status === 429) {
          throw new Error(`API调用频率限制，请稍后重试`);
        } else if (response.status === 400) {
          throw new Error(`音频格式或参数错误: ${errorText}`);
        } else if (response.status === 401) {
          throw new Error(`API密钥无效，请检查设置`);
        } else {
          throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }

      const result = await response.json();
      console.log(`[${transcribeId}] 转录结果:`, result);
      
      return {
        text: result.text || '',
        confidence: 0.9, // Whisper不提供置信度，使用默认值
        segments: result.segments || undefined
      };
    } catch (error) {
      console.error(`[${transcribeId}] 转录详细错误:`, error);
      
      // 根据错误类型提供更有用的错误信息
      if (error.name === 'AbortError') {
        throw new Error(`转录超时，请尝试较短的音频片段`);
      } else if (error.message.includes('API调用频率限制')) {
        throw error; // 保持原始错误信息
      } else {
        throw new Error(`转录失败: ${error.message}`);
      }
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
  onDataAvailable(callback: (audioBlob: Blob) => void): void {
    this.onDataCallback = callback;
  }

  // 私有方法
  private getSupportedMimeType(): string {
    // 简化格式选择，优先选择最兼容的格式
    const types = [
      'audio/webm;codecs=opus', // 大多数现代浏览器支持
      'audio/webm',             // 基本WebM
      'audio/mp4',              // MP4格式
      'audio/ogg;codecs=opus',  // OGG格式
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
    // 从环境变量或配置中获取API密钥
    let apiKey: string | null = null;
    
    // 优先从环境变量获取
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENAI_API_KEY) {
      apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      console.log('从环境变量获取API密钥');
    }
    
    // 其次从localStorage获取
    if (!apiKey && typeof window !== 'undefined') {
      apiKey = localStorage.getItem('openai_api_key');
      if (apiKey) {
        console.log('从localStorage获取API密钥');
      }
    }
    
    // 最后从应用配置获取
    if (!apiKey && typeof window !== 'undefined') {
      const configStr = localStorage.getItem('interview-assistant-config');
      if (configStr) {
        try {
          const config = JSON.parse(configStr);
          apiKey = config.openaiApiKey;
          if (apiKey) {
            console.log('从应用配置获取API密钥');
          }
        } catch (e) {
          console.warn('解析应用配置失败:', e);
        }
      }
    }
    
    if (!apiKey || apiKey.trim() === '') {
      const errorMsg = 'OpenAI API key not found. Please set it in Settings page or save it in localStorage as "openai_api_key".';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    return apiKey.trim();
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

  private cleanup(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.mediaRecorder = null;
    this.isCurrentlyRecording = false;
    this.isCurrentlyPaused = false;
    this.recordedChunks = [];
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