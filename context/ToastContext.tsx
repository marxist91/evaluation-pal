
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const getIcon = (type: ToastType) => {
      switch(type) {
          case 'success': return 'fa-check-circle';
          case 'error': return 'fa-times-circle';
          case 'warning': return 'fa-exclamation-triangle';
          default: return 'fa-info-circle';
      }
  };

  const getColors = (type: ToastType) => {
      switch(type) {
          case 'success': return 'bg-green-500 border-green-600 text-white';
          case 'error': return 'bg-red-500 border-red-600 text-white';
          case 'warning': return 'bg-orange-400 border-orange-500 text-white';
          default: return 'bg-blue-500 border-blue-600 text-white';
      }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Container de Toasts - Coin Supérieur Droit */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              ${getColors(toast.type)} 
              pointer-events-auto 
              flex items-center px-4 py-3 rounded shadow-lg border-l-4 
              min-w-[300px] max-w-md transform transition-all duration-300 ease-in-out animate-fade-in-left
            `}
          >
            <i className={`fas ${getIcon(toast.type)} text-xl mr-3`}></i>
            <p className="font-medium text-sm flex-1">{toast.message}</p>
            <button 
                onClick={() => removeToast(toast.id)} 
                className="ml-4 opacity-70 hover:opacity-100 transition"
            >
                <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
