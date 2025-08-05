'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  History, 
  Search, 
  Trash2, 
  Eye, 
  Calendar,
  Clock,
  User,
  Briefcase,
  FileText,
  Download,
  ChevronDown
} from 'lucide-react';
import { useInterviewHistoryStore } from '@/store/interview-history-store';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';

interface InterviewHistoryProps {
  className?: string;
  onViewInterview?: (interview: EnhancedInterviewSession) => void;
}

export function InterviewHistory({ className, onViewInterview }: InterviewHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInterview, setSelectedInterview] = useState<EnhancedInterviewSession | null>(null);
  
  const { sessions, loadSessions, deleteSession, exportSession } = useInterviewHistoryStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions.filter(session =>
    session.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (session.company && session.company.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (session: EnhancedInterviewSession) => {
    const duration = session.recordingSession.duration;
    if (!duration) return '未知时长';
    
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    
    return `${minutes}分${seconds}秒`;
  };

  const getStatusBadge = (session: EnhancedInterviewSession) => {
    const status = session.recordingSession.status;
    const statusConfig = {
      recording: { variant: 'default' as const, label: '录制中', className: 'bg-green-500' },
      paused: { variant: 'secondary' as const, label: '已暂停', className: '' },
      stopped: { variant: 'outline' as const, label: '已停止', className: '' },
      completed: { variant: 'outline' as const, label: '已完成', className: '' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleDeleteInterview = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (confirm('确定要删除这个面试记录吗？此操作不可撤销。')) {
      await deleteSession(sessionId);
    }
  };

  const handleViewInterview = (interview: EnhancedInterviewSession) => {
    setSelectedInterview(interview);
    onViewInterview?.(interview);
  };

  const exportInterview = async (interview: EnhancedInterviewSession, format: 'json' | 'txt' | 'csv', event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      await exportSession(interview.id, format);
    } catch (error) {
      console.error('导出失败:', error);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History className="h-5 w-5" />
            面试历史记录
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
          >
            刷新
          </Button>
        </CardTitle>
        
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索候选人姓名或职位..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>未找到匹配的面试记录</p>
                <p className="text-sm mt-2">尝试修改搜索关键词</p>
              </>
            ) : (
              <>
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无面试记录</p>
                <p className="text-sm mt-2">开始第一次面试吧</p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <InterviewCard
                  key={session.id}
                  session={session}
                  isSelected={selectedInterview?.id === session.id}
                  onView={() => handleViewInterview(session)}
                  onDelete={(e) => handleDeleteInterview(session.id, e)}
                  onExport={(format, e) => exportInterview(session, format, e)}
                  formatDate={formatDate}
                  formatDuration={formatDuration}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface InterviewCardProps {
  session: EnhancedInterviewSession;
  isSelected: boolean;
  onView: () => void;
  onDelete: (event: React.MouseEvent) => void;
  onExport: (format: 'json' | 'txt' | 'csv', event: React.MouseEvent) => void;
  formatDate: (date: Date | string) => string;
  formatDuration: (session: EnhancedInterviewSession) => string;
  getStatusBadge: (session: EnhancedInterviewSession) => React.ReactNode;
}

function InterviewCard({
  session,
  isSelected,
  onView,
  onDelete,
  onExport,
  formatDate,
  formatDuration,
  getStatusBadge
}: InterviewCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all hover:bg-muted/50 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusBadge(session)}
          <span className="text-sm text-muted-foreground">
            {formatDate(session.timestamp)}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onExport('json', e)}
            title="导出为 JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            title="查看详情"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="删除记录"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-base font-medium">
          <User className="h-4 w-4 text-blue-500" />
          <span>{session.candidateName}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          <span>{session.position}</span>
          {session.company && (
            <>
              <span>·</span>
              <span>{session.company}</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(session)}</span>
          </div>
        </div>

        {session.summary && (
          <div className="mt-3 p-2 bg-muted/30 rounded text-sm">
            <p className="line-clamp-2">{session.summary.executiveSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
}