import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, FlipHorizontal } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';

interface CameraCaptureModalProps {
  onCapture: (dataUrl: string, blob: Blob) => void;
  onClose: () => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  onCapture,
  onClose,
  title = 'Foto mit Kamera aufnehmen',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    setIsLoading(true);
    setErrorMessage(null);

    // Stop any existing stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
      setIsLoading(false);
    } catch (err: any) {
      console.warn('Camera access with ideal facingMode failed, trying basic video:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
        setIsLoading(false);
      } catch (fallbackErr: any) {
        setErrorMessage(
          'Kamera konnte nicht gestartet werden. Bitte erlaube den Kamera-Zugriff im Browser oder nutze die Smartphone-Kamera direkt über den Galerie-Button.'
        );
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  // Flip camera between front & back
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Snapshot photo from video frame
  const handleTakePhoto = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current video frame onto canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      const compressed = await compressImage(rawDataUrl, 1200, 1200, 0.82);
      setCapturedImage(compressed.dataUrl);
      setCapturedBlob(compressed.blob);
    } catch (err) {
      setCapturedImage(rawDataUrl);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage && capturedBlob) {
      onCapture(capturedImage, capturedBlob);
      handleClose();
    }
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Image Preview Area */}
        <div className="relative bg-black aspect-4/3 flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            /* Snapshot Preview */
            <img
              src={capturedImage}
              alt="Aufgenommenes Foto"
              className="w-full h-full object-contain"
            />
          ) : (
            /* Live Camera Stream */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Framing Overlay */}
              <div className="absolute inset-8 border-2 border-white/60 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                  <span className="w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                </div>
                <div className="text-center text-[11px] font-medium text-white/80 bg-black/40 py-1 px-2.5 rounded-full backdrop-blur-xs mx-auto">
                  Schulbuch / Aufgabe hier mittig ausrichten
                </div>
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                  <span className="w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                </div>
              </div>

              {/* Camera Switcher Button (front/back) */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                title="Kamera wechseln (Hauptkamera / Frontkamera)"
                className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-xs transition"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-xs gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Kamera wird gestartet...</span>
            </div>
          )}

          {errorMessage && (
            <div className="absolute inset-4 p-4 flex flex-col items-center justify-center bg-red-950/90 text-red-200 text-xs rounded-xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p>{errorMessage}</p>
              <p className="text-[11px] text-red-300">
                Tipp: Nutze alternativ den Button <strong>„Direkt mit Smartphone-Kamera“</strong>, um
                die native Kamera-App zu öffnen.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Neu aufnehmen</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Foto verwenden</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isLoading || !!errorMessage}
                onClick={handleTakePhoto}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Foto jetzt aufnehmen</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
