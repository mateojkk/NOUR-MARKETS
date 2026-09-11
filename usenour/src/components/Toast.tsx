import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import styles from "./Toast.module.css";

export interface ToastData {
  id: string;
  type: "success" | "error";
  message: string;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const isError = toast.type === "error";
  // Error toasts stay 6s so users have time to read, success 4s
  const duration = isError ? 6000 : 4000;
  const [isPaused, setIsPaused] = useState(false);
  const remainingRef = useRef(duration);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (isPaused) return;

    startTimeRef.current = Date.now();
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, remainingRef.current);

    return () => {
      clearTimeout(timer);
      remainingRef.current -= Date.now() - startTimeRef.current;
    };
  }, [toast.id, onRemove, isPaused]);

  return (
    <motion.div 
      layout
      initial={{ y: -24, opacity: 0, scale: 0.92 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -16, opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
      transition={{ 
        type: "spring", 
        damping: 24, 
        stiffness: 400,
        mass: 0.8
      }}
      className={`${styles.toast} ${isError ? styles.toastError : styles.toastSuccess}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      role="alert"
    >
      <div className={styles.toastIconWrap}>
        {isError ? (
          <AlertCircle size={18} className={styles.iconError} />
        ) : (
          <CheckCircle2 size={18} className={styles.iconSuccess} />
        )}
      </div>

      <div className={styles.toastContent}>
        <span className={styles.toastMessage}>{toast.message}</span>
      </div>

      <button
        type="button"
        className={styles.toastCloseBtn}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(toast.id);
        }}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className={styles.toastContainer}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing toasts
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

export default Toast;
