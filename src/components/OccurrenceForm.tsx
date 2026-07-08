import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Occurrence } from "../types";
import { Save, RefreshCw, Utensils, Wrench, Wifi, Target, Hammer, Sparkles, ConciergeBell, Star, Ticket, FileText } from "lucide-react";
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

// 13 categorias Flexspot com label legível
const RATING_LABELS: { key: string; label: string; color: string }[] = [
  { key: "satisfacaoGeral",      label: "Satisfação Geral",    color: "#9333ea" },
  { key: "atendimentoGeral",     label: "Atendimento Geral",   color: "#d97706" },
  { key: "recepcao",             label: "Recepção",            color: "#ea580c" },
  { key: "wifi",                 label: "Wi-Fi / Conexão",     color: "#4338ca" },
  { key: "alimentacao",          label: "Alimentação",         color: "#1c3d5a" },
  { key: "bebidas",              label: "Bebidas",             color: "#0369a1" },
  { key: "boutique",             label: "Boutique",            color: "#be185d" },
  { key: "areasSociais",         label: "Áreas Sociais",       color: "#0891b2" },
  { key: "limpezaApartamento",   label: "Limpeza do Apto",     color: "#0e7490" },
  { key: "estruturaApartamento", label: "Estrutura do Apto",   color: "#65a30d" },
  { key: "equipeLazer",          label: "Equipe de Lazer",     color: "#ca8a04" },
  { key: "estruturaLazer",       label: "Estrutura de Lazer",  color: "#16a34a" },
  { key: "parqueAventuras",      label: "Parque de Aventuras", color: "#059669" },
];

export default function OccurrenceForm({ editingOccurrence, onSaveFinished, onCancelEdit }: OccurrenceFormProps) {
  const getTodayISOString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    return new Date(today.getTime() - offset * 60 * 1000).toISOString().split("T")[0];
  };

  const [date, setDate]                     = useState(getTodayISOString());
  const [bookingNumber, setBookingNumber]   = useState("");
  const [apartment, setApartment]           = useState("");
  const [guestName, setGuestName]           = useState("");
  const [occurrenceType, setOccurrenceType] = useState("Reclamação");
  const [sector, setSector]                 = useState("AeB");
  const [observation, setObservation]       = useState("");
  const [submitLoading, setSubmitLoading]   = useState(false);
  const [notification, setNotification]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

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
    setGuestName("");
    setOccurrenceType("Reclamação");
    setSector("AeB");
    setObservation("");
    setNotification(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !apartment.trim() || !observation.trim() || (!editingOccurrence && !guestName.trim())) {
      setNotification({ type: "error", msg: "Por favor, preencha todos os campos obrigatórios." });
      return;
    }
    if (editingOccurrence && !bookingNumber.trim()) {
      setNotification({ type: "error", msg: "Por favor, preencha o Nº de Reserva." });
      return;
    }

    setSubmitLoading(true);
    setNotification(null);

    const isOrganic = !editingOccurrence;
    const docId = editingOccurrence ? editingOccurrence.id : `organic_${Date.now()}`;

    // Para avaliações orgânicas, o nome do hóspede é salvo em generalInfo
    // para que o algoritmo de merge do Flexspot possa encontrá-lo depois
    // pelo critério: apartamento + nome + data
    const payload: any = {
      date,
      bookingNumber: bookingNumber.trim() || `ORG-${apartment.trim()}-${Date.now().toString().slice(-4)}`,
      apartment: apartment.trim(),
      occurrenceType,
      sector: sector || "Geral",
      observation: observation.trim(),
      source: editingOccurrence?.source || (isOrganic ? "organic" : "resort"),
      createdAt: editingOccurrence ? editingOccurrence.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (isOrganic && guestName.trim()) {
      payload.generalInfo = { guestName: guestName.trim() };
    }

    // Preserva ratings e generalInfo existentes ao editar
    if (editingOccurrence?.ratings) payload.ratings = editingOccurrence.ratings;
    if (editingOccurrence?.generalInfo) payload.generalInfo = editingOccurrence.generalInfo;

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

  // Verifica se tem notas Flexspot para mostrar
  const hasRatings = !!(editingOccurrence?.ratings &&
    Object.values(editingOccurrence.ratings).some(v => v !== null && v !== undefined));

  const ratingsToShow = hasRatings
    ? RATING_LABELS.filter(r => {
        const val = (editingOccurrence!.ratings as any)?.[r.key];
        return val !== null && val !== undefined;
      })
    : [];

  return (
    <div id="occurrence-form-wrapper" className="bg-white rounded-2xl border border-luxury-200 shadow-sm p-6 relative">
      {editingOccurrence && (
        <div className="absolute top-4 right-4">
          <span className="text-xs uppercase font-mono bg-brass-500/10 text-brass-600 px-2 py-1 rounded font-medium">
            Editando Registro
          </span>
        </div>
      )}

      <h3 className="text-base font-semibold font-display text-neutral-800 mb-2">
        {editingOccurrence ? "Editar Avaliação" : "Nova Avaliação Orgânica"}
      </h3>

      {/* Aviso de avaliação orgânica */}
      {!editingOccurrence && (
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <span className="text-lg shrink-0">🔔</span>
          <div>
            <p className="text-xs font-bold text-amber-700">Avaliação registrada organicamente</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Esta avaliação <strong>não terá pontuação</strong> e <strong>não entrará no gráfico</strong> até que o hóspede responda a pesquisa no Flexspot. Ela serve para registrar o atendimento e acompanhamento da equipe.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Data, Reserva, Apartamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Data *</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
              Nº Reserva {editingOccurrence ? "*" : <span className="text-neutral-400 normal-case">(opcional)</span>}
            </label>
            <input type="text" placeholder="Ex: 117228" value={bookingNumber} onChange={e => setBookingNumber(e.target.value)}
              required={!!editingOccurrence}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Apartamento *</label>
            <input type="text" required placeholder="Ex: 98" value={apartment} onChange={e => setApartment(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
        </div>

        {/* Nome do hóspede — essencial para orgânicos (permite merge futuro com Flexspot) */}
        {!editingOccurrence && (
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
              Nome do Hóspede *
              <span className="text-amber-600 text-[10px] normal-case font-normal ml-1">(usado para localizar a avaliação do Flexspot depois)</span>
            </label>
            <input type="text" required placeholder="Ex: João Silva" value={guestName} onChange={e => setGuestName(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none" />
          </div>
        )}

        {/* Tipo e Setor */}
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

        {/* Notas Flexspot — somente leitura, visível apenas ao editar registros com pontuação */}
        {hasRatings && (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-2">
              ⭐ Notas do Flexspot — como o hóspede avaliou cada setor
              <span className="text-[10px] font-normal text-indigo-400 normal-case tracking-normal">(escala 1 a 5 • somente leitura)</span>
            </p>
            <div className="space-y-2">
              {ratingsToShow.map(r => {
                const val = (editingOccurrence!.ratings as any)?.[r.key] as number;
                const pct = (val / 5) * 100;
                const badgeClass = val >= 4 ? "text-emerald-700 bg-emerald-50" : val >= 3 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
                return (
                  <div key={r.key} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-neutral-600 w-36 shrink-0">{r.label}</span>
                    <div className="flex-1 bg-white h-2.5 rounded-full overflow-hidden border border-indigo-100">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: r.color }} />
                    </div>
                    <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-lg w-10 text-center shrink-0 ${badgeClass}`}>
                      {val}/5
                    </span>
                  </div>
                );
              })}
            </div>
            {editingOccurrence?.generalInfo?.primeiraVez && (
              <p className="text-[10px] text-indigo-500 mt-3">
                {editingOccurrence.generalInfo.primeiraVez === "Sim" ? "🏨 Primeira hospedagem" : "🔄 Hóspede recorrente"}
              </p>
            )}
          </div>
        )}

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
