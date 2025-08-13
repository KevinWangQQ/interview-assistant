'use client';

import { useEffect, useState } from 'react';
import { UnifiedHistory } from '@/components/history/unified-history';
import { InterviewSettings } from '@/components/interview/interview-settings';
import { InterviewDetailView } from '@/components/interview/interview-detail-view';
import { StreamingErrorBoundary } from '@/components/streaming/streaming-error-boundary';
import { EnhancedInterviewMain } from '@/components/interview/enhanced-interview-main';
import { LoginPage } from '@/components/auth/login-page';
import { UserProfile } from '@/components/auth/user-profile';
import { MigrationReminder } from '@/components/migration/migration-reminder';
// import { DataMigrationWizard } from '@/components/migration/data-migration-wizard'; // 暂时禁用
import { MeetingMinutesMain } from '@/components/meeting/meeting-minutes-main';
import { useInterviewHistoryStore } from '@/store/interview-history-store';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { MeetingSession } from '@/types/meeting';
import { useAuth } from '@/contexts/auth-context';
import { Mic, History, Settings, Loader2, FileText } from 'lucide-react';
// 开发环境下导入数据隔离测试工具
if (process.env.NODE_ENV === 'development') {
  import('@/utils/data-isolation-test');
}
// import { MigrationResult } from '@/services/migration/data-migration-service'; // 暂时禁用

// 临时类型定义
interface MigrationResult {
  success: boolean;
  migrated: number;
  migratedSessions: number;
  failed: number;
  errors?: string[];
}

type ViewType = 'interview' | 'meeting' | 'history' | 'settings' | 'interview-detail';

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>('interview');
  const [selectedInterview, setSelectedInterview] = useState<EnhancedInterviewSession | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingSession | null>(null);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false); // 暂时禁用迁移
  const { loadSessions } = useInterviewHistoryStore();
  const { user, loading, migrationStatus, migrationChecked } = useAuth();

  // 当切换到历史页面时，刷新数据
  useEffect(() => {
    if (currentView === 'history') {
      loadSessions();
    }
  }, [currentView, loadSessions]);

  // 显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">面试助手 V2.0</h1>
            <p className="text-muted-foreground">正在加载...</p>
          </div>
        </div>
      </div>
    );
  }

  // 用户未登录时显示登录页面
  if (!user) {
    return <LoginPage />;
  }

  const handleViewInterview = (interview: EnhancedInterviewSession) => {
    setSelectedInterview(interview);
    setCurrentView('interview-detail');
  };

  const handleViewMeeting = (meeting: MeetingSession) => {
    // 可以后续扩展会议详情查看页面
    console.log('查看会议:', meeting.meetingTitle);
    // 临时使用alert显示会议信息
    alert(`会议: ${meeting.meetingTitle}\n时间: ${meeting.createdAt.toLocaleString()}\n组织者: ${meeting.organizer}`);
  };

  const handleBackToHistory = () => {
    setSelectedInterview(null);
    setCurrentView('history');
    // 刷新历史记录
    loadSessions();
  };

  const handleStartMigration = () => {
    setShowMigrationWizard(true);
  };

  const handleMigrationComplete = (result: MigrationResult) => {
    console.log('🎉 数据迁移完成:', result);
    setShowMigrationWizard(false);
    // 刷新历史记录以显示迁移的数据
    if (result.success && result.migratedSessions > 0) {
      loadSessions();
    }
  };

  const handleMigrationCancel = () => {
    setShowMigrationWizard(false);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'interview':
        return <EnhancedInterviewMain />;
      
      case 'meeting':
        return <MeetingMinutesMain />;
      
      case 'history':
        return (
          <UnifiedHistory 
            key="history-view" 
            onViewInterview={handleViewInterview}
            onViewMeeting={handleViewMeeting}
          />
        );
      
      case 'interview-detail':
        return selectedInterview ? (
          <InterviewDetailView 
            interview={selectedInterview} 
            onBack={handleBackToHistory}
          />
        ) : (
          <UnifiedHistory 
            onViewInterview={handleViewInterview} 
            onViewMeeting={handleViewMeeting}
          />
        );
      
      case 'settings':
        return <InterviewSettings />;
      
      default:
        return <EnhancedInterviewMain />;
    }
  };

  // 显示迁移向导
  if (showMigrationWizard) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* 数据迁移向导暂时禁用
          <DataMigrationWizard
            onComplete={handleMigrationComplete}
            onCancel={handleMigrationCancel}
          />
          */}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 数据迁移提醒横幅 */}
      {migrationChecked && migrationStatus?.needsMigration && (
        <MigrationReminder
          variant="banner"
          onStartMigration={handleStartMigration}
        />
      )}
      
      {/* 头部 */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <Mic className="h-8 w-8 text-primary" />
                面试助手 V2.0
              </div>
              <div className="hidden sm:block text-sm text-muted-foreground">
                云端多用户 | 实时语音转录与翻译
              </div>
            </div>
            
            {/* 导航和用户菜单 */}
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('interview')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'interview' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Mic className="h-4 w-4 mr-1 inline-block" />
                  面试
                </button>
                <button
                  onClick={() => setCurrentView('meeting')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'meeting' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                  title="会议录制和纪要生成"
                >
                  <FileText className="h-4 w-4 mr-1 inline-block" />
                  会议纪要
                </button>
                <button
                  onClick={() => setCurrentView('history')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'history' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <History className="h-4 w-4 mr-1 inline-block" />
                  历史
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'settings' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-1 inline-block" />
                  设置
                </button>
              </nav>
              
              {/* 用户头像菜单 */}
              <UserProfile 
                onSettingsClick={() => setCurrentView('settings')} 
              />
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="container mx-auto px-4 py-6">
        <StreamingErrorBoundary>
          {renderCurrentView()}
        </StreamingErrorBoundary>
      </main>
    </div>
  );
}
