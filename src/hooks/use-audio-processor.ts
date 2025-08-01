// 音频处理Hook - 处理实时音频流和转录

import { useEffect, useRef, useCallback } from 'react';
import { useInterviewStore } from '@/store/interview-store';
import { getAudioService } from '@/services';
import { WhisperAudioService } from '@/services/audio/whisper-audio';

export function useAudioProcessor() {
  const audioChunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const processingQueueRef = useRef<Blob[]>([]);
  const lastProcessTimeRef = useRef<number>(0);
  
  const { 
    isRecording, 
    isPaused,
    processAudioChunk,
    currentSession,
    isProcessingAudio
  } = useInterviewStore();

  // 处理单个音频块
  const handleAudioData = useCallback(async (audioBlob: Blob) => {
    const now = Date.now();
    
    // 频率控制：至少间隔2秒处理一次
    if (now - lastProcessTimeRef.current < 2000) {
      console.log('处理频率过快，跳过此次音频块');
      return;
    }
    
    if (isProcessingRef.current) {
      console.log('正在处理中，将音频块加入队列');
      processingQueueRef.current.push(audioBlob);
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      return;
    }

    try {
      isProcessingRef.current = true;
      lastProcessTimeRef.current = now;
      
      console.log('收到音频数据，大小:', audioBlob.size, '时间:', new Date().toLocaleTimeString());
      
      // 只处理足够大的音频块
      if (audioBlob.size > 1000) { // 1KB最小阈值
        await processAudioChunk(audioBlob);
        
        // 处理完成后，检查队列中是否有待处理的音频
        if (processingQueueRef.current.length > 0) {
          console.log(`队列中还有 ${processingQueueRef.current.length} 个音频块待处理`);
          // 只处理最新的音频块，丢弃旧的
          const latestAudio = processingQueueRef.current.pop();
          processingQueueRef.current = []; // 清空队列
          
          if (latestAudio && latestAudio.size > 1000) {
            setTimeout(() => handleAudioData(latestAudio), 1000); // 1秒后处理
          }
        }
      }
    } catch (error) {
      console.error('音频处理失败:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [processAudioChunk]);

  // 设置音频服务的数据监听
  useEffect(() => {
    if (!isRecording || isPaused || !currentSession) {
      return;
    }

    const audioService = getAudioService() as WhisperAudioService;
    
    if (audioService && typeof audioService.onDataAvailable === 'function') {
      console.log('设置音频数据监听器');
      
      // 监听音频数据
      audioService.onDataAvailable(handleAudioData);
      
      return () => {
        // 清理监听器（这里可能需要扩展AudioService接口来支持移除监听器）
        console.log('清理音频数据监听器');
      };
    } else {
      console.warn('音频服务不支持数据监听');
    }
  }, [isRecording, isPaused, currentSession, handleAudioData]);

  // 清理函数
  useEffect(() => {
    return () => {
      audioChunksRef.current = [];
      isProcessingRef.current = false;
    };
  }, []);

  // 模拟音频数据收集（用于测试API调用流程）
  const simulateAudioData = useCallback(async () => {
    if (!isRecording || isPaused) return;
    
    // 创建模拟音频数据用于测试API调用
    const mockAudioData = new Blob([
      'RIFF....WAVEfmt ', // 模拟WAV头部
      new ArrayBuffer(1024 * 10) // 10KB模拟音频数据
    ], { type: 'audio/wav' });
    
    console.log('模拟音频数据处理，大小:', mockAudioData.size);
    await handleAudioData(mockAudioData);
  }, [isRecording, isPaused, handleAudioData]);

  // 手动触发处理（用于测试）
  const manualProcess = useCallback(async () => {
    if (audioChunksRef.current.length > 0) {
      const combinedBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await handleAudioData(combinedBlob);
      audioChunksRef.current = [];
    }
  }, [handleAudioData]);

  return {
    manualProcess,
    simulateAudioData,
    audioChunkCount: audioChunksRef.current.length,
    isProcessing: isProcessingRef.current
  };
}