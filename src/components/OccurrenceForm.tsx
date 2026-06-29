import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Occurrence } from "../types";
import { Sparkles, Save, Check, RefreshCw, X } from "lucide-react";
import { motion } from "motion/react";

interface OccurrenceFormProps {
  editingOccurrence: Occurrence | null;
  onSaveFinished: () => void;
  onCancelEdit?: () => void;
}

const SECTORS = [
  "AeB",
  "Estrutura",
  "TI",
  "Lazer",
  "Manutenção",
  "Governança",
  "Recepção",
  "All inclusive",
  "Wifi",
  "Programações",
  "Outro"
];

const OCCURRENCE_TYPES = ["Reclamação", "Feedback positivo", "Outro"];

export default function OccurrenceForm({
  editingOccurrence,
  onSaveFinished,
  onCancelEdit
}: OccurrenceFormProps) {
  const getTodayISOString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - offset * 60 * 1000);
    return localToday.toISOString().split("T")[0];
  };

  const [date, setDate] = useState(getTodayISOString());
  const [bookingNumber, setBookingNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [occurrenceType, setOccurrenceType] = useState("Reclamação");
  const [sector, setSector] = useState("AeB");
  const [observation, setObservation] = useState("");
  const [source, setSource] = useState<"resort" | "google">("resort");

  const [aiLoading, setAiLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (editingOccurrence) {
      setDate(editingOccurrence.date);
      setBookingNumber(editingOccurrence.bookingNumber);
      setApartment(editingOccurrence.apartment);
      setOccurrenceType(editingOccurrence.occurrenceType);
      setSector(editingOccurrence.sector);
      setObservation(editingOccurrence.observation);
      setSource(editingOccurrence.source || "resort");
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
    setSource("resort");
    setNotification(null);
  };

  const handleAiCategorize = async () => {
    if (!observation || observation.trim().length < 8) {
      setNotification({
        type: "error",
        msg: "Por favor, digite uma descrição detalhada de pelo menos 8 caracteres para a análise da IA."
      });
      return;
    }

    setAiLoading(true);
    setNotification(null);

    try {
      const response = await fetch("/api/gemini/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observation })
      });

      if (!response.ok) {
        throw new Error("Resposta inesperada do servidor ao categorizar.");
      }

      const data = await response.json();
      
      // Update form state with AI suggestions
      if (data.occurrenceType && OCCURRENCE_TYPES.includes(data.occurrenceType)) {
        setOccurrenceType(data.occurrenceType);
      }
      if (data.sector && SECTORS.includes(data.sector)) {
        setSector(data.sector);
      }

      setNotification({
        type: "success",
        msg: `IA analisou e sugeriu: [${data.occurrenceType}] para o setor [${data.sector}].`
      });
    } catch (err: any) {
      console.error(err);
      setNotification({
        type: "error",
        msg: "Não foi possível carregar sugestões da IA agora. Selecione as categorias manualmente."
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isGoogle = source === "google";
    const finalBooking = isGoogle ? (bookingNumber.trim() || "S/R") : bookingNumber.trim();
    const finalApartment = isGoogle ? (apartment.trim() || "S/A") : apartment.trim();

    if (!date || (!isGoogle && !finalBooking) || (!isGoogle && !finalApartment) || !observation) {
      setNotification({
        type: "error",
        msg: "Por favor, preencha todos os campos obrigatórios."
      });
      return;
    }

    setSubmitLoading(true);
    setNotification(null);

    const docId = editingOccurrence ? editingOccurrence.id : `occ_${Date.now()}`;
    const payload: Record<string, unknown> = {
      date,
      bookingNumber: finalBooking,
      apartment: finalApartment,
      occurrenceType,
      sector,
      observation: observation.trim(),
      source,
      createdAt: editingOccurrence ? editingOccurrence.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (editingOccurrence?.ratings) {
      payload.ratings = editingOccurrence.ratings;
    }

    try {
      await setDoc(doc(db, "occurrences", docId), payload);
      setNotification({
        type: "success",
        msg: editingOccurrence ? "Ocorrência atualizada com sucesso!" : "Ocorrência registrada com sucesso!"
      });
      
      // Keep state if editing, otherwise reset
      if (!editingOccurrence) {
        resetForm();
      }
      
      setTimeout(() => {
        onSaveFinished();
      }, 1000);
    } catch (err: any) {
      handleFirestoreError(err, editingOccurrence ? OperationType.UPDATE : OperationType.CREATE, `occurrences/${docId}`);
      setNotification({
        type: "error",
        msg: "Erro ao salvar os dados no Firestore."
      });
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
            <button
              onClick={onCancelEdit}
              id="cancel-edit-btn"
              className="p-1 hover:bg-luxury-100 rounded text-neutral-500 transition-colors cursor-pointer"
              title="Cancelar Edição"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold font-display text-neutral-800 flex items-center gap-2 mb-6">
        <span>{editingOccurrence ? "Atualizar Ocorrência" : "Novo Registro Diário"}</span>
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Canal de Origem */}
        <div id="form-field-source" className="bg-luxury-50/50 p-4 rounded-xl border border-luxury-200/60 mb-5 text-neutral-700">
          <label className="block text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider font-display">
            Canal de Origem da Ocorrência *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setSource("resort");
              }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border text-center ${
                source === "resort"
                  ? "bg-luxury-800 text-white border-luxury-800 shadow-sm"
                  : "bg-white text-neutral-600 border-luxury-200 hover:bg-luxury-50"
              }`}
            >
              🏨 Resort (Captado Internamente)
            </button>
            <button
              type="button"
              onClick={() => {
                setSource("google");
              }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border text-center ${
                source === "google"
                  ? "bg-luxury-800 text-white border-luxury-800 shadow-sm"
                  : "bg-white text-neutral-600 border-luxury-200 hover:bg-luxury-50"
              }`}
            >
              🌐 Reclamação do Google
            </button>
          </div>
        </div>

        {/* Reservation, Apartment & Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div id="form-field-date">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
              Data da Ocorrência *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none"
            />
          </div>

          <div id="form-field-booking">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>Nº Reserva {source === "google" ? "(Opcional)" : "*"}</span>
              {source === "google" && <span className="text-[10px] text-brass-600 lowercase font-mono">salva como S/R</span>}
            </label>
            <input
              type="text"
              required={source !== "google"}
              placeholder={source === "google" ? "Sem Reserva (S/R)" : "Ex: 117228"}
              value={bookingNumber}
              onChange={(e) => setBookingNumber(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none"
            />
          </div>

          <div id="form-field-apt">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>Apartamento {source === "google" ? "(Opcional)" : "*"}</span>
              {source === "google" && <span className="text-[10px] text-brass-600 lowercase font-mono">salva como S/A</span>}
            </label>
            <input
              type="text"
              required={source !== "google"}
              placeholder={source === "google" ? "Sem Apto (S/A)" : "Ex: 98"}
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Categories Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div id="form-field-type">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
              Tipo de Ocorrência *
            </label>
            <div className="flex bg-luxury-50 p-1 border border-luxury-200 rounded-xl gap-1">
              {OCCURRENCE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOccurrenceType(type)}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    occurrenceType === type
                      ? "bg-white text-luxury-800 shadow-sm border border-luxury-200"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div id="form-field-sector">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
              Setor de Reclamação / Categoria *
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none cursor-pointer"
            >
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Observation text block with AI button inside / on label */}
        <div id="form-field-observation">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Observação / Descrição da Ocorrência *
            </label>
            <button
              type="button"
              onClick={handleAiCategorize}
              disabled={aiLoading}
              id="ai-parse-btn"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brass-500/10 hover:bg-brass-500/20 text-brass-600 rounded-lg text-[11px] font-semibold tracking-wide uppercase transition-all disabled:opacity-50 cursor-pointer"
              title="Classificar tipo e setor de reclamação automaticamente via Inteligência Artificial"
            >
              {aiLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {aiLoading ? "Analisando..." : "Classificar com IA"}
            </button>
          </div>
          <textarea
            required
            rows={4}
            placeholder="Relate detalhadamente o caso relatado pelo hóspede (ex: Hóspede do apartamento 98 reclamou que o wi-fi oscila muito na área de lazer, impedindo reuniões de trabalho)"
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            className="w-full text-sm rounded-xl border border-luxury-200 bg-luxury-50 px-3.5 py-2.5 focus:border-brass-500 focus:ring-1 focus:ring-brass-500 transition-all outline-none resize-none font-sans"
          />
        </div>

        {/* Notifications and Alerts */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            id="form-feedback-alert"
            className={`p-3 rounded-xl text-xs font-medium ${
              notification.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {notification.msg}
          </motion.div>
        )}

        {/* Form Action Controls */}
        <div className="flex gap-2">
          {editingOccurrence && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex-1 py-2.5 bg-luxury-100 hover:bg-luxury-200 text-neutral-600 text-xs font-medium uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={submitLoading}
            id="submit-form-btn"
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 bg-luxury-800 hover:bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-80 cursor-pointer shadow-md"
          >
            {submitLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {submitLoading ? "Gravando..." : editingOccurrence ? "Salvar Alterações" : "Salvar Registro"}
          </button>
        </div>
      </form>
    </div>
  );
}
