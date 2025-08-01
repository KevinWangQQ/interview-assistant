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
      // 将音频转换为WAV格式（Whisper API要求）
      const wavBlob = await this.convertToWav(audioBlob);
      
      // 调用Whisper API
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      formData.append('model', options?.model || 'whisper-1');
      
      if (options?.language) {
        formData.append('language', options.language);
      }
      
      if (options?.prompt) {
        formData.append('prompt', options.prompt);
      }

      if (options?.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getApiKey()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        text: result.text || '',
        confidence: 0.9, // Whisper不提供置信度，使用默认值
        segments: result.segments || undefined
      };
    } catch (error) {
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
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (error) {
      // 如果转换失败，返回原始Blob
      console.warn('WAV conversion failed, using original audio:', error);
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
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 
                   (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null);
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set NEXT_PUBLIC_OPENAI_API_KEY or save it in localStorage.');
    }
    return apiKey;
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