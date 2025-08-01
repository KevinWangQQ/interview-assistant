# Interview Assistant - Claude Development Guide

## 项目概述
这是一个面试助手应用，为中国面试官提供实时英文转录和中文翻译服务。使用Next.js 14、TypeScript、Zustand、shadcn/ui等技术栈。

## 核心功能
- 实时语音转录（OpenAI Whisper API）
- 中英文翻译（OpenAI GPT API）
- 双栏显示界面
- 智能问题建议
- 面试记录管理
- 本地存储（IndexedDB + Dexie.js）

## 开发最佳实践

### 本地服务器部署流程
**重要：每次启动开发服务器时必须按此流程执行**

1. **清理端口占用**
   ```bash
   lsof -ti:3000 | xargs kill -9
   lsof -ti:3001 | xargs kill -9
   pkill -f "next dev"
   ```

2. **启动开发服务器**
   ```bash
   cd /Users/kevin/Work/Code/Interview\ Agent/interview-assistant
   npm run dev
   ```

3. **验证服务器状态**
   ```bash
   # 等待3-5秒后验证
   curl -I http://localhost:3000
   lsof -i :3000
   ```

4. **故障排除**
   - 如果浏览器无法访问，尝试：`http://127.0.0.1:3000`
   - 检查防火墙设置
   - 清除浏览器缓存，尝试无痕模式
   - 查看 `dev.log` 文件了解错误信息

### 代码规范

#### API密钥管理
- 优先从环境变量获取：`process.env.NEXT_PUBLIC_OPENAI_API_KEY`
- 其次从localStorage：`localStorage.getItem('openai_api_key')`
- 最后从应用配置：`localStorage.getItem('interview-assistant-config')`

#### 错误处理
- 所有异步操作都必须包含try-catch
- 使用详细的console.log记录调试信息
- 错误信息要包含上下文和堆栈信息

#### 服务架构
- 使用服务抽象层（interfaces.ts）
- 所有服务都要实现依赖注入
- 状态管理统一使用Zustand

### 调试技巧

#### 音频处理调试
- 在Whisper服务中已添加详细日志
- 在Store中增加了完整的错误跟踪
- 使用调试页面测试各个功能模块

#### 常用调试命令
```bash
# 查看实时日志
tail -f dev.log

# 检查端口状态
lsof -i :3000

# 测试API连接
curl http://localhost:3000

# 清理Next.js缓存
rm -rf .next
```

### 项目结构
```
src/
├── app/              # Next.js 14 App Router
├── components/       # UI组件
├── hooks/           # 自定义Hook
├── services/        # 服务层
├── store/           # Zustand状态管理
├── types/           # TypeScript类型定义
└── lib/             # 工具函数
```

### 重要文件说明
- `src/services/audio/whisper-audio.ts` - Whisper API集成
- `src/services/translation/openai-translation.ts` - OpenAI翻译服务
- `src/store/interview-store.ts` - 核心状态管理
- `src/hooks/use-audio-processor.ts` - 音频处理Hook
- `src/components/debug/function-test.tsx` - 调试测试组件

### 部署检查清单
- [ ] 端口清理完成
- [ ] 服务器正常启动
- [ ] HTTP连接测试通过
- [ ] 浏览器能正常访问
- [ ] API密钥已配置
- [ ] 音频权限已授权
- [ ] 控制台无错误信息

### 故障排除优先级
1. **端口占用** - 清理所有相关进程
2. **服务器状态** - 验证HTTP响应
3. **网络连接** - 尝试不同地址
4. **缓存问题** - 清除浏览器缓存
5. **权限问题** - 检查麦克风权限
6. **API配置** - 验证密钥设置

## 常见问题解决方案

### PROCESS_AUDIO_FAILED错误
1. 检查API密钥配置
2. 验证音频格式转换
3. 查看Whisper API响应
4. 检查网络连接

### 录音功能异常
1. 检查浏览器麦克风权限
2. 验证MediaRecorder支持
3. 确认音频设备正常

### 翻译功能失败
1. 验证OpenAI API密钥
2. 检查API调用限制
3. 查看网络连接状态

## 开发命令速查

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 构建项目
npm run build

# 生产服务器
npm run start

# 类型检查
npm run build

# 代码格式化
npm run lint
```

---

**重要提醒：每次修改代码后如果遇到服务器问题，请严格按照上述部署流程重新启动服务器。这是经过验证的最佳实践，能解决99%的本地开发问题。**