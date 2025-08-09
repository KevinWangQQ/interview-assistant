// 🔔 数据迁移提醒 - 自动显示迁移建议

'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  X, 
  Clock,
  Database,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface MigrationReminderProps {
  onStartMigration?: () => void;
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'minimal';
}

export function MigrationReminder({ 
  onStartMigration, 
  onDismiss,
  variant = 'banner' 
}: MigrationReminderProps) {
  const { migrationStatus, migrationChecked } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // 只在有迁移需求且未被关闭时显示
  if (!migrationChecked || !migrationStatus?.needsMigration || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleStartMigration = () => {
    onStartMigration?.();
  };

  // Banner样式（顶部横幅）
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <span className="font-medium">数据升级可用</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-blue-100">
              <div className="flex items-center gap-1">
                <Database className="h-4 w-4" />
                <span className="text-sm">{migrationStatus.localSessionsCount} 个本地面试</span>
              </div>
              <span className="text-blue-200">→</span>
              <span className="text-sm">云端同步保护</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStartMigration}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              立即升级
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Card样式（卡片式）
  if (variant === 'card') {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Upload className="h-4 w-4" />
        <div className="flex items-center justify-between w-full">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertDescription className="font-medium">
                发现 {migrationStatus.localSessionsCount} 个本地面试会话
              </AlertDescription>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                可升级
              </Badge>
            </div>
            <AlertDescription className="text-sm text-gray-600">
              迁移到云端后，您的面试数据将在多设备间同步，并享受自动备份保护。
              {migrationStatus.lastMigrationTime && (
                <span className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  上次迁移: {migrationStatus.lastMigrationTime.toLocaleDateString()}
                </span>
              )}
            </AlertDescription>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Button size="sm" onClick={handleStartMigration}>
              开始迁移
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  // Minimal样式（最小化显示）
  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-800">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            {migrationStatus.localSessionsCount} 个面试可迁移到云端
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleStartMigration}
            className="text-amber-700 border-amber-300 hover:bg-amber-100"
          >
            迁移
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDismiss}
            className="text-amber-600 hover:bg-amber-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default MigrationReminder;