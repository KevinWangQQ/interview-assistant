'use client';

import { useEffect, useState } from 'react';
import { InterviewHistory } from '@/components/interview/interview-history';
import { InterviewSettings } from '@/components/interview/interview-settings';
import { InterviewDetailView } from '@/components/interview/interview-detail-view';
import { StreamingErrorBoundary } from '@/components/streaming/streaming-error-boundary';
import { EnhancedInterviewMain } from '@/components/interview/enhanced-interview-main';
import { useInterviewHistoryStore } from '@/store/interview-history-store';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { Mic, History, Settings } from 'lucide-react';

type ViewType = 'interview' | 'history' | 'settings' | 'interview-detail';

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>('interview');
  const [selectedInterview, setSelectedInterview] = useState<EnhancedInterviewSession | null>(null);
  const { loadSessions } = useInterviewHistoryStore();

  const handleViewInterview = (interview: EnhancedInterviewSession) => {
    setSelectedInterview(interview);
    setCurrentView('interview-detail');
  };

  const handleBackToHistory = () => {
    setSelectedInterview(null);
    setCurrentView('history');
    // 刷新历史记录
    loadSessions();
  };

  // 当切换到历史页面时，刷新数据
  useEffect(() => {
    if (currentView === 'history') {
      loadSessions();
    }
  }, [currentView, loadSessions]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'interview':
        return <EnhancedInterviewMain />;
      
      case 'history':
        return (
          <div className="max-w-4xl mx-auto">
            <InterviewHistory 
              key="history-view" 
              onViewInterview={handleViewInterview} 
            />
          </div>
        );
      
      case 'interview-detail':
        return selectedInterview ? (
          <InterviewDetailView 
            interview={selectedInterview} 
            onBack={handleBackToHistory}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <InterviewHistory onViewInterview={handleViewInterview} />
          </div>
        );
      
      case 'settings':
        return <InterviewSettings />;
      
      default:
        return <EnhancedInterviewMain />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <Mic className="h-8 w-8 text-primary" />
                面试助手
              </div>
              <div className="hidden sm:block text-sm text-muted-foreground">
                实时语音转录与翻译
              </div>
            </div>
            
            {/* 简化导航 */}
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
