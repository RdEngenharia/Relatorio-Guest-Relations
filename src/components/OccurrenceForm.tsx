import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Occurrence } from "../types";
import { Save, RefreshCw, Sparkles, Utensils, Wrench, Wifi, Target, Hammer, ConciergeBell, Star, Ticket, FileText } from "lucide-react";
import { motion } from "motion/react";

interface OccurrenceFormProps {
  editingOccurrence: Occurrence | null;
  onSaveFinished: () => void;
  onCancelEdit?: () => void;
}

const SECTORS = [
  "AeB", "Estrutura", "TI", "Lazer", "Manutenção",
  "Governança", "Recepção", "All inclusive", "Wifi", "Programações", "Outro"
];

const OCCURRENCE_TYPES = ["Reclamação", "Feedback positivo", "Outro"];

const SECTOR_META: Record<string, { emoji: string }> = {
  "AeB":           { emoji: "🍽" },
  "Estrutura":     { emoji: "🔧" },
  "TI":            { emoji: "💻" },
  "Lazer":         { emoji: "🎯" },
  "Manutenção":    { emoji: "🔨" },
  "Governança":    { emoji: "✨" },
  "Recepção":      { emoji: "🛎" },
  "All inclusive": { emoji: "⭐" },
  "Wifi":          { emoji: "📶" },
  "Programações":  { emoji: "🎪" },
  "Outro":         { emoji: "📋" },
};

export default function OccurrenceForm({ editingOccurrence, onSaveFinished, onCancelEdit }: OccurrenceFormProps) {
  const getTodayISOString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    return new Date(today.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
  };

  const [date, setDate]                   = useState(getTodayISOString());
  const [bookingNumber, setBookingNumber] = useState("");
  const [apartment, setApartment]         = useState("");
  const [occurrenceType, setOccurrenceType] = useState("Reclamação");
  const [sector, setSector]               = useState("AeB");
  const [observation, setObservation]     = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [notification, setNotification]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (editingOccurrence) {
      setDate(editingOccurrence.date);
      setBookingNumber(editingOccurrence.bookingNumber);
      setApartment(editingOccurrence.apartment);
      setOccurrenceType(editingOccurrence.occurrenceType);
      setSector(editingOccurrence.sector);
      setObservation(editingOccurrence.observation);
    } else {
      resetForm();
    }
  }, [editingOccurrence]);

  const resetForm = () => {
    setDate(getTodayISOString());
    setBookingNumber("");
    setApartment("");
    setOccurrenceType("Reclamação");
    setSector("AeB");
    setObservation("");
    setNotification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !bookingNumber.trim() || !apartment.trim() || !observation.trim()) {
      setNotification({ type: "error", msg: "Por favor, preencha todos os campos obrigatórios." });
      return;
    }

    setSubmitLoading(true);
    setNotification(null);

    const docId = editingOccurrence ? editingOccurrence.id : `occ_${Date.now()}`;
    const payload = {
      date,
      bookingNumber: bookingNumber.trim(),
      apartment: apartment.trim(),
      occurrenceType,
      sector,
      observation: observation.trim(),
      source: "resort" as const,
      createdAt: editingOccurrence ? editingOccurrence.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, "occurrences", docId), payload);
      setNotification({
        type: "success",
        msg: editingOccurrence ? "Avaliação atualizada com sucesso!" : "Avaliação registrada com sucesso!"
      });
      if (!editingOccurrence) resetForm();
      setTimeout(() => { onSaveFinished(); }, 1000);
    } catch (err: any) {
      handleFirestoreError(err, editingOccurrence ? OperationType.UPDATE : OperationType.CREATE, `occurrences/${docId}`);
      setNotification({ type: "error", msg: "Erro ao salvar os dados. Tente novamente." });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div id="occurrence-form-wrapper" className="bg-white rounded-2xl border border-luxury-200 shadow-sm p-6 relative">
      {editingOccurrence && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-xs uppercase font-mono bg-brass-500/10 text-brass-600 px-2 py-1 rounded font-medium">
            Editando Registro
          </span>
          {onCancelEdit && (
            <button type="button" onClick={onCancelEdit}
              className="p-1 hover:bg-luxury-100 rounded-lg cursor-pointer text-neutral-400 hover:text-neutral-600 transition-all">
              <FileText className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold font-display text-neutral-800 mb-6">
        {editingOccurrence ? "Editar Avaliação" : "Nova Avaliação"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Data, Reserva, Apartamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Data *</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Nº Reserva *</label>
            <input type="text" required placeholder="Ex: 117228" value={bookingNumber} onChange={e => setBookingNumber(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Apartamento *</label>
            <input type="text" required placeholder="Ex: 98" value={apartment} onChange={e => setApartment(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
        </div>

        {/* Tipo de Ocorrência e Setor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Tipo de Ocorrência *</label>
            <div className="flex bg-luxury-50 p-1 border border-luxury-200 rounded-xl gap-1">
              {OCCURRENCE_TYPES.map(type => (
                <button key={type} type="button" onClick={() => setOccurrenceType(type)}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${occurrenceType === type ? "bg-white text-luxury-800 shadow-sm border border-luxury-200" : "text-neutral-500 hover:text-neutral-700"}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2 uppercase tracking-wider">Setor / Categoria *</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {SECTORS.map(sec => {
                const meta = SECTOR_META[sec] || { emoji: "📋" };
                return (
                  <button key={sec} type="button" onClick={() => setSector(sec)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-bold ${sector === sec ? "bg-luxury-800 text-white border-luxury-800 shadow-sm" : "bg-white text-neutral-600 border-luxury-200 hover:bg-luxury-50 hover:border-luxury-300"}`}>
                    <span className="text-base">{meta.emoji}</span>
                    <span className="text-[10px] leading-tight">{sec}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
            Observação / Descrição *
          </label>
          <textarea required rows={4}
            placeholder="Relate detalhadamente o caso (ex: Hóspede do apartamento 98 reclamou que o wi-fi oscila muito na área de lazer)"
            value={observation} onChange={e => setObservation(e.target.value)}
            className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none resize-none" />
        </div>

        {/* Notificação */}
        {notification && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-xl text-xs font-medium ${notification.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"}`}>
            {notification.msg}
          </motion.div>
        )}

        {/* Ações */}
        <div className="flex gap-2">
          {editingOccurrence && onCancelEdit && (
            <button type="button" onClick={onCancelEdit}
              className="flex-1 py-2.5 bg-luxury-100 hover:bg-luxury-200 text-neutral-600 text-xs font-medium uppercase tracking-wider rounded-xl transition-all cursor-pointer">
              Cancelar
            </button>
          )}
          <button type="submit" disabled={submitLoading} id="submit-form-btn"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-luxury-800 hover:bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-80 cursor-pointer shadow-md">
            {submitLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {submitLoading ? "Gravando..." : editingOccurrence ? "Salvar Alterações" : "Salvar Avaliação"}
          </button>
        </div>
      </form>
    </div>
  );
}
