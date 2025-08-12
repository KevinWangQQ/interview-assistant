// 🎯 岗位模板管理组件 - V2.0核心功能

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Star, 
  StarOff, 
  Briefcase, 
  Users, 
  Target,
  AlertTriangle,
  Check,
  Loader2
} from 'lucide-react';
import { PositionTemplateService } from '@/services/storage';
import { PositionTemplate } from '@/services/interfaces';

interface PositionTemplatesProps {
  className?: string;
}

export function PositionTemplates({ className }: PositionTemplatesProps) {
  const [templates, setTemplates] = useState<PositionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PositionTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const positionTemplateService = new PositionTemplateService();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedTemplates = await positionTemplateService.getPositionTemplates();
      setTemplates(loadedTemplates);
    } catch (error) {
      console.error('加载岗位模板失败:', error);
      setError('加载岗位模板失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (templateData: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const newTemplate = await positionTemplateService.createPositionTemplate({
        ...templateData,
        user_id: '' // Will be set by the service based on current user
      });
      setTemplates(prev => [newTemplate, ...prev]);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('创建岗位模板失败:', error);
      setError('创建岗位模板失败，请重试');
    }
  };

  const handleUpdateTemplate = async (id: string, updates: Partial<PositionTemplate>) => {
    try {
      await positionTemplateService.updatePositionTemplate(id, updates);
      setTemplates(prev => 
        prev.map(template => 
          template.id === id ? { ...template, ...updates } : template
        )
      );
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('更新岗位模板失败:', error);
      setError('更新岗位模板失败，请重试');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('确定要删除这个岗位模板吗？此操作不可撤销。')) {
      return;
    }

    try {
      await positionTemplateService.deletePositionTemplate(id);
      const success = true;
      if (success) {
        setTemplates(prev => prev.filter(template => template.id !== id));
      } else {
        setError('删除岗位模板失败');
      }
    } catch (error) {
      console.error('删除岗位模板失败:', error);
      setError('删除岗位模板失败，请重试');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // 先取消其他模板的默认状态
      await Promise.all(
        templates
          .filter(t => t.is_default && t.id !== id)
          .map(t => positionTemplateService.updatePositionTemplate(t.id, { is_default: false }))
      );

      // 设置当前模板为默认
      await positionTemplateService.updatePositionTemplate(id, { is_default: true });
      
      // 更新本地状态
      setTemplates(prev => 
        prev.map(template => ({
          ...template,
          is_default: template.id === id
        }))
      );
    } catch (error) {
      console.error('设置默认模板失败:', error);
      setError('设置默认模板失败，请重试');
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            岗位模板管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              岗位模板管理
            </CardTitle>
            <CardDescription>
              创建和管理不同岗位的面试模板，用于个性化面试总结和评估
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新建模板
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>创建岗位模板</DialogTitle>
                <DialogDescription>
                  定义岗位要求和评估标准，提升面试总结的针对性
                </DialogDescription>
              </DialogHeader>
              <PositionTemplateForm 
                onSubmit={handleCreateTemplate}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">暂无岗位模板</h3>
            <p className="text-muted-foreground mb-6">
              创建您的第一个岗位模板，让面试总结更加个性化和专业
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建第一个模板
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="grid gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={(template) => {
                    setSelectedTemplate(template);
                    setIsEditDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteTemplate(template.id)}
                  onSetDefault={() => handleSetDefault(template.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* 编辑对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>编辑岗位模板</DialogTitle>
              <DialogDescription>
                修改岗位要求和评估标准
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <PositionTemplateForm 
                initialData={selectedTemplate}
                onSubmit={(data) => handleUpdateTemplate(selectedTemplate.id, data)}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setSelectedTemplate(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

interface TemplateCardProps {
  template: PositionTemplate;
  onEdit: (template: PositionTemplate) => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

function TemplateCard({ template, onEdit, onDelete, onSetDefault }: TemplateCardProps) {
  const criteriaCount = Object.keys(template.evaluation_criteria).length;
  const skillsCount = template.skills_required?.length || 0;

  return (
    <Card className={`transition-all hover:shadow-md ${template.is_default ? 'ring-2 ring-primary/20' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{template.name}</h3>
              {template.is_default && (
                <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                  <Star className="h-3 w-3 mr-1" />
                  默认
                </Badge>
              )}
              <Badge variant="outline" className="capitalize">
                {template.experience_level || '通用'}
              </Badge>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetDefault()}
              disabled={template.is_default}
              className="h-8 w-8 p-0"
            >
              {template.is_default ? (
                <Star className="h-4 w-4 text-primary" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(template)}
              className="h-8 w-8 p-0"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={template.is_default}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>{criteriaCount} 个评估维度</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{skillsCount} 项技能要求</span>
          </div>
          {template.department && (
            <div className="flex items-center gap-1">
              <Briefcase className="h-4 w-4" />
              <span>{template.department}</span>
            </div>
          )}
        </div>
        
        {template.skills_required && template.skills_required.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1">
              {template.skills_required.slice(0, 3).map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {template.skills_required.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.skills_required.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PositionTemplateFormProps {
  initialData?: PositionTemplate;
  onSubmit: (data: Omit<PositionTemplate, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => void;
  onCancel: () => void;
}

function PositionTemplateForm({ initialData, onSubmit, onCancel }: PositionTemplateFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    requirements: initialData?.requirements || '',
    job_description: initialData?.job_description || '',
    skills_required: initialData?.skills_required?.join(', ') || '',
    experience_level: initialData?.experience_level || 'mid',
    department: initialData?.department || '',
    evaluation_criteria: JSON.stringify(initialData?.evaluation_criteria || {
      technical_skills: { weight: 0.4, description: '技术能力' },
      problem_solving: { weight: 0.3, description: '问题解决能力' },
      communication: { weight: 0.2, description: '沟通协作能力' },
      learning_ability: { weight: 0.1, description: '学习适应能力' }
    }, null, 2),
    is_default: initialData?.is_default || false,
    is_active: initialData?.is_active !== false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('岗位名称不能为空');
    }
    
    try {
      JSON.parse(formData.evaluation_criteria);
    } catch {
      errors.push('评估标准必须是有效的JSON格式');
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationErrors([]);
      
      const submissionData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        requirements: formData.requirements.trim() || undefined,
        job_description: formData.job_description.trim() || undefined,
        skills_required: formData.skills_required.trim() ? 
          formData.skills_required.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        experience_level: formData.experience_level,
        department: formData.department.trim() || undefined,
        evaluation_criteria: JSON.parse(formData.evaluation_criteria),
        is_default: formData.is_default,
        is_active: formData.is_active
      };

      await onSubmit(submissionData);
    } catch (error) {
      console.error('提交表单失败:', error);
      setValidationErrors(['提交失败，请重试']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ScrollArea className="h-[500px] pr-4">
        {validationErrors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">岗位名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="如：高级前端工程师"
              />
            </div>
            <div>
              <Label htmlFor="experience_level">经验要求</Label>
              <select
                id="experience_level"
                value={formData.experience_level}
                onChange={(e) => setFormData(prev => ({ ...prev, experience_level: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="junior">初级</option>
                <option value="mid">中级</option>
                <option value="senior">高级</option>
                <option value="executive">管理级</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">岗位描述</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="简要描述这个岗位的职责和特点"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="job_description">详细JD</Label>
            <Textarea
              id="job_description"
              value={formData.job_description}
              onChange={(e) => setFormData(prev => ({ ...prev, job_description: e.target.value }))}
              placeholder="完整的职位描述，用于生成个性化面试总结"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="requirements">岗位要求</Label>
            <Textarea
              id="requirements"
              value={formData.requirements}
              onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
              placeholder="学历、经验、技能等要求"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="skills_required">技能标签</Label>
            <Input
              id="skills_required"
              value={formData.skills_required}
              onChange={(e) => setFormData(prev => ({ ...prev, skills_required: e.target.value }))}
              placeholder="用逗号分隔，如：React, TypeScript, Node.js"
            />
            <p className="text-xs text-muted-foreground mt-1">
              用逗号分隔多个技能
            </p>
          </div>

          <div>
            <Label htmlFor="department">所属部门</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              placeholder="如：前端组、后端组"
            />
          </div>

          <div>
            <Label htmlFor="evaluation_criteria">评估标准 (JSON格式) *</Label>
            <Textarea
              id="evaluation_criteria"
              value={formData.evaluation_criteria}
              onChange={(e) => setFormData(prev => ({ ...prev, evaluation_criteria: e.target.value }))}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              定义评估维度和权重，用于生成专业的面试总结
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="is_default">设为默认模板</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="is_active">激活状态</Label>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              保存模板
            </>
          )}
        </Button>
      </div>
    </form>
  );
}