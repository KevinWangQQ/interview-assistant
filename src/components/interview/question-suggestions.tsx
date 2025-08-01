'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Lightbulb, 
  RefreshCw, 
  Copy, 
  Check,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useInterviewStore } from '@/store/interview-store';
import { QuestionSuggestion } from '@/types';

interface QuestionSuggestionsProps {
  className?: string;
}

export function QuestionSuggestions({ className }: QuestionSuggestionsProps) {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);
  
  const {
    questionSuggestions,
    isLoadingSuggestions,
    loadQuestionSuggestions,
    segments
  } = useInterviewStore();

  const handleCopyQuestion = async (question: QuestionSuggestion) => {
    const textToCopy = `${question.question}\n${question.questionChinese}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedQuestion(question.id);
      setTimeout(() => setCopiedQuestion(null), 2000);
    } catch (error) {
      console.warn('Failed to copy question:', error);
    }
  };

  const toggleExpand = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'technical': '技术问题',
      'behavioral': '行为问题',
      'experience': '经验问题',
      'follow-up': '跟进问题'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'technical': 'bg-blue-100 text-blue-800',
      'behavioral': 'bg-green-100 text-green-800',
      'experience': 'bg-purple-100 text-purple-800',
      'follow-up': 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const hasContext = segments.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            问题建议
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadQuestionSuggestions}
            disabled={isLoadingSuggestions || !hasContext}
          >
            {isLoadingSuggestions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasContext ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>开始面试后将根据对话内容生成问题建议</p>
          </div>
        ) : isLoadingSuggestions ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-muted-foreground">正在生成问题建议...</p>
          </div>
        ) : questionSuggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无问题建议</p>
            <p className="text-sm mt-2">点击刷新按钮重新生成</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {questionSuggestions.map((suggestion) => (
                <QuestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isExpanded={expandedQuestion === suggestion.id}
                  isCopied={copiedQuestion === suggestion.id}
                  onToggleExpand={() => toggleExpand(suggestion.id)}
                  onCopy={() => handleCopyQuestion(suggestion)}
                  getCategoryLabel={getCategoryLabel}
                  getCategoryColor={getCategoryColor}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

interface QuestionCardProps {
  suggestion: QuestionSuggestion;
  isExpanded: boolean;
  isCopied: boolean;
  onToggleExpand: () => void;
  onCopy: () => void;
  getCategoryLabel: (category: string) => string;
  getCategoryColor: (category: string) => string;
}

function QuestionCard({
  suggestion,
  isExpanded,
  isCopied,
  onToggleExpand,
  onCopy,
  getCategoryLabel,
  getCategoryColor
}: QuestionCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Badge className={getCategoryColor(suggestion.category)}>
            {getCategoryLabel(suggestion.category)}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>相关度:</span>
            <span className="font-mono">
              {Math.round(suggestion.relevanceScore * 100)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            disabled={isCopied}
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 问题内容 */}
      <div className="space-y-2">
        <div className="text-base font-medium text-foreground">
          {suggestion.question}
        </div>
        <div className="text-base text-muted-foreground">
          {suggestion.questionChinese}
        </div>
      </div>

      {/* 展开的上下文信息 */}
      {isExpanded && suggestion.context && (
        <div className="mt-4 pt-3 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">基于上下文:</span>
            <div className="mt-2 p-3 bg-muted/50 rounded text-xs font-mono leading-relaxed max-h-32 overflow-y-auto">
              {suggestion.context}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}