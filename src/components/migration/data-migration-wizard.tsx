// 🔄 数据迁移向导 - 引导用户从localStorage迁移到Supabase

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2,
  FileText,
  Users,
  Calendar,
  BarChart3,
  Cloud,
  HardDrive,
  ArrowRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { DataMigrationService, MigrationProgress, MigrationResult, MigrationOptions } from '@/services/migration/data-migration-service';
import { useAuth } from '@/contexts/auth-context';

interface MigrationWizardProps {
  onComplete?: (result: MigrationResult) => void;
  onCancel?: () => void;
}

interface MigrationCheck {
  needsMigration: boolean;
  localSessionsCount: number;
  cloudSessionsCount: number;
  lastMigrationTime?: Date;
}

export function DataMigrationWizard({ onComplete, onCancel }: MigrationWizardProps) {
  const { user } = useAuth();
  const [migrationService] = useState(new DataMigrationService());
  const [currentStep, setCurrentStep] = useState<'check' | 'options' | 'migrate' | 'complete'>('check');
  const [migrationCheck, setMigrationCheck] = useState<MigrationCheck | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 迁移选项
  const [migrationOptions, setMigrationOptions] = useState<MigrationOptions>({
    dryRun: false,
    overwrite: false,
    batchSize: 10,
    skipValidation: false,
    preserveTimestamps: true
  });

  // 清理选项
  const [cleanupAfterMigration, setCleanupAfterMigration] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  useEffect(() => {
    if (user) {
      checkMigrationNeed();
    }
  }, [user]);

  const checkMigrationNeed = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await migrationService.needsMigration();
      setMigrationCheck(result);
      console.log('🔍 迁移检查结果:', result);
    } catch (error) {
      console.error('❌ 检查迁移需求失败:', error);
      setError(error instanceof Error ? error.message : '检查失败');
    } finally {
      setIsLoading(false);
    }
  };

  const startMigration = async () => {
    if (!migrationCheck?.needsMigration && !migrationOptions.dryRun) {
      setError('无需进行数据迁移');
      return;
    }

    try {
      setCurrentStep('migrate');
      setIsLoading(true);
      setError(null);

      const options: MigrationOptions = {
        ...migrationOptions,
        onProgress: (progress: MigrationProgress) => {
          setMigrationProgress(progress);
          console.log('📊 迁移进度:', progress);
        }
      };

      console.log('🚀 开始数据迁移...', options);
      const result = await migrationService.migrateData(options);
      
      setMigrationResult(result);
      setCurrentStep('complete');

      // 如果迁移成功且用户选择清理本地数据
      if (result.success && cleanupAfterMigration && confirmCleanup) {
        await handleCleanupLocalData();
      }

      onComplete?.(result);

    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
      setError(error instanceof Error ? error.message : '迁移失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupLocalData = async () => {
    try {
      console.log('🧹 开始清理本地数据...');
      const result = await migrationService.cleanupLocalData('CONFIRM_DELETE_LOCAL_DATA');
      console.log('🧹 本地数据清理结果:', result);
    } catch (error) {
      console.error('❌ 清理本地数据失败:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 检查阶段
  if (currentStep === 'check') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            数据迁移检查
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>正在检查本地和云端数据...</span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {migrationCheck && !isLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <HardDrive className="h-4 w-4" />
                      本地数据
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {migrationCheck.localSessionsCount}
                    </div>
                    <div className="text-sm text-blue-600">个面试会话</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <Cloud className="h-4 w-4" />
                      云端数据
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {migrationCheck.cloudSessionsCount}
                    </div>
                    <div className="text-sm text-green-600">个面试会话</div>
                  </div>
                </div>
              </div>

              {migrationCheck.lastMigrationTime && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  上次迁移时间: {migrationCheck.lastMigrationTime.toLocaleString()}
                </div>
              )}

              <div className="border-t pt-4">
                {migrationCheck.needsMigration ? (
                  <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertDescription>
                      检测到本地有 <strong>{migrationCheck.localSessionsCount}</strong> 个面试会话需要迁移到云端。
                      迁移后您的数据将在多设备间同步，并享受云端备份保护。
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      您的数据已经是最新的，无需进行迁移。
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={onCancel}>
                  取消
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={checkMigrationNeed}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重新检查
                  </Button>
                  {migrationCheck.needsMigration && (
                    <Button onClick={() => setCurrentStep('options')}>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      继续迁移
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 选项配置阶段
  if (currentStep === 'options') {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            迁移配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="migration" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="migration">迁移选项</TabsTrigger>
              <TabsTrigger value="cleanup">清理选项</TabsTrigger>
            </TabsList>

            <TabsContent value="migration" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">仅预演模式</div>
                    <div className="text-sm text-gray-600">分析数据但不实际迁移</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={migrationOptions.dryRun}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      dryRun: e.target.checked
                    }))}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">覆盖云端数据</div>
                    <div className="text-sm text-gray-600">替换已存在的面试会话</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={migrationOptions.overwrite}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      overwrite: e.target.checked
                    }))}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">保持原始时间</div>
                    <div className="text-sm text-gray-600">保留面试的原始时间戳</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={migrationOptions.preserveTimestamps}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      preserveTimestamps: e.target.checked
                    }))}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">跳过数据验证</div>
                    <div className="text-sm text-gray-600">加快迁移速度（不推荐）</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={migrationOptions.skipValidation}
                    onChange={(e) => setMigrationOptions(prev => ({
                      ...prev,
                      skipValidation: e.target.checked
                    }))}
                    className="h-4 w-4"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">批处理大小: {migrationOptions.batchSize}</label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={migrationOptions.batchSize}
                  onChange={(e) => setMigrationOptions(prev => ({
                    ...prev,
                    batchSize: parseInt(e.target.value)
                  }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-600">
                  较小的批处理大小更稳定，较大的批处理大小更快
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cleanup" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      迁移后清理本地数据
                    </div>
                    <div className="text-sm text-gray-600">删除localStorage中的面试数据</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={cleanupAfterMigration}
                    onChange={(e) => setCleanupAfterMigration(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                {cleanupAfterMigration && (
                  <div className="pl-4 space-y-2">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>警告:</strong> 清理本地数据是不可逆的操作。
                        请确保迁移成功后再执行清理。
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={confirmCleanup}
                        onChange={(e) => setConfirmCleanup(e.target.checked)}
                        className="h-4 w-4"
                        id="confirm-cleanup"
                      />
                      <label htmlFor="confirm-cleanup" className="text-sm font-medium">
                        我确认要删除本地数据（仅在迁移成功后）
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-6 border-t">
            <Button variant="outline" onClick={() => setCurrentStep('check')}>
              返回
            </Button>
            <Button onClick={startMigration} disabled={isLoading}>
              {migrationOptions.dryRun ? (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  开始预演
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  开始迁移
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 迁移进行中阶段
  if (currentStep === 'migrate') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            {migrationOptions.dryRun ? '数据分析中' : '数据迁移中'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {migrationProgress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{migrationProgress.message}</span>
                  <span>{Math.round(migrationProgress.progress)}%</span>
                </div>
                <Progress value={migrationProgress.progress} className="h-2" />
                <div className="text-xs text-gray-600 text-center">
                  {migrationProgress.processedItems}/{migrationProgress.totalItems} 已处理
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Badge variant={
                  migrationProgress.stage === 'completed' ? 'default' :
                  migrationProgress.stage === 'failed' ? 'destructive' :
                  'secondary'
                }>
                  {migrationProgress.stage === 'scanning' && '📋 扫描数据'}
                  {migrationProgress.stage === 'analyzing' && '🔍 分析数据'}
                  {migrationProgress.stage === 'migrating' && '📤 迁移数据'}
                  {migrationProgress.stage === 'verifying' && '✅ 验证结果'}
                  {migrationProgress.stage === 'completed' && '🎉 迁移完成'}
                  {migrationProgress.stage === 'failed' && '❌ 迁移失败'}
                </Badge>
              </div>

              {migrationProgress.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-orange-700">遇到的问题:</h4>
                  <div className="max-h-32 overflow-y-auto">
                    {migrationProgress.errors.map((error, idx) => (
                      <div key={idx} className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // 完成阶段
  if (currentStep === 'complete' && migrationResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {migrationResult.success ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-600" />
                {migrationOptions.dryRun ? '数据分析完成' : '数据迁移完成'}
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-red-600" />
                迁移失败
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">
                {migrationResult.migratedSessions}
              </div>
              <div className="text-sm text-green-600">
                {migrationOptions.dryRun ? '可迁移会话' : '成功迁移'}
              </div>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {migrationResult.skippedSessions}
              </div>
              <div className="text-sm text-blue-600">跳过的会话</div>
            </div>
          </div>

          <div className="space-y-3">
            {migrationResult.summary.oldestSession && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  数据时间范围
                </span>
                <span>
                  {migrationResult.summary.oldestSession.toLocaleDateString()} - {migrationResult.summary.newestSession?.toLocaleDateString()}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                数据大小
              </span>
              <span>{formatFileSize(migrationResult.summary.totalDataSize)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                处理时间
              </span>
              <span>{formatDuration(migrationResult.duration)}</span>
            </div>
          </div>

          {Object.keys(migrationResult.summary.categories).length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">面试类别分布:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(migrationResult.summary.categories).map(([category, count]) => (
                  <Badge key={category} variant="outline">
                    {category}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {migrationResult.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-orange-700">遇到的问题:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {migrationResult.errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCurrentStep('check')}>
              重新检查
            </Button>
            <Button onClick={onCancel}>
              完成
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default DataMigrationWizard;