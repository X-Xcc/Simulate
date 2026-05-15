import { useEffect } from "react";
import { motion } from "motion/react";
import { Download, X, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LightboxProps {
  src: string;
  alt?: string;
  cameraId?: string;
  onClose: () => void;
  onDownload: () => void;
}

export default function Lightbox({ src, alt, cameraId, onClose, onDownload }: LightboxProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <img src={src} alt={alt || "证据截图"} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        {/* 关闭按钮 */}
        <button onClick={onClose} aria-label="关闭" className="absolute -top-3 -right-3 bg-white text-black rounded-full p-1.5 shadow-lg hover:bg-gray-100">
          <X size={16} />
        </button>
        {/* 底部操作栏 */}
        <div className="flex justify-center gap-3 mt-3">
          <button onClick={onDownload} className="bg-white/90 text-black px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-white transition-colors">
            <Download size={15} /> 下载
          </button>
          {cameraId && (
            <button onClick={() => navigate(`/monitor?cam=${cameraId}`)} className="bg-primary text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Radio size={15} /> 查看直播
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
