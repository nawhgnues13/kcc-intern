import { motion, AnimatePresence } from "motion/react";

interface ModalLayoutProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  closeOnBackdropClick?: boolean;
}

export function ModalLayout({ 
  isOpen, 
  onClose, 
  children, 
  maxWidthClass = "max-w-md",
  closeOnBackdropClick = true
}: ModalLayoutProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
          className={`bg-white w-full ${maxWidthClass} rounded-3xl shadow-2xl relative flex flex-col`}
        >
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
