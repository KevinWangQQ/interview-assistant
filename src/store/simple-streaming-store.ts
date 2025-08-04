// 🔧 简化流式Store - 测试基础功能
// 移除复杂分段逻辑，专注于API连接测试

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { WAVStreamingTranscriptionService } from '@/services/streaming/wav-streaming-transcription';

interface SimpleStreamingState {
  // 基础状态
  isActive: boolean;
  isProcessing: boolean;
  currentText: string;
  currentTranslation: string;
  
  // 服务
  streamingService: WAVStreamingTranscriptionService | null;
  
  // 错误处理
  error: string | null;
  
  // 配置
  config: {
    openaiApiKey: string;
    chunkInterval: number;
    translationDelay: number;
  };
}

interface SimpleStreamingActions {
  // 核心操作
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  
  // 事件处理
  handleTranscriptionUpdate: (data: any) => void;
  handleTranslationUpdate: (data: any) => void;
  handleError: (data: any) => void;
  
  // 状态管理
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type SimpleStreamingStore = SimpleStreamingState & SimpleStreamingActions;

// 初始状态
const initialState: SimpleStreamingState = {
  isActive: false,
  isProcessing: false,
  currentText: '',
  currentTranslation: '',
  streamingService: null,
  error: null,
  config: {
    openaiApiKey: '',
    chunkInterval: 3000,      // 3秒录音间隔
    translationDelay: 1000    // 1秒翻译延迟
  }
};

// 创建Store
export const useSimpleStreamingStore = create<SimpleStreamingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 🚀 开始流式处理
      startStreaming: async () => {
        try {
          console.log('🚀 启动简化流式处理');
          
          const { config } = get();
          
          // 创建简化服务
          const streamingService = new WAVStreamingTranscriptionService({
            chunkInterval: config.chunkInterval,
            translationDelay: config.translationDelay
          });

          // 注册事件监听器
          streamingService.addEventListener('transcription_update', (event) => {
            get().handleTranscriptionUpdate(event.data);
          });

          streamingService.addEventListener('translation_update', (event) => {
            get().handleTranslationUpdate(event.data);
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
            error: null
          });
          
          console.log('✅ 简化流式处理启动成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '启动失败';
          console.error('❌ 启动简化流式处理失败:', error);
          get().setError(`启动失败: ${errorMessage}`);
        }
      },

      // 🛑 停止流式处理
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
            error: null
          });
          
          console.log('✅ 简化流式处理已停止');
        } catch (error) {
          console.error('❌ 停止简化流式处理失败:', error);
        }
      },

      // 📝 处理转录更新
      handleTranscriptionUpdate: (data: any) => {
        console.log('📝 转录更新:', data.text);
        
        set({
          currentText: data.text,
          isProcessing: true
        });
      },

      // 🌍 处理翻译更新
      handleTranslationUpdate: (data: any) => {
        console.log('🌍 翻译更新:', data.translation);
        
        set({
          currentText: data.text,
          currentTranslation: data.translation,
          isProcessing: false
        });
      },

      // ❌ 处理错误
      handleError: (data: any) => {
        console.error('❌ 简化流式处理错误:', data);
        
        const errorMessage = data.message || '未知错误';
        get().setError(errorMessage);
        
        set({ 
          isProcessing: false 
        });
      },

      // 🚨 错误处理
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // 🔄 重置
      reset: () => {
        const { streamingService } = get();
        if (streamingService) {
          streamingService.stopStreaming();
        }
        set(initialState);
      }
    }),
    {
      name: 'simple-streaming-store',
    }
  )
);