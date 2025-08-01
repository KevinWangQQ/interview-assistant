'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAudioProcessor } from '@/hooks/use-audio-processor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  Mic, 
  MicOff, 
  Clock,
  User,
  Briefcase
} from 'lucide-react';
import { useInterviewStore } from '@/store/interview-store';

interface InterviewControlsProps {
  className?: string;
}

export function InterviewControls({ className }: InterviewControlsProps) {
  const [candidateName, setCandidateName] = useState('');
  const [position, setPosition] = useState('');
  
  // 启用音频处理Hook
  useAudioProcessor();
  
  const {
    currentSession,
    isRecording,
    isPaused,
    recordingDuration,
    startInterview,
    pauseInterview,
    resumeInterview,
    stopInterview,
    startRecording,
    stopRecording,
    error
  } = useInterviewStore();

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const handleStartInterview = async () => {
    if (!candidateName.trim() || !position.trim()) return;
    
    await startInterview(candidateName, position);
    await startRecording();
  };

  const handlePauseResume = async () => {
    if (isPaused) {
      await resumeInterview();
    } else {
      await pauseInterview();
    }
  };

  const handleStop = async () => {
    await stopInterview();
    await stopRecording();
    setCandidateName('');
    setPosition('');
  };

  const getStatusBadge = () => {
    if (!currentSession) return null;
    
    if (isPaused) {
      return <Badge variant="secondary">已暂停</Badge>;
    }
    
    if (currentSession.status === 'recording') {
      return <Badge variant="default" className="bg-green-500">录制中</Badge>;
    }
    
    if (currentSession.status === 'completed') {
      return <Badge variant="outline">已完成</Badge>;
    }
    
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            面试控制台
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!currentSession ? (
          // 开始面试表单
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="candidate-name">候选人姓名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="candidate-name"
                    placeholder="输入候选人姓名"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">应聘职位</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="position"
                    placeholder="输入应聘职位"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            <Button 
              onClick={handleStartInterview}
              disabled={!candidateName.trim() || !position.trim()}
              className="w-full"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              开始面试
            </Button>
          </div>
        ) : (
          // 面试控制按钮
          <div className="space-y-4">
            {/* 面试信息显示 */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                <span className="font-medium">候选人:</span>
                <span>{currentSession.candidateName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4" />
                <span className="font-medium">职位:</span>
                <span>{currentSession.position}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-medium">录制时长:</span>
                <span className="font-mono">{formatDuration(recordingDuration)}</span>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex gap-2">
              <Button
                onClick={handlePauseResume}
                variant={isPaused ? "default" : "secondary"}
                size="lg"
                className="flex-1"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    继续
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    暂停
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleStop}
                variant="destructive"
                size="lg"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                结束面试
              </Button>
            </div>

            {/* 录音状态指示器 */}
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/30">
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-green-500" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                  <span className="text-sm text-green-600 font-medium">正在录音</span>
                </>
              ) : (
                <>
                  <MicOff className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">录音已停止</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 错误显示 */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{error.message}</p>
            {error.details && (
              <p className="text-xs text-muted-foreground mt-1">
                错误代码: {error.code}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}