// 服务导出和工厂类

export * from './interfaces';

// 服务实现导出
export { LocalStorageService } from './storage/local-storage';
export { WhisperAudioService } from './audio/whisper-audio';
export { OpenAITranslationService } from './translation/openai-translation';

// 导入服务接口
import { 
  IStorageService, 
  IAudioService, 
  ITranslationService,
  IServiceFactory 
} from './interfaces';

// 导入服务实现
import { LocalStorageService } from './storage/local-storage';
import { WhisperAudioService } from './audio/whisper-audio';
import { OpenAITranslationService } from './translation/openai-translation';

// 服务工厂实现
export class ServiceFactory implements IServiceFactory {
  createStorageService(type: 'local' | 'supabase' | 'firebase'): IStorageService {
    switch (type) {
      case 'local':
        return new LocalStorageService();
      case 'supabase':
        throw new Error('Supabase storage service not implemented yet');
      case 'firebase':
        throw new Error('Firebase storage service not implemented yet');
      default:
        throw new Error(`Unknown storage service type: ${type}`);
    }
  }

  createAudioService(type: 'whisper' | 'azure' | 'google'): IAudioService {
    switch (type) {
      case 'whisper':
        return new WhisperAudioService();
      case 'azure':
        throw new Error('Azure audio service not implemented yet');
      case 'google':
        throw new Error('Google audio service not implemented yet');
      default:
        throw new Error(`Unknown audio service type: ${type}`);
    }
  }

  createTranslationService(type: 'openai' | 'azure' | 'google'): ITranslationService {
    switch (type) {
      case 'openai':
        return new OpenAITranslationService();
      case 'azure':
        throw new Error('Azure translation service not implemented yet');
      case 'google':
        throw new Error('Google translation service not implemented yet');
      default:
        throw new Error(`Unknown translation service type: ${type}`);
    }
  }

  createEventService(): never {
    throw new Error('Event service not implemented yet');
  }

  createConfigService(): never {
    throw new Error('Config service not implemented yet');
  }

  createPluginService(): never {
    throw new Error('Plugin service not implemented yet');
  }
}

// 全局服务实例（单例模式）
class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, any> = new Map();
  private factory: ServiceFactory;

  private constructor() {
    this.factory = new ServiceFactory();
    this.initializeDefaultServices();
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  private initializeDefaultServices(): void {
    // 初始化默认服务实例（延迟初始化翻译服务）
    this.services.set('storage', this.factory.createStorageService('local'));
    // 音频和翻译服务在需要时初始化，避免SSR时的localStorage错误
  }

  getStorageService(): IStorageService {
    return this.services.get('storage');
  }

  getAudioService(): IAudioService {
    if (!this.services.has('audio')) {
      this.services.set('audio', this.factory.createAudioService('whisper'));
    }
    return this.services.get('audio');
  }

  getTranslationService(): ITranslationService {
    if (!this.services.has('translation')) {
      this.services.set('translation', this.factory.createTranslationService('openai'));
    }
    return this.services.get('translation');
  }

  // 允许替换服务实现（用于测试或切换提供商）
  replaceService(name: string, service: any): void {
    this.services.set(name, service);
  }

  // 重新初始化服务（用于配置更改）
  reinitializeServices(config: {
    storageType?: 'local' | 'supabase' | 'firebase';
    audioType?: 'whisper' | 'azure' | 'google';
    translationType?: 'openai' | 'azure' | 'google';
  }): void {
    if (config.storageType) {
      this.services.set('storage', this.factory.createStorageService(config.storageType));
    }
    if (config.audioType) {
      this.services.set('audio', this.factory.createAudioService(config.audioType));
    }
    if (config.translationType) {
      this.services.set('translation', this.factory.createTranslationService(config.translationType));
    }
  }
}

// 便捷的服务访问函数
export const getStorageService = (): IStorageService => 
  ServiceContainer.getInstance().getStorageService();

export const getAudioService = (): IAudioService => 
  ServiceContainer.getInstance().getAudioService();

export const getTranslationService = (): ITranslationService => 
  ServiceContainer.getInstance().getTranslationService();

// 服务容器导出（用于高级使用场景）
export const serviceContainer = ServiceContainer.getInstance();