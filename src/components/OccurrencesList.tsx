import React, { useState } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { Occurrence } from "../types";
import { Search, Filter, Edit3, Trash2, Calendar, ClipboardX, ThumbsUp, AlertTriangle, AlertCircle, RefreshCw, Hotel, Globe, Printer } from "lucide-react";
import { motion } from "motion/react";

interface OccurrencesListProps {
  occurrences: Occurrence[];
  onEditRequested: (occ: Occurrence) => void;
  onDeleteSuccess: () => void;
}

const SECTORS = [
  "Todos",
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

const OCCURRENCE_TYPES = ["Todos", "Reclamação", "Feedback positivo", "Outro"];

export default function OccurrencesList({
  occurrences,
  onEditRequested,
  onDeleteSuccess
}: OccurrencesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState("Todos");
  const [selectedType, setSelectedType] = useState("Todos");
  const [activeSheet, setActiveSheet] = useState<"resort" | "google">("resort");

  // Date filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente riscar e excluir permanentemente este registro do sistema?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "occurrences", id));
      onDeleteSuccess();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `occurrences/${id}`);
    }
  };

  const cleanDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  // Advanced search/filtering logic
  const filtered = occurrences.filter((occ) => {
    // 0. Sheet (source) match
    const matchesSource = activeSheet === "google"
      ? occ.source === "google"
      : (occ.source === "resort" || !occ.source);

    // 1. Search term match (Reserva, Apto, Observacao text)
    const matchesSearch =
      occ.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      occ.apartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      occ.observation.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Sector match
    const matchesSector =
      selectedSector === "Todos" || occ.sector === selectedSector;

    // 3. Occurrence type match
    const matchesType =
      selectedType === "Todos" || occ.occurrenceType === selectedType;

    // 4. Date ranges
    const matchesStartDate = !startDate || occ.date >= startDate;
    const matchesEndDate = !endDate || occ.date <= endDate;

    return matchesSource && matchesSearch && matchesSector && matchesType && matchesStartDate && matchesEndDate;
  });

  // Sort descending by date, then by creation
  const sorted = [...filtered].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const timestampA = a.createdAt?.seconds || 0;
    const timestampB = b.createdAt?.seconds || 0;
    return timestampB - timestampA;
  });

  return (
    <div id="occurrences-list-block" className="space-y-6">
      {/* Print-Only Professional Document Header */}
      <div className="hidden print:block mb-8 border-b-2 border-neutral-800 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-neutral-900 font-display uppercase tracking-wider">
              RELATÓRIO DE OCORRÊNCIAS DIÁRIAS
            </h1>
            <p className="text-[11px] text-neutral-500 font-serif italic mt-0.5">
              Guest Relations — Registro Cronológico de Atendimento do Resort
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-brass-600 uppercase font-display block">
              {activeSheet === "google" ? "Folha Google Reviews" : "Folha Resort"}
            </span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1 block">
              Período: {startDate ? startDate.split("-").reverse().join("/") : "Inicial"} até {endDate ? endDate.split("-").reverse().join("/") : "Fim"}
            </span>
            <span className="text-[10px] font-sans text-neutral-700 mt-0.5 block font-semibold">
              Total de Ocorrências: {sorted.length}
            </span>
          </div>
        </div>
      </div>

      {/* Folhas Separadas Switcher */}
      <div id="list-sheets-tab-selector" className="bg-white p-1.5 rounded-2xl border border-luxury-200 flex flex-col sm:flex-row gap-1.5 shadow-xs">
        <button
          onClick={() => setActiveSheet("resort")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 border ${
            activeSheet === "resort"
              ? "bg-luxury-800 text-white border-luxury-800 shadow-sm"
              : "bg-white text-neutral-500 border-transparent hover:bg-luxury-50"
          }`}
        >
          <Hotel className="w-4 h-4 text-brass-500" />
          <span>Folha Resort (Captadas no Resort)</span>
        </button>
        <button
          onClick={() => setActiveSheet("google")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 border ${
            activeSheet === "google"
              ? "bg-luxury-800 text-white border-luxury-800 shadow-sm"
              : "bg-white text-neutral-500 border-transparent hover:bg-luxury-50"
          }`}
        >
          <Globe className="w-4 h-4 text-brass-500" />
          <span>Folha Google (Reclamações do Google)</span>
        </button>
      </div>

      {/* Search & Advanced Filters Container */}
      <div id="search-filter-card" className="bg-white rounded-2xl border border-luxury-200 p-6 space-y-4">
        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-brass-500" />
          <span>Filtros & Pesquisa Direta</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Term Search Box */}
          <div id="term-search-wrapper" className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Pesquisar por reserva, apto ou termo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 pl-10 pr-4 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none placeholder:text-neutral-400 font-medium"
            />
          </div>

          {/* Type of Incident Filter */}
          <div id="type-filter-wrapper">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 px-3.5 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer font-medium"
            >
              {OCCURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  Tipo: {t === "Todos" ? "Todos os Tipos" : t}
                </option>
              ))}
            </select>
          </div>

          {/* Sector Filter Box */}
          <div id="sector-filter-wrapper">
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 px-3.5 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer font-medium"
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  Setor: {s === "Todos" ? "Todos os Setores" : s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Ranges Filters Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-luxury-200/50">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block font-sans">Período de Ocorrências:</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-1.5 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer"
              />
              <span className="text-neutral-400 text-xs">a</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-1.5 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer"
              />
            </div>
          </div>

          {(startDate || endDate) && (
            <button
              onClick={cleanDateFilters}
              id="clear-range-btn"
              className="text-xs text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider cursor-pointer font-sans"
            >
              Limpar Filtro de Data
            </button>
          )}
        </div>
      </div>

      {/* Occurrences Data Table */}
      <div id="data-table-card" className="bg-white rounded-2xl border border-luxury-200 p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-luxury-100 pb-4">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold font-display uppercase tracking-widest text-neutral-800">
              Histórico de Ocorrências ({sorted.length})
            </h4>
            <span className="text-[10px] font-mono text-neutral-400 block">Listando data mais recente primeiro</span>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              disabled={sorted.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm border border-emerald-700 font-display"
              title="Baixar ou Imprimir este Histórico filtrado em PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Histórico (PDF)
            </button>
          </div>
        </div>

        {sorted.length > 0 ? (
          <div className="space-y-4">
            {/* Desktop Spreadsheet Tabular View (printed beautifully regardless of screen size) */}
            <div id="desktop-spreadsheet" className="hidden lg:block print:block overflow-x-auto border border-luxury-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                <thead>
                  <tr className="bg-luxury-100/80 border-b border-luxury-200 font-bold text-neutral-600 font-display">
                    <th className="py-3 px-4 w-28">DATA</th>
                    <th className="py-3 px-4 w-24">Nº RESERVA</th>
                    <th className="py-3 px-4 w-20">APTO</th>
                    <th className="py-3 px-4 w-36">TIPO DE OCORRÊNCIA</th>
                    <th className="py-3 px-4 w-32">SETOR / RECLAMAÇÃO</th>
                    <th className="py-3 px-4">OBSERVAÇÃO</th>
                    <th className="py-3 px-4 text-right w-24 print:hidden">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((occ) => {
                    // Pre-convert dates to format readable like "01/Mai" shown in pics
                    const dateObj = new Date(occ.date + "T12:00:00");
                    const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                    const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${monthNames[dateObj.getMonth()]}`;

                    return (
                      <tr key={occ.id} className="border-b border-luxury-200/60 align-middle hover:bg-luxury-50 transition-colors font-sans">
                        <td className="py-3 px-4 font-semibold text-neutral-800 uppercase tabular-nums">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-neutral-650">
                          {occ.bookingNumber === "S/R" ? (
                            <span className="text-neutral-400 italic font-sans text-[10px]">Sem Reserva</span>
                          ) : (
                            occ.bookingNumber
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-neutral-800">
                          {occ.apartment === "S/A" ? (
                            <span className="text-neutral-400 italic font-sans font-normal text-[10px]">Sem Apto</span>
                          ) : (
                            occ.apartment
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              occ.occurrenceType === "Reclamação"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                                : occ.occurrenceType === "Feedback positivo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-neutral-100 text-neutral-800 border border-neutral-200"
                            }`}
                          >
                            {occ.occurrenceType === "Reclamação" ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : occ.occurrenceType === "Feedback positivo" ? (
                              <ThumbsUp className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {occ.occurrenceType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-neutral-700 font-display">
                          {occ.sector}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 font-normal pr-4 print:text-xs leading-relaxed" title={occ.observation}>
                          {occ.observation}
                        </td>
                        <td className="py-3 px-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onEditRequested(occ)}
                              className="p-1.5 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer transition-colors"
                              title="Editar Registro"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(occ.id)}
                              className="p-1.5 hover:bg-rose-50 text-neutral-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                              title="Excluir Registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Feed list */}
            <div id="mobile-responsive-feed" className="block lg:hidden print:hidden space-y-3.5">
              {sorted.map((occ) => {
                const dateObj = new Date(occ.date + "T12:00:00");
                const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
                const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${monthNames[dateObj.getMonth()]}`;

                return (
                  <div key={occ.id} className="p-4 rounded-xl border border-luxury-200 bg-white hover:shadow-xs transition-shadow space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {occ.apartment !== "S/A" && (
                          <span className="font-mono text-xs font-extrabold uppercase bg-luxury-100 text-neutral-700 px-2 py-0.5 rounded">
                            Apto {occ.apartment}
                          </span>
                        )}
                        {occ.bookingNumber !== "S/R" && (
                          <span className="font-mono text-xs text-neutral-500 font-medium">
                            Res. {occ.bookingNumber}
                          </span>
                        )}
                        {occ.apartment === "S/A" && occ.bookingNumber === "S/R" && (
                          <span className="text-[10px] text-brass-600 italic bg-brass-500/10 px-2 py-0.5 rounded border border-brass-200/40 font-semibold flex items-center gap-1.5 font-display uppercase tracking-wider">
                            <Globe className="w-3 h-3" /> Google Review
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold uppercase text-neutral-800 tab-nums">
                        {formattedDate}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-650 leading-relaxed font-sans line-clamp-3">
                      {occ.observation}
                    </p>

                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-luxury-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-neutral-800 uppercase font-display bg-brass-500/10 text-brass-700 px-2 py-0.5 rounded">
                          {occ.sector}
                        </span>
                        <span className="text-[9px] uppercase font-semibold text-neutral-500">
                          {occ.occurrenceType}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onEditRequested(occ)}
                          className="p-1 px-2 hover:bg-neutral-100 text-neutral-600 rounded bg-luxury-50 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(occ.id)}
                          className="p-1 px-2 hover:bg-rose-50 text-rose-600 rounded bg-rose-50/5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div id="no-data-placeholder" className="text-center py-12 text-neutral-400 text-xs border border-dashed border-luxury-200 rounded-xl bg-luxury-50">
            <ClipboardX className="w-12 h-12 stroke-1 text-neutral-300 mx-auto mb-2" />
            <p className="font-semibold text-neutral-600 text-sm">Nenhuma ocorrência encontrada.</p>
            <p className="text-xs mt-1 text-neutral-400">Sua busca ou filtro não retornou registros ou a base está vazia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
