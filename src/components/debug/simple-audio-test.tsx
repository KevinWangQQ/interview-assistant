'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SimpleAudioTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<string>('');

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // 使用最简单的配置
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setAudioBlob(blob);
        console.log('录音完成:', blob.type, blob.size);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      console.log('开始录音，格式:', recorder.mimeType);
    } catch (error) {
      console.error('录音启动失败:', error);
      setResult(`录音启动失败: ${error}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const testWhisperAPI = async () => {
    if (!audioBlob) return;

    setResult('正在测试Whisper API...');

    try {
      const apiKey = localStorage.getItem('openai_api_key') || 
                     localStorage.getItem('interview-assistant-config')?.replace(/.*"openaiApiKey":"([^"]*)".*/, '$1');

      if (!apiKey) {
        setResult('请先在设置中配置API密钥');
        return;
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'test.webm');
      formData.append('model', 'whisper-1');

      console.log('发送到Whisper API:', audioBlob.type, audioBlob.size);

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      console.log('Whisper API响应:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API错误:', errorText);
        setResult(`API错误 (${response.status}): ${errorText}`);
        return;
      }

      const result = await response.json();
      console.log('转录结果:', result);
      setResult(`转录成功: "${result.text}"`);
    } catch (error) {
      console.error('测试失败:', error);
      setResult(`测试失败: ${error}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>简单音频测试</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={startRecording} 
            disabled={isRecording}
            variant={isRecording ? "secondary" : "default"}
          >
            {isRecording ? '录音中...' : '开始录音'}
          </Button>
          
          <Button 
            onClick={stopRecording} 
            disabled={!isRecording}
            variant="outline"
          >
            停止录音
          </Button>
          
          <Button 
            onClick={testWhisperAPI} 
            disabled={!audioBlob}
            variant="secondary"
          >
            测试Whisper API
          </Button>
        </div>

        {audioBlob && (
          <div className="p-3 bg-gray-100 rounded">
            <p>音频已录制:</p>
            <p>类型: {audioBlob.type}</p>
            <p>大小: {audioBlob.size} bytes</p>
            <audio controls src={URL.createObjectURL(audioBlob)} className="mt-2" />
          </div>
        )}

        {result && (
          <div className="p-3 border rounded">
            <p className="font-mono text-sm">{result}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}