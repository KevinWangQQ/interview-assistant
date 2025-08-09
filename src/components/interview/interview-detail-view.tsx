'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft,
  User, 
  Briefcase,
  Building,
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';

interface InterviewDetailViewProps {
  interview: EnhancedInterviewSession;
  onBack: () => void;
}

export function InterviewDetailView({ interview, onBack }: InterviewDetailViewProps) {
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}分${seconds}秒`;
  };

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 头部导航 */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回历史记录
        </Button>
        <h1 className="text-2xl font-bold">面试详情</h1>
        {getStatusBadge(interview.recordingSession.status)}
      </div>

      {/* 基本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                候选人姓名
              </div>
              <div className="font-medium text-lg">{interview.candidateName}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                应聘职位
              </div>
              <div className="font-medium">{interview.position}</div>
            </div>
            
            {interview.company && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  公司
                </div>
                <div className="font-medium">{interview.company}</div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                面试时间
              </div>
              <div className="font-medium">{formatDate(interview.timestamp)}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                面试时长
              </div>
              <div className="font-medium">{formatDuration(interview.recordingSession.duration)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            统计信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{interview.statistics.totalWords}</div>
              <div className="text-sm text-muted-foreground">总词数</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{interview.statistics.totalQuestions}</div>
              <div className="text-sm text-muted-foreground">问题数</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{interview.statistics.speakerChangeCount}</div>
              <div className="text-sm text-muted-foreground">说话人切换</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(interview.statistics.averageSegmentDuration)}s
              </div>
              <div className="text-sm text-muted-foreground">平均片段时长</div>
            </div>
          </div>
          
          {/* 说话时间分布 */}
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">说话时间分布</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">面试官</span>
                <span className="text-sm font-medium">
                  {Math.round(interview.statistics.speakingTimeDistribution.interviewer / 60)}分钟
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">候选人</span>
                <span className="text-sm font-medium">
                  {Math.round(interview.statistics.speakingTimeDistribution.candidate / 60)}分钟
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">未识别</span>
                <span className="text-sm font-medium">
                  {Math.round(interview.statistics.speakingTimeDistribution.unknown / 60)}分钟
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 面试总结（如果有的话） */}
      {interview.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              AI面试总结
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">执行摘要</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {interview.summary.executiveSummary}
                </p>
              </div>
              
              {interview.summary.recommendation && (
                <div>
                  <h4 className="font-medium mb-2">推荐决策</h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={
                        interview.summary.recommendation.decision === 'strongly_recommend' || 
                        interview.summary.recommendation.decision === 'recommend' ? 'default' :
                        interview.summary.recommendation.decision === 'neutral' ? 'secondary' : 'destructive'
                      }>
                        {interview.summary.recommendation.decision === 'strongly_recommend' ? '强烈推荐' :
                         interview.summary.recommendation.decision === 'recommend' ? '推荐录用' :
                         interview.summary.recommendation.decision === 'neutral' ? '中性' :
                         interview.summary.recommendation.decision === 'not_recommend' ? '不推荐' : '强烈不推荐'}
                      </Badge>
                    </div>
                    <p className="text-sm">{interview.summary.recommendation.reasoning}</p>
                  </div>
                </div>
              )}
              
              {interview.summary.keyInsights && (
                <div className="space-y-4">
                  {interview.summary.keyInsights.standoutMoments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">突出表现</h4>
                      <ul className="space-y-1">
                        {interview.summary.keyInsights.standoutMoments.map((moment, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-600">✓</span>
                            <span>
                              {typeof moment === 'string' ? moment : moment.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {((interview.summary.keyInsights as any).concerningAreas?.length > 0 || 
                    (interview.summary.keyInsights as any).redFlags?.length > 0 || 
                    (interview.summary.keyInsights as any).developmentAreas?.length > 0) && (
                    <div>
                      <h4 className="font-medium mb-2">关注点</h4>
                      <ul className="space-y-1">
                        {/* Legacy concerningAreas */}
                        {(interview.summary.keyInsights as any).concerningAreas?.map((area: string, index: number) => (
                          <li key={`concern-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-orange-600">⚠</span>
                            <span>{area}</span>
                          </li>
                        ))}
                        
                        {/* Enhanced redFlags */}
                        {(interview.summary.keyInsights as any).redFlags?.map((flag: any, index: number) => (
                          <li key={`flag-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-red-600">🚩</span>
                            <span>{flag.area}: {flag.description}</span>
                          </li>
                        ))}
                        
                        {/* Enhanced developmentAreas */}
                        {(interview.summary.keyInsights as any).developmentAreas?.map((area: string, index: number) => (
                          <li key={`dev-${index}`} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-blue-600">📈</span>
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {(interview.summary.keyInsights as any).improvementSuggestions?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">改进建议</h4>
                      <ul className="space-y-1">
                        {(interview.summary.keyInsights as any).improvementSuggestions?.map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-blue-600">💡</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 转录内容 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            转录内容
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] w-full">
            <div className="space-y-4">
              {interview.segments.map((segment, index) => (
                <div key={index} className="border-l-4 border-primary/20 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {segment.speaker === 'interviewer' ? '面试官' : 
                       segment.speaker === 'candidate' ? '候选人' : '未知'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(segment.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium text-blue-700">英文：</span>
                      {segment.englishText}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-green-700">中文：</span>
                      {segment.chineseText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}