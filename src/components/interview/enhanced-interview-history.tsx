// 📋 增强版面试历史界面 - V2.0多卡片布局，日期分组展示

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Filter,
  Star,
  TrendingUp,
  FileText,
  Target,
  Zap,
  RefreshCw,
  BarChart3,
  Award
} from 'lucide-react';
import { useInterviewHistoryStore } from '@/store/interview-history-store';
import { EnhancedInterviewSession, InterviewSessionFilter } from '@/types/enhanced-interview';
import { useAuth } from '@/contexts/auth-context';

interface EnhancedInterviewHistoryProps {
  className?: string;
  onViewInterview?: (interview: EnhancedInterviewSession) => void;
}

interface DateGroup {
  date: string;
  displayName: string;
  sessions: EnhancedInterviewSession[];
}

type ViewMode = 'all' | 'recent' | 'favorites' | 'with-summaries';
type SortMode = 'date' | 'duration' | 'name' | 'position';

export function EnhancedInterviewHistory({ className, onViewInterview }: EnhancedInterviewHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();
  
  const { sessions, loadSessions, deleteSession, exportSession } = useInterviewHistoryStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 过滤和排序逻辑
  const processedSessions = useMemo(() => {
    let filtered = [...sessions];

    // 基础搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(session =>
        session.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (session.company && session.company.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // 视图模式过滤
    switch (viewMode) {
      case 'recent':
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        filtered = filtered.filter(session => new Date(session.timestamp) >= oneWeekAgo);
        break;
      case 'favorites':
        filtered = filtered.filter(session => session.isBookmarked);
        break;
      case 'with-summaries':
        filtered = filtered.filter(session => !!session.summary);
        break;
      default:
        // 'all' - 不需要额外过滤
        break;
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortMode) {
        case 'date':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        case 'duration':
          return (b.recordingSession.duration || 0) - (a.recordingSession.duration || 0);
        case 'name':
          return a.candidateName.localeCompare(b.candidateName);
        case 'position':
          return a.position.localeCompare(b.position);
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
    });

    return filtered;
  }, [sessions, searchQuery, viewMode, sortMode]);

  // 按日期分组
  const dateGroups = useMemo(() => {
    const groups: { [key: string]: EnhancedInterviewSession[] } = {};
    
    processedSessions.forEach(session => {
      const date = new Date(session.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey: string;
      let displayName: string;
      
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'today';
        displayName = '今天';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'yesterday';
        displayName = '昨天';
      } else if (date >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)) {
        dateKey = `week_${date.toISOString().split('T')[0]}`;
        displayName = date.toLocaleDateString('zh-CN', { 
          month: 'long', 
          day: 'numeric',
          weekday: 'long'
        });
      } else if (date >= new Date(today.getFullYear(), today.getMonth(), 1)) {
        dateKey = 'this_month';
        displayName = '本月早些时候';
      } else if (date >= new Date(today.getFullYear(), today.getMonth() - 1, 1)) {
        dateKey = 'last_month';
        displayName = '上个月';
      } else {
        dateKey = `${date.getFullYear()}-${date.getMonth()}`;
        displayName = date.toLocaleDateString('zh-CN', { 
          year: 'numeric', 
          month: 'long' 
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(session);
    });

    // 转换为数组并排序
    const sortedGroups: DateGroup[] = Object.entries(groups).map(([key, sessions]) => {
      // 确定显示名称
      let displayName = '';
      if (key === 'today') displayName = '今天';
      else if (key === 'yesterday') displayName = '昨天';
      else if (key === 'this_month') displayName = '本月早些时候';
      else if (key === 'last_month') displayName = '上个月';
      else if (key.startsWith('week_')) {
        const date = new Date(key.replace('week_', ''));
        displayName = date.toLocaleDateString('zh-CN', { 
          month: 'long', 
          day: 'numeric',
          weekday: 'long'
        });
      } else {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month));
        displayName = date.toLocaleDateString('zh-CN', { 
          year: 'numeric', 
          month: 'long' 
        });
      }

      return {
        date: key,
        displayName,
        sessions
      };
    });

    // 按时间排序分组
    const groupOrder = ['today', 'yesterday'];
    return sortedGroups.sort((a, b) => {
      const aIndex = groupOrder.indexOf(a.date);
      const bIndex = groupOrder.indexOf(b.date);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      } else if (aIndex !== -1) {
        return -1;
      } else if (bIndex !== -1) {
        return 1;
      } else {
        // 按最新的会话时间排序
        const aLatest = Math.max(...a.sessions.map(s => new Date(s.timestamp).getTime()));
        const bLatest = Math.max(...b.sessions.map(s => new Date(s.timestamp).getTime()));
        return bLatest - aLatest;
      }
    });
  }, [processedSessions]);

  // 统计信息
  const stats = useMemo(() => {
    const total = sessions.length;
    const withSummaries = sessions.filter(s => !!s.summary).length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.recordingSession.duration || 0), 0);
    const averageDuration = total > 0 ? totalDuration / total : 0;
    
    return {
      total,
      withSummaries,
      totalDuration: Math.round(totalDuration / 60), // 转换为分钟
      averageDuration: Math.round(averageDuration / 60)
    };
  }, [sessions]);

  const handleViewInterview = (interview: EnhancedInterviewSession) => {
    onViewInterview?.(interview);
  };

  const handleDeleteInterview = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('确定要删除这个面试记录吗？此操作不可撤销。')) {
      await deleteSession(sessionId);
    }
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
    <div className={`space-y-6 ${className}`}>
      {/* 页面标题和统计 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-7 w-7 text-primary" />
            面试历史
          </h1>
          {user && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>{stats.total} 场面试</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{stats.totalDuration} 分钟</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                <span>{stats.withSummaries} 个总结</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-primary/10' : ''}
          >
            <Filter className="h-4 w-4 mr-1" />
            筛选
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* 筛选和搜索栏 */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索候选人姓名、职位或公司..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* 筛选选项 */}
          {showFilters && (
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  全部
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  最近7天
                </TabsTrigger>
                <TabsTrigger value="with-summaries" className="flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  有总结
                </TabsTrigger>
                <TabsTrigger value="favorites" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  收藏
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* 排序选项 */}
          {showFilters && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>排序方式:</span>
                <div className="flex items-center gap-1">
                  {[
                    { key: 'date', label: '时间', icon: Calendar },
                    { key: 'duration', label: '时长', icon: Clock },
                    { key: 'name', label: '姓名', icon: User },
                    { key: 'position', label: '职位', icon: Briefcase }
                  ].map(({ key, label, icon: Icon }) => (
                    <Button
                      key={key}
                      variant={sortMode === key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setSortMode(key as SortMode)}
                      className="h-7"
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                共 {processedSessions.length} 条记录
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 面试历史列表 - 按日期分组的多卡片布局 */}
      {dateGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">未找到匹配的面试记录</p>
                  <p className="text-sm">尝试修改搜索关键词或筛选条件</p>
                </>
              ) : (
                <>
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">暂无面试记录</p>
                  <p className="text-sm">开始第一次面试吧</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {dateGroups.map((group) => (
            <div key={group.date} className="space-y-4">
              {/* 日期分组标题 */}
              <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground">
                  {group.displayName}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {group.sessions.length} 场
                </Badge>
              </div>
              
              {/* 多卡片网格布局 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {group.sessions.map((session) => (
                  <EnhancedInterviewCard
                    key={session.id}
                    session={session}
                    onView={() => handleViewInterview(session)}
                    onDelete={(e) => handleDeleteInterview(session.id, e)}
                    onExport={(format, e) => exportInterview(session, format, e)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 增强版面试卡片组件
interface EnhancedInterviewCardProps {
  session: EnhancedInterviewSession;
  onView: () => void;
  onDelete: (event: React.MouseEvent) => void;
  onExport: (format: 'json' | 'txt' | 'csv', event: React.MouseEvent) => void;
}

function EnhancedInterviewCard({
  session,
  onView,
  onDelete,
  onExport
}: EnhancedInterviewCardProps) {
  const formatDuration = (duration: number) => {
    if (!duration) return '未知时长';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
  };

  const formatTime = (timestamp: Date | string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      recording: { variant: 'default' as const, label: '录制中', className: 'bg-green-500 text-white' },
      paused: { variant: 'secondary' as const, label: '已暂停', className: 'bg-orange-500 text-white' },
      stopped: { variant: 'outline' as const, label: '已停止', className: '' },
      completed: { variant: 'outline' as const, label: '已完成', className: 'bg-blue-50 text-blue-700 border-blue-200' }
    };
    return configs[status as keyof typeof configs] || configs.completed;
  };

  const statusConfig = getStatusConfig(session.recordingSession.status);

  // 检查是否有岗位评估
  const hasPositionAssessment = !!(session.summary as any)?.positionAssessment;
  
  return (
    <Card className="h-40 hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-primary/20 hover:border-l-primary" onClick={onView}>
      <CardContent className="p-4 h-full flex flex-col justify-between">
        {/* 顶部：候选人信息和状态 */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-base truncate">{session.candidateName}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                <span className="truncate">{session.position}</span>
              </div>
            </div>
            
            <Badge 
              variant={statusConfig.variant} 
              className={`${statusConfig.className} text-xs flex-shrink-0`}
            >
              {statusConfig.label}
            </Badge>
          </div>

          {/* 面试时间和时长 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatTime(session.timestamp)}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              <span>{formatDuration(session.recordingSession.duration)}</span>
            </div>
          </div>

          {/* 总结预览和亮点 */}
          <div className="space-y-2">
            {session.summary && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1">
                <p className="line-clamp-2 leading-relaxed">
                  {session.summary.executiveSummary}
                </p>
              </div>
            )}
            
            {/* V2.0功能标识 */}
            <div className="flex items-center gap-1 flex-wrap">
              {session.summary && (
                <Badge variant="outline" className="text-xs h-5">
                  <Award className="h-2.5 w-2.5 mr-1" />
                  有总结
                </Badge>
              )}
              {hasPositionAssessment && (
                <Badge variant="outline" className="text-xs h-5 bg-purple-50 text-purple-700 border-purple-200">
                  <Target className="h-2.5 w-2.5 mr-1" />
                  岗位匹配
                </Badge>
              )}
              {session.positionTemplateId && (
                <Badge variant="outline" className="text-xs h-5 bg-blue-50 text-blue-700 border-blue-200">
                  <Zap className="h-2.5 w-2.5 mr-1" />
                  智能评估
                </Badge>
              )}
              {session.isBookmarked && (
                <Badge variant="outline" className="text-xs h-5 bg-yellow-50 text-yellow-700 border-yellow-200">
                  <Star className="h-2.5 w-2.5 mr-1" />
                  已收藏
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 底部：快速操作按钮 */}
        <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => onExport('json', e)}
            title="导出"
            className="h-7 w-7 p-0 hover:bg-primary/10"
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            title="查看详情"
            className="h-7 w-7 p-0 hover:bg-primary/10"
          >
            <Eye className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            title="删除"
            className="h-7 w-7 p-0 hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default EnhancedInterviewHistory;