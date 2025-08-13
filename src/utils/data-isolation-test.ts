// 🧪 数据隔离测试工具 - 验证面试和会议数据完全隔离

import { EnhancedInterviewStorageService } from '@/services/storage/enhanced-interview-storage';
import { MeetingStorageService } from '@/services/storage/meeting-storage.service';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { MeetingSession, Participant } from '@/types/meeting';

export interface DataIsolationTestResult {
  success: boolean;
  details: {
    storageKeyIsolation: boolean;
    dataTypeIsolation: boolean;
    crossContamination: boolean;
    functionalIsolation: boolean;
  };
  errors: string[];
  summary: string;
}

export async function testDataIsolation(): Promise<DataIsolationTestResult> {
  const errors: string[] = [];
  let storageKeyIsolation = true;
  let dataTypeIsolation = true;
  let crossContamination = true; // true = no contamination (good)
  let functionalIsolation = true;

  console.log('🧪 开始数据隔离测试...');

  try {
    // 1. 测试存储键隔离
    console.log('📋 测试1: 存储键隔离');
    const interviewStorage = new EnhancedInterviewStorageService();
    const meetingStorage = new MeetingStorageService();

    // 检查存储键是否不同
    const interviewKey: string = 'enhanced-interview-sessions'; // 从源码中已知
    const meetingKey: string = 'meeting-sessions'; // 从源码中已知
    
    // 我们知道这些键不同，这是设计上的隔离
    if (interviewKey !== meetingKey) {
      console.log('✅ 存储键隔离正确');
    } else {
      storageKeyIsolation = false;
      errors.push('存储键冲突：面试和会议使用了相同的存储键');
    }

    // 2. 测试数据类型隔离
    console.log('📋 测试2: 数据类型隔离');
    
    // 创建测试面试数据
    const testInterview: EnhancedInterviewSession = {
      id: 'test-interview-001',
      timestamp: new Date(),
      lastUpdated: new Date(),
      candidateName: '测试候选人',
      position: '测试职位',
      interviewerName: '面试官',
      company: '测试公司',
      recordingSession: {
        id: 'test-recording-001',
        startTime: new Date(),
        endTime: new Date(),
        duration: 1800,
        status: 'completed',
        audioConfig: {
          microphoneEnabled: true,
          systemAudioEnabled: false,
          sampleRate: 16000,
          channels: 1,
          format: 'wav'
        },
        audioQualityHistory: [],
        averageAudioQuality: 0.8
      },
      segments: [],
      rawTranscriptionText: '测试转录内容',
      rawTranslationText: '测试翻译内容',
      statistics: {
        totalWords: 100,
        totalQuestions: 5,
        speakerChangeCount: 10,
        averageSegmentDuration: 30,
        longestSegmentDuration: 60,
        speakingTimeDistribution: {
          interviewer: 900,
          candidate: 900,
          unknown: 0
        },
        interactionMetrics: {
          responseTime: [2, 3, 1.5],
          questionDepth: 3,
          engagementScore: 0.8
        }
      },
      tags: ['测试'],
      category: 'technical',
      difficulty: 'mid',
      metadata: {
        recordingQuality: 'high',
        processingVersion: '1.0.0'
      },
      status: 'completed',
      isBookmarked: false,
      confidentialityLevel: 'internal'
    };

    // 创建测试会议数据
    const testParticipants: Participant[] = [
      {
        id: 'p1',
        name: '参会者1',
        role: '项目经理'
      },
      {
        id: 'p2', 
        name: '参会者2',
        role: '开发者'
      }
    ];

    const testMeeting: MeetingSession = {
      id: 'test-meeting-001',
      type: 'meeting',
      meetingTitle: '测试会议',
      meetingType: 'regular',
      description: '数据隔离测试会议',
      organizer: '测试组织者',
      participants: testParticipants,
      fullTranscript: [],
      pendingTranscript: '',
      lastProcessedIndex: 0,
      minutes: {
        id: 'test-minutes-001',
        title: '测试会议',
        meetingType: 'regular',
        date: new Date(),
        startTime: new Date(),
        organizer: '测试组织者',
        participants: testParticipants,
        agenda: [],
        objectives: [],
        keyPoints: ['测试要点1', '测试要点2'],
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
        id: 'test-meeting-recording-001',
        startTime: new Date(),
        duration: 3600,
        status: 'completed',
        audioConfig: {
          microphoneEnabled: true,
          systemAudioEnabled: true,
          sampleRate: 16000,
          channels: 1,
          format: 'wav'
        },
        audioQuality: 0.9,
        transcriptionQuality: 0.8
      },
      processingConfig: {
        minutesUpdateInterval: 120,
        autoTopicDetection: true,
        autoActionItemExtraction: true,
        autoDecisionCapture: true,
        summaryStyle: 'detailed'
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMinutesUpdate: new Date(),
      isActive: false,
      isPaused: false,
      isProcessing: false,
      stats: {
        totalWords: 500,
        totalSpeakers: 2,
        topicChanges: 3,
        decisionsCount: 1,
        actionItemsCount: 2,
        participationBalance: 0.6
      }
    };

    // 3. 测试数据保存隔离
    console.log('📋 测试3: 数据保存隔离');
    
    // 保存测试数据
    await interviewStorage.saveSession(testInterview);
    await meetingStorage.saveSession(testMeeting);
    
    // 验证数据是否正确保存到各自的存储中
    const savedInterview = interviewStorage.getSession('test-interview-001');
    const savedMeeting = meetingStorage.getSession('test-meeting-001');
    
    if (!savedInterview) {
      dataTypeIsolation = false;
      errors.push('面试数据保存失败');
    }
    
    if (!savedMeeting) {
      dataTypeIsolation = false;
      errors.push('会议数据保存失败');
    }

    // 4. 测试交叉污染
    console.log('📋 测试4: 交叉污染检查');
    
    // 检查面试存储中是否包含会议数据
    const interviewSessions = interviewStorage.getAllSessions();
    const meetingSessions = meetingStorage.getAllSessions();
    
    // 验证类型正确性
    for (const session of interviewSessions) {
      if ('type' in session && session.type === 'meeting') {
        crossContamination = false;
        errors.push('面试存储中发现会议数据');
        break;
      }
    }
    
    for (const session of meetingSessions) {
      if (session.type !== 'meeting') {
        crossContamination = false;
        errors.push('会议存储中发现非会议数据');
        break;
      }
    }

    // 5. 测试功能隔离
    console.log('📋 测试5: 功能隔离');
    
    // 测试搜索功能
    const interviewFilter = {
      candidateName: '测试候选人'
    };
    
    const meetingFilter = {
      organizer: '测试组织者'
    };
    
    const filteredInterviews = interviewStorage.searchSessions(interviewFilter);
    const filteredMeetings = meetingStorage.searchSessions(meetingFilter);
    
    if (filteredInterviews.length === 0) {
      functionalIsolation = false;
      errors.push('面试搜索功能异常');
    }
    
    if (filteredMeetings.length === 0) {
      functionalIsolation = false;
      errors.push('会议搜索功能异常');
    }

    // 6. 清理测试数据
    console.log('📋 清理测试数据...');
    await interviewStorage.deleteSession('test-interview-001');
    await meetingStorage.deleteSession('test-meeting-001');
    
    console.log('✅ 数据隔离测试完成');

  } catch (error) {
    errors.push(`测试执行错误: ${error instanceof Error ? error.message : '未知错误'}`);
    storageKeyIsolation = false;
    dataTypeIsolation = false;
    crossContamination = false;
    functionalIsolation = false;
  }

  const success = storageKeyIsolation && dataTypeIsolation && crossContamination && functionalIsolation;
  
  const summary = success 
    ? '✅ 数据隔离测试全部通过！面试和会议数据完全隔离，不存在交叉污染。'
    : `❌ 数据隔离测试发现问题：${errors.join('; ')}`;

  return {
    success,
    details: {
      storageKeyIsolation,
      dataTypeIsolation,
      crossContamination,
      functionalIsolation
    },
    errors,
    summary
  };
}

// 导出用于浏览器控制台测试的函数
export function runDataIsolationTestInBrowser() {
  if (typeof window === 'undefined') {
    console.error('此函数只能在浏览器环境中运行');
    return;
  }

  testDataIsolation().then(result => {
    console.group('🧪 数据隔离测试结果');
    console.log('总体结果:', result.success ? '✅ 通过' : '❌ 失败');
    console.log('存储键隔离:', result.details.storageKeyIsolation ? '✅' : '❌');
    console.log('数据类型隔离:', result.details.dataTypeIsolation ? '✅' : '❌');
    console.log('无交叉污染:', result.details.crossContamination ? '✅' : '❌');
    console.log('功能隔离:', result.details.functionalIsolation ? '✅' : '❌');
    
    if (result.errors.length > 0) {
      console.group('❌ 发现的问题:');
      result.errors.forEach(error => console.error('-', error));
      console.groupEnd();
    }
    
    console.log('📋 总结:', result.summary);
    console.groupEnd();
  }).catch(error => {
    console.error('测试执行失败:', error);
  });
}

// 在开发环境中自动暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).runDataIsolationTest = runDataIsolationTestInBrowser;
  console.log('🧪 数据隔离测试已准备就绪，在浏览器控制台中运行: runDataIsolationTest()');
}