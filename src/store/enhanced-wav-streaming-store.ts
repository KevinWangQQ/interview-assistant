// 🎵 增强版WAV流式Store - 支持多音频源和质量监控

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { EnhancedWAVStreamingTranscriptionService } from '@/services/streaming/enhanced-wav-streaming-transcription';

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

interface AudioDetectionResult {
  microphoneAvailable: boolean;
  systemAudioAvailable: boolean;
  recommendedSetup: string;
}

interface EnhancedWAVStreamingState {
  // 录制状态
  isActive: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  
  // 转录内容
  currentText: string;
  currentTranslation: string;
  
  // 服务实例
  streamingService: EnhancedWAVStreamingTranscriptionService | null;
  
  // 错误处理
  error: string | null;
  
  // 音频源管理
  audioSources: {
    microphone: AudioSourceInfo;
    systemAudio: AudioSourceInfo;
  };
  
  // 音频质量监控
  audioQuality: AudioQualityMetrics | null;
  
  // 音频检测结果
  audioDetection: AudioDetectionResult | null;
  
  // 配置
  config: {
    chunkInterval: number;
    translationDelay: number;
    enableSystemAudio: boolean;
    audioQualityThreshold: number;
  };
}

interface EnhancedWAVStreamingActions {
  // 基础控制
  startStreaming: () => Promise<void>;
  pauseStreaming: () => Promise<void>;
  resumeStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  
  // 音频源管理
  detectAudioSources: () => Promise<void>;
  toggleSystemAudio: (enabled: boolean) => Promise<void>;
  
  // 事件处理
  handleTranscriptionUpdate: (data: any) => void;
  handleTranslationUpdate: (data: any) => void;
  handleAudioSourceChanged: (data: any) => void;
  handleAudioQualityUpdate: (data: any) => void;
  handleError: (data: any) => void;
  
  // 工具方法
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
  updateConfig: (config: Partial<EnhancedWAVStreamingState['config']>) => void;
}

type EnhancedWAVStreamingStore = EnhancedWAVStreamingState & EnhancedWAVStreamingActions;

const initialState: EnhancedWAVStreamingState = {
  isActive: false,
  isProcessing: false,
  isPaused: false,
  currentText: '',
  currentTranslation: '',
  streamingService: null,
  error: null,
  audioSources: {
    microphone: {
      type: 'microphone',
      stream: null,
      isActive: false,
      quality: 0
    },
    systemAudio: {
      type: 'system',
      stream: null,
      isActive: false,
      quality: 0
    }
  },
  audioQuality: null,
  audioDetection: null,
  config: {
    chunkInterval: 3000,
    translationDelay: 1000,
    enableSystemAudio: true,
    audioQualityThreshold: 0.1
  }
};

export const useEnhancedWAVStreamingStore = create<EnhancedWAVStreamingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 🔍 检测音频源
      detectAudioSources: async () => {
        try {
          console.log('🔍 开始检测音频源...');
          
          const { config } = get();
          const tempService = new EnhancedWAVStreamingTranscriptionService(config);
          const result = await tempService.detectAudioSources();
          
          set({ 
            audioDetection: result,
            error: null 
          });
          
          console.log('✅ 音频源检测完成:', result);
        } catch (error) {
          console.error('❌ 音频源检测失败:', error);
          const errorMessage = error instanceof Error ? error.message : '音频源检测失败';
          get().setError(errorMessage);
        }
      },

      // 🎬 开始录制
      startStreaming: async () => {
        try {
          console.log('🎬 启动增强版流式处理');
          
          const { config } = get();
          
          const streamingService = new EnhancedWAVStreamingTranscriptionService(config);

          // 注册事件监听器
          streamingService.addEventListener('transcription_update', (event) => {
            get().handleTranscriptionUpdate(event.data);
          });

          streamingService.addEventListener('translation_update', (event) => {
            get().handleTranslationUpdate(event.data);
          });

          streamingService.addEventListener('audio_source_changed', (event) => {
            get().handleAudioSourceChanged(event.data);
          });

          streamingService.addEventListener('audio_quality_update', (event) => {
            get().handleAudioQualityUpdate(event.data);
          });

          streamingService.addEventListener('error', (event) => {
            get().handleError(event.data);
          });

          // 启动服务
          await streamingService.startStreaming();
          
          set({ 
            streamingService,
            isActive: true,
            isProcessing: true,
            isPaused: false,
            error: null
          });
          
          console.log('✅ 增强版流式处理启动成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '启动失败';
          console.error('❌ 启动增强版流式处理失败:', error);
          get().setError(`启动失败: ${errorMessage}`);
        }
      },

      // ⏸️ 暂停录制
      pauseStreaming: async () => {
        try {
          const { streamingService } = get();
          if (streamingService && get().isActive && !get().isPaused) {
            // 注意：当前服务没有暂停功能，这里只更新状态
            // 实际实现中需要在服务中添加暂停/恢复逻辑
            set({ 
              isPaused: true,
              isProcessing: false 
            });
            console.log('⏸️ 录制已暂停');
          }
        } catch (error) {
          console.error('❌ 暂停录制失败:', error);
        }
      },

      // ▶️ 恢复录制
      resumeStreaming: async () => {
        try {
          const { streamingService } = get();
          if (streamingService && get().isActive && get().isPaused) {
            set({ 
              isPaused: false,
              isProcessing: true 
            });
            console.log('▶️ 录制已恢复');
          }
        } catch (error) {
          console.error('❌ 恢复录制失败:', error);
        }
      },

      // 🛑 停止录制
      stopStreaming: async () => {
        try {
          const { streamingService } = get();
          if (streamingService) {
            await streamingService.stopStreaming();
          }
          
          set({ 
            streamingService: null,
            isActive: false,
            isProcessing: false,
            isPaused: false,
            error: null
          });
          
          console.log('✅ 增强版流式处理已停止');
        } catch (error) {
          console.error('❌ 停止增强版流式处理失败:', error);
        }
      },

      // 🎛️ 切换系统音频
      toggleSystemAudio: async (enabled: boolean) => {
        try {
          const { streamingService } = get();
          if (streamingService) {
            await streamingService.toggleSystemAudio(enabled);
          }
          
          // 更新配置
          set(state => ({
            config: {
              ...state.config,
              enableSystemAudio: enabled
            }
          }));
          
          console.log(`🎛️ 系统音频已${enabled ? '启用' : '禁用'}`);
        } catch (error) {
          console.error('❌ 切换系统音频失败:', error);
          const errorMessage = error instanceof Error ? error.message : '切换系统音频失败';
          get().setError(errorMessage);
        }
      },

      // 📝 处理转录更新
      handleTranscriptionUpdate: (data: any) => {
        console.log('📝 增强版转录更新:', data.text);
        set({
          currentText: data.text,
          isProcessing: true
        });
      },

      // 🌍 处理翻译更新
      handleTranslationUpdate: (data: any) => {
        console.log('🌍 增强版翻译更新:', data.translation);
        set({
          currentText: data.text,
          currentTranslation: data.translation,
          isProcessing: false
        });
      },

      // 🎤 处理音频源变更
      handleAudioSourceChanged: (data: any) => {
        console.log('🎤 音频源状态变更:', data);
        set({
          audioSources: {
            microphone: data.microphone || get().audioSources.microphone,
            systemAudio: data.systemAudio || get().audioSources.systemAudio
          }
        });
      },

      // 📊 处理音频质量更新
      handleAudioQualityUpdate: (data: any) => {
        set({
          audioQuality: data
        });
        
        // 如果音频质量过低，发出警告
        if (data.volume < get().config.audioQualityThreshold) {
          console.warn('⚠️ 音频质量较低:', data);
        }
      },

      // ❌ 处理错误
      handleError: (data: any) => {
        console.error('❌ 增强版流式处理错误:', data);
        const errorMessage = data.message || '未知错误';
        get().setError(errorMessage);
        set({ isProcessing: false });
      },

      // 🛠️ 工具方法
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      updateConfig: (newConfig) => {
        set(state => ({
          config: {
            ...state.config,
            ...newConfig
          }
        }));
      },

      reset: () => {
        const { streamingService } = get();
        if (streamingService) {
          streamingService.stopStreaming();
        }
        set(initialState);
      }
    }),
    {
      name: 'enhanced-wav-streaming-store',
    }
  )
);