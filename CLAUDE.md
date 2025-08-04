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
```

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