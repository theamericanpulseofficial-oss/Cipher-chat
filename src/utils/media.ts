/**
 * Multimedia utilities for CipherChat:
 * - Image compression and resizing (producing optimized Data URLs)
 * - Audio Voice Recording with MediaRecorder (producing Opus/WebM/MP4 Data URLs)
 */

export async function compressImageFile(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as optimized JPEG or WebP
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export interface VoiceRecorderSession {
  stop: () => Promise<{ audioDataUrl: string; duration: number }>;
  cancel: () => void;
  getDuration: () => number;
}

export async function startVoiceRecording(): Promise<VoiceRecorderSession> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording is not supported in this browser environment.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  // Choose supported mimeType
  let mimeType = 'audio/webm;codecs=opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    } else {
      mimeType = '';
    }
  }

  const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
  const mediaRecorder = new MediaRecorder(stream, options);
  const audioChunks: Blob[] = [];
  const startTime = Date.now();
  let isCancelled = false;

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(100);

  const getDuration = () => {
    return Math.max(1, Math.round((Date.now() - startTime) / 1000));
  };

  const cancel = () => {
    isCancelled = true;
    try {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    } catch {}
    stream.getTracks().forEach((track) => track.stop());
  };

  const stop = (): Promise<{ audioDataUrl: string; duration: number }> => {
    return new Promise((resolve, reject) => {
      const finalDuration = getDuration();

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        if (isCancelled) {
          reject(new Error('Voice recording was cancelled.'));
          return;
        }

        const audioBlob = new Blob(audioChunks, {
          type: mimeType || 'audio/webm'
        });

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve({
            audioDataUrl: base64data,
            duration: finalDuration
          });
        };
        reader.onerror = () => reject(new Error('Failed to encode recorded audio.'));
        reader.readAsDataURL(audioBlob);
      };

      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  return { stop, cancel, getDuration };
}

export function formatMediaDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}
