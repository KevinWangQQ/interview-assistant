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
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

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

      // 开始录音，每3秒生成一个数据块
      this.mediaRecorder.start(3000);

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
    try {
      console.log('开始转录音频，原始音频大小:', audioBlob.size, '类型:', audioBlob.type);
      
      // 检查API密钥
      const apiKey = this.getApiKey();
      console.log('API密钥状态:', apiKey ? `有效 (前6位: ${apiKey.substring(0, 6)}...)` : '未找到');
      
      // 将音频转换为WAV格式（Whisper API要求）
      console.log('开始转换音频格式为WAV...');
      const wavBlob = await this.convertToWav(audioBlob);
      console.log('WAV转换完成，大小:', wavBlob.size, '类型:', wavBlob.type);
      
      // 调用Whisper API
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      formData.append('model', options?.model || 'whisper-1');
      
      if (options?.language) {
        formData.append('language', options.language);
        console.log('设置语言:', options.language);
      }
      
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
        console.log('设置提示词:', options.prompt);
      }

      if (options?.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
        console.log('设置温度:', options.temperature);
      }

      console.log('发送Whisper API请求...');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      console.log('Whisper API响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API错误响应:', errorText);
        throw new Error(`Whisper API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('转录结果:', result);
      
      return {
        text: result.text || '',
        confidence: 0.9, // Whisper不提供置信度，使用默认值
        segments: result.segments || undefined
      };
    } catch (error) {
      console.error('转录详细错误:', error);
      throw new Error(`Transcription failed: ${error}`);
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
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error('No supported audio MIME type found');
  }

  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    // 简单的WAV转换实现
    // 在生产环境中，建议使用专业的音频处理库
    try {
      console.log('开始WAV转换，原始格式:', audioBlob.type, '大小:', audioBlob.size);
      
      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('ArrayBuffer大小:', arrayBuffer.byteLength);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('音频上下文创建成功，采样率:', audioContext.sampleRate);
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('音频解码成功 - 时长:', audioBuffer.duration, '采样率:', audioBuffer.sampleRate, '声道数:', audioBuffer.numberOfChannels);
      
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      console.log('WAV编码完成，大小:', wavBuffer.byteLength);
      
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      // 如果转换失败，返回原始Blob
      console.warn('WAV转换失败，使用原始音频:', error);
      console.log('原始音频信息 - 类型:', audioBlob.type, '大小:', audioBlob.size);
      
      // 如果原始格式不是WAV，尝试直接返回（可能Whisper能处理）
      return audioBlob;
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