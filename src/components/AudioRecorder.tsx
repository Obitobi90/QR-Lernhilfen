import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Upload, Volume2 } from 'lucide-react';

interface AudioRecorderProps {
  initialAudioUrl?: string;
  onAudioSave: (audioDataUrl: string, blob?: Blob) => void;
  onRemove?: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  initialAudioUrl,
  onAudioSave,
  onRemove,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>(initialAudioUrl || '');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
          onAudioSave(base64data, blob);
        };
        reader.readAsDataURL(blob);

        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(200); // 200ms slices
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setErrorMessage(
        'Mikrofon-Zugriff verweigert oder nicht verfügbar. Bitte erlaube den Mikrofon-Zugriff im Browser.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setErrorMessage('Bitte wähle eine gültige Audio-Datei (z.B. MP3, WAV, M4A, OGG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAudioUrl(result);
      setAudioBlob(file);
      onAudioSave(result, file);
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setAudioUrl('');
    setAudioBlob(null);
    setRecordingSeconds(0);
    if (onRemove) onRemove();
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Audio-Tipp / Sprachnachricht</span>
        </span>
        {audioUrl && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Löschen</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Recording in progress */}
      {isRecording ? (
        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-semibold text-red-700 dark:text-red-400">
              Aufnahme läuft... ({formatTime(recordingSeconds)})
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:bg-red-700 flex items-center gap-1.5 shadow-sm"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stoppen</span>
          </button>
        </div>
      ) : (
        /* Action buttons: Record or Upload */
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{audioUrl ? 'Neu aufnehmen' : 'Sprachnachricht aufnehmen'}</span>
          </button>

          <label className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-md cursor-pointer flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Audiodatei hochladen</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Playback preview if recorded or uploaded */}
      {audioUrl && !isRecording && (
        <div className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Vorschau der Sprachnachricht:
          </div>
          <audio
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            src={audioUrl}
            className="w-full h-9"
            preload="metadata"
          />
        </div>
      )}
    </div>
  );
};
