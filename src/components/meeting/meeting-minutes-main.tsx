// 📋 会议纪要主界面 - 专业会议录制和纪要生成

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useMeetingStore } from '@/store/meeting-store';
import { Participant } from '@/types/meeting';
import { 
  Play, 
  Pause, 
  Square, 
  Mic, 
  MicOff, 
  Users, 
  Clock, 
  FileText, 
  Download,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  RotateCcw,
  Plus,
  Calendar
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MeetingSetupInfo {
  title: string;
  type: 'regular' | 'project' | 'emergency' | 'review' | 'brainstorm' | 'standup';
  organizer: string;
  description?: string;
  participants: Participant[];
}

export function MeetingMinutesMain() {
  const {
    isActive,
    isPaused,
    isProcessing,
    currentTranscript,
    currentMinutes,
    isGeneratingMinutes,
    transcriptSegments,
    participants,
    currentSpeaker,
    error,
    startMeeting,
    stopMeeting,
    pauseMeeting,
    resumeMeeting,
    updateMinutes,
    regenerateMinutes,
    addManualNote,
    saveMeeting,
    exportMeeting,
    clearError
  } = useMeetingStore();

  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [meetingSetup, setMeetingSetup] = useState<MeetingSetupInfo>({
    title: '',
    type: 'regular',
    organizer: '',
    description: '',
    participants: []
  });
  const [newParticipantName, setNewParticipantName] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const minutesScrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到转录底部
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [currentTranscript, transcriptSegments]);

  // 自动滚动到纪要底部
  useEffect(() => {
    if (minutesScrollRef.current && currentMinutes) {
      minutesScrollRef.current.scrollTop = minutesScrollRef.current.scrollHeight;
    }
  }, [currentMinutes]);

  const handleStartMeeting = async () => {
    if (!meetingSetup.title || !meetingSetup.organizer) {
      return;
    }

    try {
      await startMeeting(meetingSetup);
      setSetupDialogOpen(false);
    } catch (error) {
      console.error('启动会议失败:', error);
    }
  };

  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;

    const newParticipant: Participant = {
      id: `participant-${Date.now()}`,
      name: newParticipantName.trim(),
      joinTime: new Date(),
      participationLevel: 'medium'
    };

    setMeetingSetup(prev => ({
      ...prev,
      participants: [...prev.participants, newParticipant]
    }));
    setNewParticipantName('');
  };

  const handleRemoveParticipant = (participantId: string) => {
    setMeetingSetup(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p.id !== participantId)
    }));
  };

  const handleAddManualNote = () => {
    if (!manualNote.trim()) return;
    addManualNote(manualNote.trim());
    setManualNote('');
  };

  const handleExport = async (format: 'markdown' | 'html' | 'txt' | 'json') => {
    try {
      await exportMeeting(format);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  const getMeetingTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'regular': '定期会议',
      'project': '项目会议',
      'emergency': '紧急会议',
      'review': '评审会议',
      'brainstorm': '头脑风暴',
      'standup': '站会/晨会'
    };
    return typeLabels[type] || type;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError}>
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 控制面板 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              会议纪要系统
            </CardTitle>
            <div className="flex items-center gap-2">
              {isActive && (
                <Badge variant={isPaused ? 'secondary' : 'default'}>
                  {isPaused ? '已暂停' : '录制中'}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {!isActive ? (
              <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    开始会议录制
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>会议设置</DialogTitle>
                    <DialogDescription>
                      请填写会议基本信息，系统将自动生成会议纪要
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="title">会议标题 *</Label>
                        <Input
                          id="title"
                          value={meetingSetup.title}
                          onChange={(e) => setMeetingSetup(prev => ({
                            ...prev,
                            title: e.target.value
                          }))}
                          placeholder="例：产品需求评审会议"
                        />
                      </div>
                      <div>
                        <Label htmlFor="organizer">组织者 *</Label>
                        <Input
                          id="organizer"
                          value={meetingSetup.organizer}
                          onChange={(e) => setMeetingSetup(prev => ({
                            ...prev,
                            organizer: e.target.value
                          }))}
                          placeholder="例：张三"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="type">会议类型</Label>
                        <Select
                          value={meetingSetup.type}
                          onValueChange={(value: any) => setMeetingSetup(prev => ({
                            ...prev,
                            type: value
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">定期会议</SelectItem>
                            <SelectItem value="project">项目会议</SelectItem>
                            <SelectItem value="emergency">紧急会议</SelectItem>
                            <SelectItem value="review">评审会议</SelectItem>
                            <SelectItem value="brainstorm">头脑风暴</SelectItem>
                            <SelectItem value="standup">站会/晨会</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">会议描述（可选）</Label>
                      <Textarea
                        id="description"
                        value={meetingSetup.description}
                        onChange={(e) => setMeetingSetup(prev => ({
                          ...prev,
                          description: e.target.value
                        }))}
                        placeholder="简要描述会议目的和议程..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>参会人员</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          value={newParticipantName}
                          onChange={(e) => setNewParticipantName(e.target.value)}
                          placeholder="输入参会人员姓名"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                        />
                        <Button type="button" onClick={handleAddParticipant}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {meetingSetup.participants.map(participant => (
                          <Badge
                            key={participant.id}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => handleRemoveParticipant(participant.id)}
                          >
                            {participant.name} ✕
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setSetupDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleStartMeeting}
                        disabled={!meetingSetup.title || !meetingSetup.organizer}
                      >
                        开始录制
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant={isPaused ? 'default' : 'secondary'}
                  onClick={isPaused ? resumeMeeting : pauseMeeting}
                >
                  {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {isPaused ? '继续' : '暂停'}
                </Button>
                <Button variant="destructive" onClick={stopMeeting}>
                  <Square className="h-4 w-4 mr-2" />
                  结束会议
                </Button>
                <Button variant="outline" onClick={saveMeeting}>
                  💾 保存
                </Button>
              </div>
            )}

            {/* 状态指示器 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Mic className="h-4 w-4 text-green-500 animate-pulse" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
                <span>音频</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{participants.length}</span>
              </div>
              {isActive && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>进行中</span>
                </div>
              )}
            </div>
          </div>

          {/* 快捷操作 */}
          {isActive && (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={updateMinutes}
                disabled={isGeneratingMinutes}
              >
                {isGeneratingMinutes ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                更新纪要
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateMinutes}
              >
                重新生成
              </Button>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('markdown')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  MD
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('txt')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  TXT
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 主要内容区域 - 上下布局（70% 转录，30% 纪要）*/}
      <div className="flex-1 grid grid-rows-[7fr,3fr] gap-4 min-h-0">
        {/* 转录区域 (70%) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>实时转录</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {transcriptSegments.length > 0 && (
                  <Badge variant="outline">
                    {transcriptSegments.reduce((sum, seg) => 
                      sum + seg.text.split(/\s+/).filter(w => w.length > 0).length, 0
                    )} 词
                  </Badge>
                )}
                {currentSpeaker && (
                  <Badge variant="secondary">
                    当前: {currentSpeaker}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-full" ref={transcriptScrollRef}>
              <div className="space-y-3">
                {/* 已完成的转录段落 */}
                {transcriptSegments.map((segment) => (
                  <div key={segment.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {segment.speaker}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {segment.startTime.toLocaleTimeString()}
                      </span>
                      {segment.confidence && (
                        <Badge
                          variant={segment.confidence > 0.8 ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {Math.round(segment.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                  </div>
                ))}
                
                {/* 当前实时转录 */}
                {currentTranscript && (
                  <div className="p-3 rounded-lg bg-primary/10 border-l-4 border-primary">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" className="text-xs">
                        实时
                      </Badge>
                      {isProcessing && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{currentTranscript}</p>
                  </div>
                )}
                
                {/* 空状态 */}
                {!isActive && transcriptSegments.length === 0 && !currentTranscript && (
                  <div className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>点击"开始会议录制"开始实时转录</p>
                    <p className="text-sm mt-1">系统将自动识别语音并生成会议纪要</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 会议纪要区域 (30%) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>会议纪要</span>
              <div className="flex items-center gap-2">
                {isGeneratingMinutes && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>生成中...</span>
                  </div>
                )}
                {currentMinutes && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(currentMinutes.length / 100)} 段
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-full" ref={minutesScrollRef}>
              {currentMinutes ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {currentMinutes}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>会议纪要将在转录开始后自动生成</p>
                  <p className="text-xs mt-1">每2分钟自动更新一次</p>
                </div>
              )}
            </ScrollArea>
            
            {/* 手动备注输入 */}
            {isActive && (
              <>
                <Separator className="my-3" />
                <div className="flex gap-2">
                  <Input
                    placeholder="添加手动备注..."
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddManualNote()}
                    className="flex-1 text-sm"
                  />
                  <Button size="sm" onClick={handleAddManualNote}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}