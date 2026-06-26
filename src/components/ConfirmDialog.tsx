import React from "react";
import { Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal de confirmação reutilizável para qualquer ação destrutiva/irreversível
// (excluir, limpar, apagar) em qualquer parte do app. Mantém um único estilo visual
// consistente, em vez de depender do popup nativo window.confirm() do navegador.
export default function ConfirmDialog({
  open,
  title,
  description,
  message,
  confirmLabel = "Sim, excluir",
  cancelLabel = "Cancelar",
  loading = false,
  loadingLabel = "Excluindo...",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden">
      <div className="bg-white rounded-2xl shadow-xl border border-luxury-200/60 p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-neutral-800 font-display">{title}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="text-xs text-neutral-600 mb-5 leading-relaxed">
          {message}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer"
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer disabled:opacity-60"
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
