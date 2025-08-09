# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered interview assistant application that provides real-time English-to-Chinese transcription and translation for Chinese interviewers conducting English interviews. Built with Next.js 14, TypeScript, and advanced audio processing capabilities.

## Key Development Commands

### Essential Development Workflow

```bash
# Port cleanup (CRITICAL - run before each dev session)
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
pkill -f "next dev"

# Start development server
npm run dev

# Verify server status
curl -I http://localhost:3000
lsof -i :3000

# Build and production
npm run build
npm run start
npm run lint

# Testing commands (no dedicated test framework configured)
# Check TypeScript compilation
npm run build

# Lint check
npm run lint
```

### Service Restart Best Practices (经验总结)

**关键点：清理进程是服务重启成功的核心**

1. **完整清理序列** (必须按顺序执行)：
   ```bash
   # 一行命令清理所有端口和进程 (推荐)
   lsof -ti:3000 | xargs kill -9 2>/dev/null; lsof -ti:3001 | xargs kill -9 2>/dev/null; pkill -f "next dev" 2>/dev/null
   ```

2. **后台启动方式** (避免超时)：
   ```bash
   # 后台启动并记录日志
   nohup npm run dev > dev.log 2>&1 &
   
   # 等待启动完成后验证
   sleep 5 && curl -I http://localhost:3000
   ```

3. **验证服务状态**：
   ```bash
   # 检查HTTP响应
   curl -I http://localhost:3000
   
   # 检查端口占用
   lsof -i :3000
   
   # 检查进程状态
   ps aux | grep "next dev" | grep -v grep
   ```

4. **故障排查步骤**：
   - 如果curl连接失败：检查进程是否真正启动
   - 如果超时：使用nohup后台启动
   - 查看日志：`tail -f dev.log` 实时监控启动过程
   - 检查代码错误：关注SSR相关错误（如localStorage问题）

**常见问题解决**：
- **端口占用**: 重复清理命令直到成功
- **服务启动超时**: 使用后台启动方式
- **SSR错误**: localStorage等浏览器API在服务端渲染时会报错，需要条件判断

### Debugging Commands

```bash
# Real-time log monitoring
tail -f dev.log

# Clear Next.js cache if needed
rm -rf .next

# Test API connectivity
curl http://localhost:3000
```

## Architecture Overview

### Service Layer Architecture

The application follows a multi-layered service architecture with dependency injection:

- **Enhanced Audio Processing**: Multi-source audio capture (microphone + system audio) with WAV format optimization for Whisper API compatibility
- **Smart Segmentation**: Semantic-aware text segmentation based on sentence completion, speaker changes, and timing
- **AI-Powered Analysis**: GPT-4 driven interview summarization with chunking strategies for large transcriptions
- **Storage Abstraction**: Interface-based storage with local IndexedDB and extensibility for cloud providers

### Core Services

1. **Audio Services** (`src/services/streaming/`)
   - `enhanced-wav-streaming-transcription.ts`: Multi-source audio capture with AudioContext direct PCM recording
   - `wav-streaming-transcription.ts`: Basic WAV streaming for Whisper compatibility
   - Handles Teams meeting audio scenarios with system audio capture

2. **AI Analysis Services** (`src/services/interview-summary/`)
   - `gpt4-summary-service.ts`: Professional interview analysis with English-first processing
   - `summary-generation-manager.ts`: Async workflow management with progress tracking
   - `text-chunking.ts`: Token-aware text segmentation for large transcripts

3. **Storage Services** (`src/services/storage/`)
   - `enhanced-interview-storage.ts`: Complete interview session management
   - Supports search, filtering, batch operations, and multi-format export
   - Built-in data validation and storage limits

### State Management

Uses Zustand with specialized stores:
- `enhanced-wav-streaming-store.ts`: Multi-audio source recording state
- `interview-history-store.ts`: Interview session management
- Each store handles specific domain logic with async operations

### Smart Segmentation System

The `SmartSegmentationProcessor` (`src/utils/smart-segmentation.ts`) provides:
- Semantic boundary detection based on sentence completion
- Speaker change detection for interview flow
- Time-based segmentation with configurable thresholds
- Context preservation across segments

## Key Architectural Patterns

### Service Abstraction

All services implement interfaces from `src/services/interfaces.ts` enabling:
- Easy testing with mock implementations
- Future migration to cloud services
- Consistent error handling and logging

### Event-Driven Architecture

Audio and transcription services use event emitters for:
- Real-time progress updates
- Error propagation
- State synchronization across components

### Multi-Audio Source Processing

The enhanced streaming service combines:
- Microphone input for interviewer voice
- System audio capture for Teams meeting participants
- Real-time audio quality monitoring
- AudioContext-based WAV file construction

## API Key Management Priority

1. Environment variables: `process.env.NEXT_PUBLIC_OPENAI_API_KEY`
2. localStorage: `localStorage.getItem('openai_api_key')`
3. App config: `localStorage.getItem('interview-assistant-config')`

## Critical Development Practices

### Audio Processing
- Always use WAV format for Whisper API compatibility
- Implement comprehensive error handling for audio format issues
- Monitor audio quality metrics in real-time
- Support both single and multi-source audio scenarios

### AI Integration
- Process English transcripts first for higher accuracy
- Use semantic chunking for GPT-4 analysis of long content
- Implement retry mechanisms with exponential backoff
- Track confidence scores and processing statistics

### Data Management
- Validate all interview session data before storage
- Implement storage limits and auto-cleanup
- Support incremental saves during long interviews
- Provide comprehensive export options

### SSR (Server-Side Rendering) 兼容性
- **localStorage问题**: localStorage只在客户端可用，服务端渲染时会抛出ReferenceError
- **解决方案**: 使用条件检查 `typeof window !== 'undefined'` 或 `typeof localStorage !== 'undefined'`
- **影响组件**: 所有使用localStorage的存储服务需要客户端检查
- **常见错误**: `ReferenceError: localStorage is not defined` 在SSR时出现

### Audio Quality and Performance Monitoring
- **Quality Thresholds**: The system has strict quality thresholds that may cause recording issues if audio quality is poor
- **Audio Format**: WAV format is critical for Whisper API compatibility
- **Hallucination Detection**: Enhanced filtering for Whisper API hallucination issues and advertisement content
- **Silence Detection**: Improved silence detection to prevent false triggers during quiet periods

## Component Architecture

### Interview Flow Components
- `enhanced-interview-main.tsx`: Main interview interface with multi-audio support
- `audio-setup-guide.tsx`: Guided audio configuration for Teams scenarios
- Components follow event-driven patterns with state lifting

### UI Patterns
- Uses shadcn/ui components with consistent theming
- Implements loading states and error boundaries
- Responsive design with mobile-first approach

## Testing and Debugging

### Audio Debugging
- Check browser MediaRecorder API support
- Verify microphone permissions
- Test system audio capture capabilities
- Monitor WAV file format construction

### AI Service Debugging
- Validate token counts before GPT-4 calls
- Check API rate limits and quotas
- Monitor chunking effectiveness for large texts
- Track summary generation progress

## Deployment Considerations

- Requires HTTPS for microphone access in production
- Audio processing needs sufficient memory allocation
- Consider API rate limits for concurrent users
- IndexedDB storage has browser-specific limits

## File Structure Highlights

```
src/
├── services/
│   ├── streaming/           # Audio capture and transcription
│   ├── interview-summary/   # AI-powered analysis
│   └── storage/            # Data persistence
├── utils/
│   └── smart-segmentation.ts  # Semantic text processing
├── types/
│   └── enhanced-interview.ts  # Complete data models
└── components/
    └── interview/          # Core interview UI
```

The codebase prioritizes reliability, extensibility, and professional interview scenarios with sophisticated audio handling and AI analysis capabilities.

## Recent Enhancements

### Enhanced WAV Streaming Implementation
- **File**: `src/services/streaming/enhanced-wav-streaming-transcription.ts`
- **Features**: Multi-audio source combination, intelligent segmentation, system audio capture for Teams meetings
- **Quality Metrics**: Real-time audio quality monitoring with volume and clarity tracking

### Smart Segmentation System
- **File**: `src/utils/smart-segmentation.ts` 
- **Features**: Semantic boundary detection, speaker change detection, time-based segmentation
- **Context Preservation**: Maintains context across segments for better comprehension

### Hallucination Detection and Content Filtering
- Enhanced Whisper API integration with hallucination detection
- Advertisement content filtering for cleaner transcriptions
- Improved silence detection algorithms to prevent false positives

## Current Issues and Fixes Applied

Based on recent commits, the following issues have been resolved:
1. **Audio Recording Output Issues**: Fixed overly strict quality thresholds causing recording failures
2. **Whisper API Hallucinations**: Enhanced filtering and detection mechanisms  
3. **ESLint Warnings**: Resolved prefer-const and unused variable warnings
4. **TypeScript Errors**: Fixed cache management type issues
5. **Runtime Exceptions**: Fixed syntax errors in hallucination detection functions