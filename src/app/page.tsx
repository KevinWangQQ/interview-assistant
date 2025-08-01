'use client';

import { useEffect, useState } from 'react';
import { InterviewControls } from '@/components/interview/interview-controls';
import { TranscriptionPanel } from '@/components/interview/transcription-panel';
import { QuestionSuggestions } from '@/components/interview/question-suggestions';
import { InterviewHistory } from '@/components/interview/interview-history';
import { ApiSettings } from '@/components/settings/api-settings';
import { FunctionTest } from '@/components/debug/function-test';
import { Navigation } from '@/components/layout/navigation';
import { useInterviewStore } from '@/store/interview-store';
import { Mic, MessageSquare, Lightbulb } from 'lucide-react';

type ViewType = 'interview' | 'history' | 'settings' | 'debug';

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>('interview');
  const { loadSessions, clearError } = useInterviewStore();

  useEffect(() => {
    // 初始化应用数据
    loadSessions();
    clearError();
  }, [loadSessions, clearError]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'interview':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* 左侧控制面板 */}
            <div className="xl:col-span-1 space-y-6">
              <InterviewControls />
              <QuestionSuggestions />
            </div>

            {/* 右侧转录面板 */}
            <div className="xl:col-span-3">
              <TranscriptionPanel />
            </div>
          </div>
        );
      
      case 'history':
        return (
          <div className="max-w-4xl mx-auto">
            <InterviewHistory />
          </div>
        );
      
      case 'settings':
        return (
          <div className="max-w-2xl mx-auto">
            <ApiSettings />
          </div>
        );
      
      case 'debug':
        return (
          <div className="max-w-4xl mx-auto">
            <FunctionTest />
          </div>
        );
      
      default:
        return null;
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
                Interview Assistant - 实时英文转录与中文翻译
              </div>
            </div>
            
            <Navigation 
              currentView={currentView} 
              onViewChange={setCurrentView} 
            />
          </div>
        </div>
      </header>

      {/* 主要内容区域 */}
      <main className="container mx-auto px-4 py-6">
        {renderCurrentView()}
      </main>

      {/* 底部信息 */}
      <footer className="border-t bg-card mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>实时转录</span>
              </div>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <span>智能建议</span>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p>Powered by OpenAI Whisper & GPT</p>
              <p className="text-xs mt-1">为英文面试提供实时翻译支持</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
