import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Maximize2,
  Square,
  Image as ImageIcon
} from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  isOpen: boolean;
  aspectRatio?: 'square' | 'free' | '16:9' | '4:3';
  isCircularMask?: boolean;
  title?: string;
  onCropComplete: (croppedBase64: string) => void;
  onClose: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  isOpen,
  aspectRatio = 'free',
  isCircularMask = false,
  title = 'Crop & Adjust Photo',
  onCropComplete,
  onClose
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedRatio, setSelectedRatio] = useState<'square' | 'free' | '16:9' | '4:3'>(aspectRatio);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load Image
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    };
  }, [imageSrc]);

  // Compute crop box aspect ratio
  const getAspectRatioMultiplier = useCallback(() => {
    switch (selectedRatio) {
      case 'square':
        return 1;
      case '16:9':
        return 9 / 16;
      case '4:3':
        return 3 / 4;
      case 'free':
      default:
        if (imgRef.current) {
          return imgRef.current.height / imgRef.current.width;
        }
        return 1;
    }
  }, [selectedRatio]);

  // Mouse & Touch Pan Handling
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Perform Final Canvas Crop
  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    const outputSize = selectedRatio === 'square' ? 600 : 800;
    const ratioMult = getAspectRatioMultiplier();
    const outputWidth = outputSize;
    const outputHeight = Math.round(outputSize * ratioMult);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      onClose();
      return;
    }

    ctx.save();
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Calculate aspect scaling to fill crop area
    const scale = Math.max(outputWidth / img.width, outputHeight / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    const adjustedPanX = (pan.x / 180) * outputWidth;
    const adjustedPanY = (pan.y / 180) * outputHeight;

    ctx.drawImage(
      img,
      -drawWidth / 2 + adjustedPanX,
      -drawHeight / 2 + adjustedPanY,
      drawWidth,
      drawHeight
    );

    ctx.restore();

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
    onCropComplete(croppedBase64);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150 select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <Crop size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Drag to reposition, adjust zoom slider or rotate
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper Viewport Frame */}
        <div
          className="relative w-full h-64 sm:h-72 bg-slate-950 rounded-2xl overflow-hidden cursor-move border border-slate-800 flex items-center justify-center touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {imageLoaded && (
            <div
              className="absolute pointer-events-none transition-transform duration-75 ease-out"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={imageSrc}
                alt="Crop preview"
                className="max-h-60 max-w-xs sm:max-w-sm sm:max-h-64 object-contain pointer-events-none shadow-2xl"
                draggable={false}
              />
            </div>
          )}

          {/* Overlay Guideline Box / Circle */}
          <div
            className={`pointer-events-none absolute border-2 border-indigo-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${
              isCircularMask || selectedRatio === 'square'
                ? 'w-52 h-52 sm:w-56 sm:h-56 rounded-2xl'
                : selectedRatio === '16:9'
                ? 'w-64 h-36 rounded-xl'
                : 'w-60 h-44 rounded-xl'
            }`}
          >
            {/* Grid Lines */}
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30">
              <div className="border-r border-b border-indigo-300" />
              <div className="border-r border-b border-indigo-300" />
              <div className="border-b border-indigo-300" />
              <div className="border-r border-b border-indigo-300" />
              <div className="border-r border-b border-indigo-300" />
              <div className="border-b border-indigo-300" />
              <div className="border-r border-indigo-300" />
              <div className="border-r border-indigo-300" />
              <div />
            </div>
          </div>
        </div>

        {/* Controls: Zoom & Rotate */}
        <div className="space-y-3 pt-1">
          {/* Zoom Slider */}
          <div className="flex items-center gap-3 bg-slate-800/60 px-3.5 py-2.5 rounded-xl border border-slate-700/60">
            <ZoomOut size={16} className="text-slate-400 shrink-0" />
            <input
              type="range"
              min="0.8"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <ZoomIn size={16} className="text-slate-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-indigo-400 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Aspect Ratio & Rotate Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setSelectedRatio('square')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedRatio === 'square'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Square size={12} />
                <span>1:1</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRatio('4:3')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedRatio === '4:3'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                4:3
              </button>

              <button
                type="button"
                onClick={() => setSelectedRatio('16:9')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedRatio === '16:9'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                16:9
              </button>

              <button
                type="button"
                onClick={() => setSelectedRatio('free')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedRatio === 'free'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Maximize2 size={12} />
                <span>Free</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRotate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <RotateCw size={14} />
              <span>Rotate 90°</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyCrop}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Check size={15} />
            <span>Apply Crop</span>
          </button>
        </div>
      </div>
    </div>
  );
};
