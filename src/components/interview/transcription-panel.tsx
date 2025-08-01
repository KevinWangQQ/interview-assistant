'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, User, Mic } from 'lucide-react';
import { TranscriptionSegment } from '@/types';
import { useInterviewStore } from '@/store/interview-store';

interface TranscriptionPanelProps {
  className?: string;
}

export function TranscriptionPanel({ className }: TranscriptionPanelProps) {
  const segments = useInterviewStore(state => state.segments);
  const isProcessingAudio = useInterviewStore(state => state.isProcessingAudio);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [segments]);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* 英文原文面板 */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5" />
            English Original
            {isProcessingAudio && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-4">
              {segments.map((segment) => (
                <SegmentDisplay
                  key={segment.id}
                  segment={segment}
                  showOriginal={true}
                />
              ))}
              {segments.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start recording to see transcription</p>
                    <p className="text-sm mt-2">开始录音以查看转录内容</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中文翻译面板 */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            中文翻译
            {useInterviewStore(state => state.isTranslating) && (
              <Loader2 className="h-4 w-4 animate-spin text-green-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              {segments.map((segment) => (
                <SegmentDisplay
                  key={`${segment.id}-translation`}
                  segment={segment}
                  showOriginal={false}
                />
              ))}
              {segments.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Translations will appear here</p>
                    <p className="text-sm mt-2">翻译内容将显示在这里</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

interface SegmentDisplayProps {
  segment: TranscriptionSegment;
  showOriginal: boolean;
}

function SegmentDisplay({ segment, showOriginal }: SegmentDisplayProps) {
  const text = showOriginal ? segment.originalText : segment.translatedText;
  const isProcessing = segment.isProcessing && !showOriginal;

  if (!text && !isProcessing) {
    return null;
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSpeakerIcon = (speaker: 'interviewer' | 'candidate') => {
    return speaker === 'interviewer' ? (
      <User className="h-4 w-4 text-blue-500" />
    ) : (
      <Mic className="h-4 w-4 text-green-500" />
    );
  };

  const getSpeakerLabel = (speaker: 'interviewer' | 'candidate') => {
    return speaker === 'interviewer' ? '面试官' : '候选人';
  };

  return (
    <div className="border rounded-lg p-4 space-y-2">
      {/* 头部信息 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          {getSpeakerIcon(segment.speaker)}
          <span>{getSpeakerLabel(segment.speaker)}</span>
          {segment.confidence && showOriginal && (
            <Badge variant="secondary" className="text-xs">
              {Math.round(segment.confidence * 100)}%
            </Badge>
          )}
        </div>
        <span>{formatTime(segment.timestamp)}</span>
      </div>

      {/* 内容 */}
      <div className="text-base leading-relaxed">
        {isProcessing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">
              {showOriginal ? 'Processing...' : '翻译中...'}
            </span>
          </div>
        ) : (
          <p className={showOriginal ? 'font-mono' : 'font-sans'}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}