// 🔍 流式转录专用日志工具
// 提供详细的调试信息和错误跟踪

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

class StreamingLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private enabled = true;

  log(level: LogEntry['level'], category: string, message: string, data?: any) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    };

    this.logs.push(entry);

    // 保持日志数量限制
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 输出到控制台
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${category.toUpperCase()}]`;
    
    switch (level) {
      case 'error':
        console.error(`❌ ${prefix}`, message, data || '');
        break;
      case 'warn':
        console.warn(`⚠️ ${prefix}`, message, data || '');
        break;
      case 'debug':
        console.debug(`🔍 ${prefix}`, message, data || '');
        break;
      default:
        console.log(`ℹ️ ${prefix}`, message, data || '');
    }
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  // 获取特定类别的日志
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  // 获取特定级别的日志
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // 获取最近的日志
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // 清空日志
  clear() {
    this.logs = [];
  }

  // 导出日志
  exportLogs(): string {
    return this.logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const data = log.data ? ` | ${JSON.stringify(log.data)}` : '';
      return `${timestamp} [${log.level.toUpperCase()}] [${log.category}] ${log.message}${data}`;
    }).join('\n');
  }

  // 启用/禁用日志
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

export const streamingLogger = new StreamingLogger();

// 便捷方法
export const logAudio = (message: string, data?: any) => streamingLogger.info('audio', message, data);
export const logVAD = (message: string, data?: any) => streamingLogger.debug('vad', message, data);
export const logTranscription = (message: string, data?: any) => streamingLogger.info('transcription', message, data);
export const logTranslation = (message: string, data?: any) => streamingLogger.info('translation', message, data);
export const logSegment = (message: string, data?: any) => streamingLogger.info('segment', message, data);
export const logError = (category: string, message: string, data?: any) => streamingLogger.error(category, message, data);

export default streamingLogger;