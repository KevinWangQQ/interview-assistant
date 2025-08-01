'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  History, 
  Settings, 
  Bug,
  Home,
  Menu,
  X
} from 'lucide-react';

interface NavigationProps {
  currentView: 'interview' | 'history' | 'settings' | 'debug';
  onViewChange: (view: 'interview' | 'history' | 'settings' | 'debug') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    {
      id: 'interview' as const,
      label: '面试助手',
      icon: Mic,
      description: '开始新的面试'
    },
    {
      id: 'history' as const,
      label: '历史记录',
      icon: History,
      description: '查看面试记录'
    },
    {
      id: 'settings' as const,
      label: '设置',
      icon: Settings,
      description: 'API 和功能设置'
    },
    {
      id: 'debug' as const,
      label: '调试',
      icon: Bug,
      description: '功能测试和调试'
    }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* 桌面端导航 */}
      <nav className="hidden md:flex items-center gap-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange(item.id)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* 移动端导航 */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMobileMenu}
          className="flex items-center gap-2"
        >
          {isMobileMenuOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
          菜单
        </Button>

        {/* 移动端菜单面板 */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-card border-b shadow-lg z-50">
            <div className="container mx-auto px-4 py-4">
              <div className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onViewChange(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm opacity-70">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 移动端遮罩 */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}