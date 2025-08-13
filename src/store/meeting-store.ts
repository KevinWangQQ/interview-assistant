// 📋 会议专用Store - 会议录制和纪要管理（与面试完全隔离）

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { MeetingSession, MeetingMinutes, Participant, TranscriptSegment } from '@/types/meeting';
import { EnhancedWAVStreamingTranscriptionService } from '@/services/streaming/enhanced-wav-streaming-transcription';
import { MeetingStorageService } from '@/services/storage/meeting-storage.service';

interface MeetingState {
  // 会议基本信息
  currentMeeting: MeetingSession | null;
  isActive: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  
  // 实时转录状态
  currentTranscript: string;
  pendingTranscript: string;
  transcriptSegments: TranscriptSegment[];
  
  // 会议纪要状态
  currentMinutes: string; // 累积的中文会议纪要
  isGeneratingMinutes: boolean;
  lastMinutesUpdate: Date | null;
  minutesHistory: string[]; // 历次纪要更新历史
  
  // 参与者管理
  participants: Participant[];
  currentSpeaker: string | null;
  
  // 服务实例
  streamingService: EnhancedWAVStreamingTranscriptionService | null;
  storageService: MeetingStorageService;
  
  // 错误处理
  error: string | null;
  lastSavedTimestamp: number | null;
  
  // 配置
  config: {
    minutesUpdateInterval: number; // 纪要更新间隔（秒）
    autoSave: boolean;
    autoTopicDetection: boolean;
    summaryStyle: 'detailed' | 'concise' | 'bullet_points';
  };
}

interface MeetingActions {
  // 会议控制
  startMeeting: (meetingInfo: {
    title: string;
    type: MeetingSession['meetingType'];
    organizer: string;
    participants: Participant[];
    description?: string;
  }) => Promise<void>;
  stopMeeting: () => Promise<void>;
  pauseMeeting: () => Promise<void>;
  resumeMeeting: () => Promise<void>;
  
  // 转录处理
  handleTranscriptionUpdate: (data: any) => void;
  handleTranslationUpdate: (data: any) => void;
  handleSegmentCreated: (data: any) => void;
  
  // 纪要管理
  updateMinutes: () => Promise<void>;
  regenerateMinutes: () => Promise<void>;
  addManualNote: (note: string) => void;
  
  // 参与者管理
  updateCurrentSpeaker: (speaker: string) => void;
  addParticipant: (participant: Participant) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  
  // 数据管理
  saveMeeting: () => Promise<void>;
  loadMeeting: (meetingId: string) => Promise<void>;
  exportMeeting: (format: 'markdown' | 'html' | 'txt' | 'json') => Promise<void>;
  
  // 错误处理
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 重置
  reset: () => void;
}

type MeetingStore = MeetingState & MeetingActions;

const initialState: MeetingState = {
  currentMeeting: null,
  isActive: false,
  isPaused: false,
  isProcessing: false,
  currentTranscript: '',
  pendingTranscript: '',
  transcriptSegments: [],
  currentMinutes: '',
  isGeneratingMinutes: false,
  lastMinutesUpdate: null,
  minutesHistory: [],
  participants: [],
  currentSpeaker: null,
  streamingService: null,
  storageService: new MeetingStorageService(),
  error: null,
  lastSavedTimestamp: null,
  config: {
    minutesUpdateInterval: 120, // 2分钟更新一次纪要
    autoSave: true,
    autoTopicDetection: true,
    summaryStyle: 'detailed'
  }
};

export const useMeetingStore = create<MeetingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startMeeting: async (meetingInfo) => {
        try {
          console.log('📋 启动会议录制:', meetingInfo.title);
          
          // 重置状态
          set({
            currentTranscript: '',
            pendingTranscript: '',
            transcriptSegments: [],
            currentMinutes: '',
            minutesHistory: [],
            isGeneratingMinutes: false,
            lastMinutesUpdate: null,
            isProcessing: false,
            error: null,
            lastSavedTimestamp: null,
            participants: meetingInfo.participants,
            currentSpeaker: null
          });
          
          // 创建会议会话
          const meetingSession: MeetingSession = {
            id: `meeting-${Date.now()}`,
            type: 'meeting',
            meetingTitle: meetingInfo.title,
            meetingType: meetingInfo.type,
            description: meetingInfo.description,
            organizer: meetingInfo.organizer,
            participants: meetingInfo.participants,
            fullTranscript: [],
            pendingTranscript: '',
            lastProcessedIndex: 0,
            minutes: {
              id: `minutes-${Date.now()}`,
              title: meetingInfo.title,
              meetingType: meetingInfo.type,
              date: new Date(),
              startTime: new Date(),
              location: '在线会议',
              organizer: meetingInfo.organizer,
              participants: meetingInfo.participants,
              agenda: [],
              objectives: [],
              keyPoints: [],
              decisions: [],
              actionItems: [],
              nextSteps: [],
              topicSegments: [],
              speakerInsights: [],
              followUpRequired: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              version: 1,
              status: 'draft'
            },
            recordingSession: {
              id: `recording-${Date.now()}`,
              startTime: new Date(),
              duration: 0,
              status: 'active',
              audioConfig: {
                microphoneEnabled: true,
                systemAudioEnabled: true,
                sampleRate: 16000,
                channels: 1,
                format: 'wav'
              },
              audioQuality: 0.8,
              transcriptionQuality: 0.9
            },
            processingConfig: {
              minutesUpdateInterval: get().config.minutesUpdateInterval,
              autoTopicDetection: get().config.autoTopicDetection,
              autoActionItemExtraction: true,
              autoDecisionCapture: true,
              summaryStyle: get().config.summaryStyle
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMinutesUpdate: new Date(),
            isActive: true,
            isPaused: false,
            isProcessing: false,
            stats: {
              totalWords: 0,
              totalSpeakers: meetingInfo.participants.length,
              topicChanges: 0,
              decisionsCount: 0,
              actionItemsCount: 0,
              participationBalance: 0
            }
          };
          
          // 初始化流式转录服务
          const streamingService = new EnhancedWAVStreamingTranscriptionService({
            chunkInterval: 3000,
            translationDelay: 1000,
            enableSystemAudio: true,
            audioQualityThreshold: 0.1
          });

          // 设置事件监听器
          streamingService.addEventListener('transcription_update', (event) => {
            get().handleTranscriptionUpdate(event.data);
          });

          streamingService.addEventListener('translation_update', (event) => {
            get().handleTranslationUpdate(event.data);
          });

          streamingService.addEventListener('segment_created', (event) => {
            get().handleSegmentCreated(event.data);
          });

          streamingService.addEventListener('error', (event) => {
            get().setError(event.data.message || '转录服务错误');
          });

          // 启动录制
          await streamingService.startStreaming();
          
          set({ 
            currentMeeting: meetingSession,
            streamingService,
            isActive: true,
            isProcessing: true,
            error: null
          });
          
          // 启动纪要自动更新定时器
          setTimeout(() => {
            if (get().isActive && !get().isPaused) {
              get().updateMinutes();
            }
          }, get().config.minutesUpdateInterval * 1000);
          
          console.log('✅ 会议录制启动成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '启动会议失败';
          console.error('❌ 启动会议失败:', error);
          get().setError(`启动会议失败: ${errorMessage}`);
        }
      },

      stopMeeting: async () => {
        try {
          const { streamingService, currentMeeting } = get();
          
          if (streamingService) {
            await streamingService.stopStreaming();
          }
          
          if (currentMeeting) {
            // 更新会议结束信息
            const updatedMeeting = {
              ...currentMeeting,
              recordingSession: {
                ...currentMeeting.recordingSession,
                endTime: new Date(),
                duration: Math.floor((Date.now() - currentMeeting.recordingSession.startTime.getTime()) / 1000),
                status: 'completed' as const
              },
              minutes: {
                ...currentMeeting.minutes,
                endTime: new Date(),
                duration: Math.floor((Date.now() - currentMeeting.recordingSession.startTime.getTime()) / 1000),
                status: 'final' as const,
                updatedAt: new Date()
              },
              isActive: false,
              updatedAt: new Date()
            };
            
            set({ currentMeeting: updatedMeeting });
            
            // 生成最终纪要
            await get().updateMinutes();
            
            // 自动保存会议
            await get().saveMeeting();
          }
          
          set({ 
            streamingService: null,
            isActive: false,
            isProcessing: false,
            error: null
          });
          
          console.log('✅ 会议录制已停止并保存');
        } catch (error) {
          console.error('❌ 停止会议失败:', error);
          get().setError(`停止会议失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      pauseMeeting: async () => {
        try {
          const { streamingService } = get();
          
          if (streamingService) {
            await streamingService.pauseStreaming();
          }
          
          set({ 
            isPaused: true,
            isProcessing: false
          });
          
          console.log('⏸️ 会议录制已暂停');
        } catch (error) {
          console.error('❌ 暂停会议失败:', error);
          get().setError(`暂停失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      resumeMeeting: async () => {
        try {
          const { streamingService } = get();
          
          if (streamingService) {
            await streamingService.resumeStreaming();
          }
          
          set({ 
            isPaused: false,
            isProcessing: true
          });
          
          console.log('▶️ 会议录制已恢复');
        } catch (error) {
          console.error('❌ 恢复会议失败:', error);
          get().setError(`恢复失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      handleTranscriptionUpdate: (data: any) => {
        console.log('📝 会议转录更新:', data.text);
        
        set({
          currentTranscript: data.text,
          pendingTranscript: data.text,
          isProcessing: true
        });
      },

      handleTranslationUpdate: (data: any) => {
        console.log('🌍 会议翻译更新:', data.translation);
        
        // 会议模式：累积翻译，不覆盖
        const { currentMinutes } = get();
        const newContent = data.translation;
        
        // 避免重复内容
        if (!currentMinutes.includes(newContent)) {
          set({
            currentMinutes: currentMinutes ? `${currentMinutes}\n\n${newContent}` : newContent,
            isProcessing: false
          });
        }
      },

      handleSegmentCreated: (data: any) => {
        console.log('📦 会议新分段创建:', data.segment.id);
        
        const { transcriptSegments, currentMeeting } = get();
        
        const newSegment: TranscriptSegment = {
          id: data.segment.id,
          text: data.segment.text || data.segment.englishText || '',
          speaker: data.segment.speaker || 'unknown',
          startTime: new Date(data.segment.timestamp || Date.now()),
          endTime: new Date((data.segment.timestamp || Date.now()) + (data.segment.duration || 5000)),
          confidence: data.segment.confidence || 0.8,
          isProcessed: false
        };
        
        const updatedSegments = [...transcriptSegments, newSegment];
        
        // 更新会议会话的转录数据
        if (currentMeeting) {
          const updatedMeeting = {
            ...currentMeeting,
            fullTranscript: updatedSegments,
            pendingTranscript: '',
            lastProcessedIndex: updatedSegments.length - 1,
            updatedAt: new Date(),
            stats: {
              ...currentMeeting.stats,
              totalWords: updatedSegments.reduce((sum, seg) => 
                sum + seg.text.split(/\s+/).filter(w => w.length > 0).length, 0
              )
            }
          };
          
          set({
            transcriptSegments: updatedSegments,
            currentMeeting: updatedMeeting,
            currentTranscript: '',
            isProcessing: false
          });
        } else {
          set({
            transcriptSegments: updatedSegments,
            currentTranscript: '',
            isProcessing: false
          });
        }
      },

      updateMinutes: async () => {
        try {
          const { transcriptSegments, currentMeeting, isGeneratingMinutes } = get();
          
          if (isGeneratingMinutes || transcriptSegments.length === 0) {
            console.log('⚠️ 纪要生成中或无转录内容，跳过更新');
            return;
          }
          
          set({ isGeneratingMinutes: true });
          
          console.log('📊 开始更新会议纪要...');
          
          // 获取未处理的转录段落
          const unprocessedSegments = transcriptSegments.filter(seg => !seg.isProcessed);
          
          if (unprocessedSegments.length === 0) {
            console.log('⚠️ 无新的转录内容需要处理');
            set({ isGeneratingMinutes: false });
            return;
          }
          
          // 动态导入GPT服务
          const { GPT4InterviewSummaryService } = await import('@/services/interview-summary/gpt4-summary-service');
          const summaryService = new GPT4InterviewSummaryService();
          
          // 准备转录文本
          const newTranscript = unprocessedSegments
            .map(seg => `[${seg.speaker}]: ${seg.text}`)
            .join('\n');
          
          // 生成会议纪要提示词
          const meetingPrompt = `
请基于以下会议转录内容，生成或更新中文会议纪要。要求：

1. **累积更新**：将新内容与现有纪要合并，不要覆盖之前的内容
2. **关键要点**：提取讨论的主要话题和重要观点
3. **决策记录**：识别做出的决定和达成的共识
4. **行动项**：提取需要执行的任务和负责人
5. **简洁明了**：使用中文，条理清晰，便于后续查阅

现有纪要：
${get().currentMinutes || '（首次生成）'}

新增转录内容：
${newTranscript}

请更新完整的会议纪要：`;
          
          // 调用GPT生成纪要
          const response = await fetch('/api/openai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: '你是一个专业的会议纪要助手，擅长从会议转录中提取关键信息并生成结构化的中文纪要。'
                },
                {
                  role: 'user',
                  content: meetingPrompt
                }
              ],
              model: 'gpt-4',
              temperature: 0.3,
              max_tokens: 2000
            })
          });
          
          if (!response.ok) {
            throw new Error(`GPT API调用失败: ${response.status}`);
          }
          
          const result = await response.json();
          const updatedMinutes = result.choices?.[0]?.message?.content || '';
          
          if (!updatedMinutes) {
            throw new Error('GPT未返回有效的纪要内容');
          }
          
          // 更新纪要历史
          const { minutesHistory, currentMinutes } = get();
          const newHistory = currentMinutes ? [...minutesHistory, currentMinutes] : minutesHistory;
          
          // 标记转录段落为已处理
          const processedSegments = transcriptSegments.map(seg => ({
            ...seg,
            isProcessed: true
          }));
          
          set({
            currentMinutes: updatedMinutes,
            minutesHistory: newHistory,
            transcriptSegments: processedSegments,
            lastMinutesUpdate: new Date(),
            isGeneratingMinutes: false
          });
          
          console.log('✅ 会议纪要更新成功');
          
          // 自动保存
          if (get().config.autoSave) {
            setTimeout(() => get().saveMeeting(), 1000);
          }
          
          // 设置下次更新
          setTimeout(() => {
            if (get().isActive && !get().isPaused) {
              get().updateMinutes();
            }
          }, get().config.minutesUpdateInterval * 1000);
          
        } catch (error) {
          console.error('❌ 更新会议纪要失败:', error);
          set({ 
            isGeneratingMinutes: false,
            error: `纪要更新失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
        }
      },

      regenerateMinutes: async () => {
        try {
          const { transcriptSegments } = get();
          
          if (transcriptSegments.length === 0) {
            get().setError('无转录内容，无法重新生成纪要');
            return;
          }
          
          // 重置处理状态，重新生成完整纪要
          const resetSegments = transcriptSegments.map(seg => ({
            ...seg,
            isProcessed: false
          }));
          
          set({
            transcriptSegments: resetSegments,
            currentMinutes: '',
            minutesHistory: []
          });
          
          // 立即执行纪要更新
          await get().updateMinutes();
          
        } catch (error) {
          console.error('❌ 重新生成纪要失败:', error);
          get().setError(`重新生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      addManualNote: (note: string) => {
        const { currentMinutes } = get();
        const timestamp = new Date().toLocaleTimeString();
        const manualNote = `\n\n**[${timestamp} 手动备注]**: ${note}`;
        
        set({
          currentMinutes: currentMinutes + manualNote
        });
        
        console.log('📝 添加手动备注成功');
      },

      updateCurrentSpeaker: (speaker: string) => {
        set({ currentSpeaker: speaker });
      },

      addParticipant: (participant: Participant) => {
        const { participants } = get();
        set({
          participants: [...participants, participant]
        });
      },

      updateParticipant: (participantId: string, updates: Partial<Participant>) => {
        const { participants } = get();
        const updatedParticipants = participants.map(p => 
          p.id === participantId ? { ...p, ...updates } : p
        );
        set({ participants: updatedParticipants });
      },

      saveMeeting: async () => {
        try {
          const { currentMeeting, currentMinutes, transcriptSegments, lastSavedTimestamp } = get();
          
          if (!currentMeeting) {
            console.warn('⚠️ 无当前会议，跳过保存');
            return;
          }
          
          // 防止频繁保存
          const now = Date.now();
          if (lastSavedTimestamp && (now - lastSavedTimestamp) < 10000) {
            console.log('⚠️ 距离上次保存时间过短，跳过保存');
            return;
          }
          
          console.log('💾 保存会议会话...');
          
          // 更新会议纪要内容
          const updatedMinutes: MeetingMinutes = {
            ...currentMeeting.minutes,
            keyPoints: currentMinutes.split('\n').filter(line => 
              line.trim() && !line.startsWith('[') && !line.startsWith('**')
            ),
            updatedAt: new Date(),
            version: currentMeeting.minutes.version + 1
          };
          
          const updatedMeeting: MeetingSession = {
            ...currentMeeting,
            fullTranscript: transcriptSegments,
            minutes: updatedMinutes,
            updatedAt: new Date(),
            stats: {
              ...currentMeeting.stats,
              totalWords: transcriptSegments.reduce((sum, seg) => 
                sum + seg.text.split(/\s+/).filter(w => w.length > 0).length, 0
              ),
              topicChanges: Math.max(1, new Set(transcriptSegments.map(seg => seg.speaker)).size),
              participationBalance: transcriptSegments.length > 0 ? 0.8 : 0
            }
          };
          
          // 保存到存储
          const { storageService } = get();
          await storageService.saveSession(updatedMeeting);
          
          set({ 
            currentMeeting: updatedMeeting,
            lastSavedTimestamp: now 
          });
          
          console.log('✅ 会议保存成功');
          
        } catch (error) {
          console.error('❌ 保存会议失败:', error);
          get().setError(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      loadMeeting: async (meetingId: string) => {
        try {
          const { storageService } = get();
          const meeting = storageService.getSession(meetingId);
          
          if (!meeting) {
            throw new Error('会议不存在');
          }
          
          set({
            currentMeeting: meeting,
            transcriptSegments: meeting.fullTranscript,
            currentMinutes: meeting.minutes.keyPoints.join('\n'),
            participants: meeting.participants
          });
          
          console.log('✅ 会议加载成功');
        } catch (error) {
          console.error('❌ 加载会议失败:', error);
          get().setError(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      exportMeeting: async (format) => {
        try {
          const { currentMeeting, storageService } = get();
          
          if (!currentMeeting) {
            throw new Error('无当前会议可导出');
          }
          
          const exportResult = await storageService.exportMeeting(currentMeeting.id, {
            format,
            includeTranscript: true,
            includeMinutes: true,
            includeActionItems: true,
            includeParticipants: true,
            includeStats: true
          });
          
          // 触发下载
          const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = exportResult.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log('✅ 会议导出成功');
        } catch (error) {
          console.error('❌ 导出会议失败:', error);
          get().setError(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      reset: () => {
        const { streamingService } = get();
        if (streamingService) {
          streamingService.stopStreaming();
        }
        set({ 
          ...initialState,
          storageService: get().storageService // 保留存储服务实例
        });
      }
    }),
    {
      name: 'meeting-store',
    }
  )
);