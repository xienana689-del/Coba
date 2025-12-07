import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'critical';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastSystemProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastSystem: React.FC<ToastSystemProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300); // Wait for animation
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]';
      case 'error':
        return 'border-red-500/50 bg-red-950/90 text-red-100 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]';
      case 'critical':
        return 'border-red-500 bg-red-900 text-white shadow-[0_0_20px_-3px_rgba(239,68,68,0.6)] animate-pulse';
      case 'warning':
        return 'border-orange-500/50 bg-orange-950/90 text-orange-100 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]';
      case 'info':
      default:
        return 'border-blue-500/50 bg-blue-950/90 text-blue-100 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'error': return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case 'critical': return <AlertOctagon className="w-6 h-6 text-white" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div 
      className={`
        pointer-events-auto w-80 p-4 rounded-lg border backdrop-blur-md flex items-start gap-3 transition-all duration-300 transform
        ${isExiting ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'}
        ${getStyles()}
      `}
    >
      <div className="shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-sm leading-tight">{toast.title}</h4>
        <p className="text-xs opacity-90 mt-1 leading-relaxed">{toast.message}</p>
      </div>
      <button onClick={handleClose} className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors">
        <X className="w-4 h-4 opacity-70" />
      </button>
    </div>
  );
};

export default ToastSystem;