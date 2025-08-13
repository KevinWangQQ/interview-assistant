// 📋 统一历史记录界面 - 面试和会议记录分类显示

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Search, 
  Trash2, 
  Eye, 
  Clock,
  User,
  Briefcase,
  Download,
  Calendar,
  FileText,
  Users,
  Filter,
  Star,
  TrendingUp,
  RefreshCw,
  Mic,
  BarChart3
} from 'lucide-react';

// 导入相关服务和类型
import { useInterviewHistoryStore } from '@/store/interview-history-store';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { MeetingSession } from '@/types/meeting';
import { MeetingStorageService } from '@/services/storage/meeting-storage.service';
import { useAuth } from '@/contexts/auth-context';

interface UnifiedHistoryProps {
  className?: string;
  onViewInterview?: (interview: EnhancedInterviewSession) => void;
  onViewMeeting?: (meeting: MeetingSession) => void;
}

interface DateGroup<T> {
  date: string;
  displayName: string;
  items: T[];
}

type RecordType = 'interview' | 'meeting';

export function UnifiedHistory({ 
  className, 
  onViewInterview, 
  onViewMeeting 
}: UnifiedHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<RecordType>('interview');
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [meetingStorageService] = useState(() => new MeetingStorageService());
  
  const { 
    sessions: interviews, 
    loading: interviewsLoading, 
    loadSessions: loadInterviews 
  } = useInterviewHistoryStore();
  
  const { user } = useAuth();

  // 加载会议记录
  useEffect(() => {
    const loadMeetings = () => {
      try {
        const meetingData = meetingStorageService.getAllSessions();
        setMeetings(meetingData);
        console.log('📋 加载会议记录:', meetingData.length);
      } catch (error) {
        console.error('❌ 加载会议记录失败:', error);
      }
    };

    loadMeetings();
  }, [meetingStorageService]);

  // 刷新数据
  const handleRefresh = () => {
    if (activeTab === 'interview') {
      loadInterviews();
    } else {
      const meetingData = meetingStorageService.getAllSessions();
      setMeetings(meetingData);
    }
  };

  // 过滤面试记录
  const filteredInterviews = useMemo(() => {
    if (!searchQuery) return interviews;
    
    const query = searchQuery.toLowerCase();
    return interviews.filter(interview => 
      interview.candidateName.toLowerCase().includes(query) ||
      interview.position.toLowerCase().includes(query) ||
      interview.company?.toLowerCase().includes(query) ||
      interview.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [interviews, searchQuery]);

  // 过滤会议记录
  const filteredMeetings = useMemo(() => {
    if (!searchQuery) return meetings;
    
    const query = searchQuery.toLowerCase();
    return meetings.filter(meeting => 
      meeting.meetingTitle.toLowerCase().includes(query) ||
      meeting.organizer.toLowerCase().includes(query) ||
      meeting.description?.toLowerCase().includes(query) ||
      meeting.participants.some(p => p.name.toLowerCase().includes(query))
    );
  }, [meetings, searchQuery]);

  // 按日期分组 - 面试
  const interviewGroups = useMemo(() => {
    const groups: DateGroup<EnhancedInterviewSession>[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groupedByDate = new Map<string, EnhancedInterviewSession[]>();

    filteredInterviews.forEach(interview => {
      const date = interview.timestamp.toDateString();
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)!.push(interview);
    });

    for (const [dateStr, sessions] of groupedByDate.entries()) {
      const date = new Date(dateStr);
      let displayName = '';

      if (date.toDateString() === today.toDateString()) {
        displayName = '今天';
      } else if (date.toDateString() === yesterday.toDateString()) {
        displayName = '昨天';
      } else if (date > weekAgo) {
        displayName = date.toLocaleDateString('zh-CN', { weekday: 'long' });
      } else {
        displayName = date.toLocaleDateString('zh-CN', { 
          month: 'long', 
          day: 'numeric' 
        });
      }

      groups.push({
        date: dateStr,
        displayName,
        items: sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      });
    }

    return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredInterviews]);

  // 按日期分组 - 会议
  const meetingGroups = useMemo(() => {
    const groups: DateGroup<MeetingSession>[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groupedByDate = new Map<string, MeetingSession[]>();

    filteredMeetings.forEach(meeting => {
      const date = meeting.createdAt.toDateString();
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)!.push(meeting);
    });

    for (const [dateStr, sessions] of groupedByDate.entries()) {
      const date = new Date(dateStr);
      let displayName = '';

      if (date.toDateString() === today.toDateString()) {
        displayName = '今天';
      } else if (date.toDateString() === yesterday.toDateString()) {
        displayName = '昨天';
      } else if (date > weekAgo) {
        displayName = date.toLocaleDateString('zh-CN', { weekday: 'long' });
      } else {
        displayName = date.toLocaleDateString('zh-CN', { 
          month: 'long', 
          day: 'numeric' 
        });
      }

      groups.push({
        date: dateStr,
        displayName,
        items: sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      });
    }

    return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredMeetings]);

  // 删除面试记录
  const handleDeleteInterview = async (interviewId: string) => {
    try {
      // 这里需要调用面试删除方法
      console.log('删除面试记录:', interviewId);
      loadInterviews(); // 重新加载
    } catch (error) {
      console.error('删除面试记录失败:', error);
    }
  };

  // 删除会议记录
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await meetingStorageService.deleteSession(meetingId);
      const updatedMeetings = meetingStorageService.getAllSessions();
      setMeetings(updatedMeetings);
      console.log('✅ 会议记录删除成功');
    } catch (error) {
      console.error('❌ 删除会议记录失败:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}小时${remainingMinutes}分钟`;
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

  const renderInterviewCard = (interview: EnhancedInterviewSession) => (
    <Card key={interview.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            {interview.candidateName}
          </CardTitle>
          <div className="flex items-center gap-1">
            {interview.summary && (
              <Badge variant="secondary" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                已分析
              </Badge>
            )}
            {interview.isBookmarked && (
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {interview.position}
          </div>
          {interview.company && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {interview.company}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(interview.recordingSession.duration)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {interview.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {interview.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{interview.tags.length - 2}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewInterview?.(interview)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteInterview(interview.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderMeetingCard = (meeting: MeetingSession) => (
    <Card key={meeting.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {meeting.meetingTitle}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {getMeetingTypeLabel(meeting.meetingType)}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {meeting.organizer}
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {meeting.participants.length} 人
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(meeting.recordingSession.duration)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {meeting.minutes.keyPoints.length} 要点
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {meeting.minutes.actionItems.length} 行动项
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewMeeting?.(meeting)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteMeeting(meeting.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部统计和控制 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              历史记录
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={interviewsLoading}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
            </div>
          </div>
          
          {/* 搜索栏 */}
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索记录..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 分类显示 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RecordType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="interview" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            面试记录
            <Badge variant="secondary" className="text-xs">
              {interviews.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="meeting" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            会议纪要
            <Badge variant="secondary" className="text-xs">
              {meetings.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* 面试记录 */}
        <TabsContent value="interview" className="space-y-4">
          {interviewGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Mic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">暂无面试记录</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? '没有找到匹配的面试记录' : '开始你的第一次面试录制吧'}
                </p>
              </CardContent>
            </Card>
          ) : (
            interviewGroups.map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">{group.displayName}</h3>
                  <Badge variant="outline" className="text-xs">
                    {group.items.length}
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {group.items.map(renderInterviewCard)}
                </div>
                <Separator className="my-6" />
              </div>
            ))
          )}
        </TabsContent>

        {/* 会议记录 */}
        <TabsContent value="meeting" className="space-y-4">
          {meetingGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">暂无会议记录</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? '没有找到匹配的会议记录' : '开始你的第一次会议录制吧'}
                </p>
              </CardContent>
            </Card>
          ) : (
            meetingGroups.map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">{group.displayName}</h3>
                  <Badge variant="outline" className="text-xs">
                    {group.items.length}
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {group.items.map(renderMeetingCard)}
                </div>
                <Separator className="my-6" />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}