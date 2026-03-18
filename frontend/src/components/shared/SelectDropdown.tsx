import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";

interface SelectDropdownProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  label?: string;
  icon?: React.ReactNode;
}

export function SelectDropdown({ value, options, onChange, label, icon }: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-slate-300 transition-colors shadow-sm"
      >
        {icon}
        <span className="hidden sm:inline">{label}:</span> <span className="text-slate-900">{value}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
      </button>
      
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-100 rounded-xl shadow-xl z-20 p-2 grid grid-cols-2 gap-2"
          >
            {options.map((opt, idx) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-center gap-2 ${
                  value === opt 
                    ? 'border-[#3721ED] bg-[#3721ED]/5 text-[#3721ED] shadow-sm' 
                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className={`w-full h-12 rounded bg-white border border-slate-200 flex items-center justify-center text-[10px] uppercase font-bold tracking-wider ${value === opt ? 'text-[#3721ED]' : 'text-slate-400'}`}>
                  Preview {idx + 1}
                </div>
                <span className="text-xs font-semibold">{opt}</span>
              </button>
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
