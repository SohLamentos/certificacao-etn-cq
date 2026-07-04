import React from 'react';
import { motion } from 'motion/react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  technicianName: string;
  certificationType: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ 
  technicianName, 
  certificationType, 
  onConfirm, 
  onCancel 
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl border border-claro-border w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-5"
        id="delete-confirm-modal"
      >
        {/* Warning Icon Banner */}
        <div className="flex items-center space-x-3.5">
          <div className="bg-red-50 text-claro-red p-3 rounded-full border border-red-100 flex-shrink-0 animate-bounce">
            <AlertTriangle size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-claro-dark leading-tight">
              Confirmar Exclusão?
            </h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Ação Irreversível
            </p>
          </div>
        </div>

        {/* Informative text */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-semibold text-slate-600 leading-relaxed space-y-1">
          <p>Você está prestes a excluir permanentemente o registro de:</p>
          <p className="text-sm font-extrabold text-claro-dark mt-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-claro-red"></span>
            {technicianName}
          </p>
          <p className="text-xs text-slate-500 font-medium italic mt-0.5">
            Certificação: {certificationType}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3.5 border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer text-center"
            id="btn-delete-cancel"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer text-center border-b-2 border-red-800 active:border-b-0 active:translate-y-0.5"
            id="btn-delete-confirm"
          >
            <Trash2 size={14} />
            <span>Sim, Excluir</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
