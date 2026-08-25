import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxModalProps {
  imageUrl: string;
  senderName?: string;
  timestamp?: number;
  caption?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  imageUrl,
  senderName,
  timestamp,
  caption,
  onClose
}) => {
  const [scale, setScale] = React.useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `up1chatbox_photo_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2 text-white z-10">
        <div>
          <h3 className="font-semibold text-sm sm:text-base">
            {senderName ? `Photo from ${senderName}` : 'Photo'}
          </h3>
          {timestamp && (
            <p className="text-xs text-white/60">
              {new Date(timestamp).toLocaleDateString()} at{' '}
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={20} />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
            title="Download Image"
          >
            <Download size={20} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer ml-2"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden cursor-zoom-out p-2"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={imageUrl}
          alt={caption || 'Photo'}
          style={{ transform: `scale(${scale})` }}
          className="max-h-[78vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150 cursor-default"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Footer Caption */}
      {caption && (
        <div className="w-full max-w-2xl text-center py-2 px-4 bg-black/60 backdrop-blur-sm rounded-xl text-white text-sm font-medium">
          {caption}
        </div>
      )}
    </div>
  );
};
