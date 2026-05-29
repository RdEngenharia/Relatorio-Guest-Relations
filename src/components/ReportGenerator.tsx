import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { Occurrence, SectorSummary, SavedReport } from "../types";
import { Sparkles, FileText, Save, Printer, Trash2, Calendar, FileDown, History, Check, ShieldAlert, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface ReportGeneratorProps {
  occurrences: Occurrence[];
}

export default function ReportGenerator({ occurrences }: ReportGeneratorProps) {
  const getInitialStartDate = () => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split("T")[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [title, setTitle] = useState("RELATÓRIO DE OCORRÊNCIAS MAIO");
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [summaries, setSummaries] = useState<SectorSummary[]>([]);
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Saved reports history state
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedSavedReport, setSelectedSavedReport] = useState<SavedReport | null>(null);

  // Subscribe to saved reports on load
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "reports"),
      (snapshot) => {
        const list: SavedReport[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SavedReport);
        });
        // Sort reports by creation date descending
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setSavedReports(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "reports");
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter occurrences in the chosen range
  const rangeOccurrences = occurrences.filter((occ) => {
    return occ.date >= startDate && occ.date <= endDate;
  });

  const handleGenerateAiReport = async () => {
    if (rangeOccurrences.length === 0) {
      setAlertInfo({
        type: "error",
        text: "Nenhuma ocorrência registrada no período selecionado para sintetizar."
      });
      return;
    }

    setIsCompiling(true);
    setAlertInfo(null);
    setSelectedSavedReport(null);

    // Map occurrences list for Gemini context payload
    const payload = rangeOccurrences.map((o) => ({
      date: o.date,
      bookingNumber: o.bookingNumber,
      apartment: o.apartment,
      occurrenceType: o.occurrenceType,
      sector: o.sector,
      observation: o.observation
    }));

    try {
      const response = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrences: payload, title })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Erro no compilador.");
      }

      const data = await response.json();
      setSummaries(data.sectorSummaries || []);
      setAlertInfo({
        type: "success",
        text: "Relatório de Gestão Inteligente gerado com sucesso por Inteligência Artificial!"
      });
    } catch (err: any) {
      console.error(err);
      setAlertInfo({
        type: "error",
        text: err.message || "Erro de conexão com o compilador de IA. Tente carregar novamente se o servidor estiver pendente de chaves."
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSaveReport = async () => {
    if (summaries.length === 0) {
      setAlertInfo({ type: "error", text: "Gere o relatório antes de salvá-lo." });
      return;
    }

    setIsSaving(true);
    setAlertInfo(null);

    const reportId = selectedSavedReport ? selectedSavedReport.id : `rep_${Date.now()}`;
    const payload = {
      title: title.trim() || `${startDate} a ${endDate}`,
      startDate,
      endDate,
      sectorSummaries: JSON.stringify(summaries),
      createdAt: selectedSavedReport ? selectedSavedReport.createdAt : serverTimestamp()
    };

    try {
      await setDoc(doc(db, "reports", reportId), payload);
      setAlertInfo({ type: "success", text: "Relatório salvo com sucesso no painel histórico!" });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `reports/${reportId}`);
      setAlertInfo({ type: "error", text: "Erro ao persistir no Firebase." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente riscar e excluir permanentemente este relatório do histórico?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "reports", id));
      if (selectedSavedReport?.id === id) {
        setSelectedSavedReport(null);
        setSummaries([]);
      }
      setAlertInfo({ type: "success", text: "Relatório apagado com sucesso!" });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${id}`);
    }
  };

  const handleLoadSavedReport = (report: SavedReport) => {
    setSelectedSavedReport(report);
    setTitle(report.title);
    setStartDate(report.startDate);
    setEndDate(report.endDate);
    try {
      setSummaries(JSON.parse(report.sectorSummaries));
    } catch {
      setSummaries([]);
    }
    setAlertInfo({ type: "success", text: `Relatório histórico '${report.title}' carregado.` });
  };

  // Export current list to Excel CSV matching columns in pictures
  const handleExportCSV = () => {
    if (rangeOccurrences.length === 0) {
      setAlertInfo({ type: "error", text: "Nada para exportar na data selecionada." });
      return;
    }

    const headers = ["DATA", "Nº RESERVA", "APTO", "TIPO DE OCORRÊNCIA", "TIPO DE RECLAMAÇÃO", "OBSERVAÇÃO"];
    const rows = rangeOccurrences.map(o => [
      o.date,
      o.bookingNumber,
      o.apartment,
      o.occurrenceType,
      o.sector,
      o.observation.replace(/"/g, '""') // Escape quotes
    ]);

    // Force UTF-8 encoding with BOM so Excel parses Portuguese strings correctly (acentuação, cedilhas, etc.)
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.map(val => `"${val}"`).join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ocorrencias_guest_relations_${startDate}_ate_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Standard Print Command
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="report-generator-tab" className="space-y-6">
      <div id="print-controls" className="print:hidden bg-white rounded-2xl border border-luxury-200 p-6 space-y-6">
        <h3 className="text-base font-semibold font-display text-neutral-850 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brass-500" />
          <span>Compilador Qualitativo Inteligente</span>
        </h3>

        {/* Input Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div id="param-title">
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Título do Relatório</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.toUpperCase())}
              placeholder="Ex: RELATÓRIO DE OCORRÊNCIAS ABRIL"
              className="w-full text-sm rounded-xl border border-luxury-200 px-3.5 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none"
            />
          </div>
          <div id="param-start">
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider font-display">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 px-3.5 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none"
            />
          </div>
          <div id="param-end">
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider font-display">Data Término</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm rounded-xl border border-luxury-200 px-3.5 py-2.5 bg-luxury-50 focus:border-brass-500 outline-none"
            />
          </div>
        </div>

        {/* Compile Controls Button row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-neutral-500 font-medium font-sans">
            Ocorrências no período: <strong className="text-neutral-800">{rangeOccurrences.length} registros</strong> (Reclamações: <strong className="text-rose-600">{rangeOccurrences.filter(o => o.occurrenceType === "Reclamação").length}</strong>)
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleExportCSV}
              id="export-csv-btn"
              className="inline-flex items-center gap-2 px-3 py-2 border border-luxury-200 hover:bg-luxury-100 rounded-xl text-neutral-600 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
              title="Baixar planilha EXCEL (.csv) dos dados no período escolhido"
            >
              <FileDown className="w-4 h-4 ml-0.5 text-neutral-500" />
              Planilha CSV
            </button>

            <button
              onClick={handleGenerateAiReport}
              disabled={isCompiling}
              id="ai-generate-main-btn"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brass-500 hover:bg-brass-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-75 cursor-pointer shadow-md"
              title="Reunir todas as queixas e redigir parágrafos analíticos de hotelaria usando a IA do Gemini"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              {isCompiling ? "Sintetizando..." : "Compilar com IA"}
            </button>
          </div>
        </div>

        {alertInfo && (
          <div
            id="generator-error-banner"
            className={`p-3.5 rounded-xl text-xs font-medium ${
              alertInfo.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {alertInfo.text}
          </div>
        )}
      </div>

      {/* Generated Report Card Area - Styled matching the user's excel pictures */}
      {summaries.length > 0 && (
        <div id="qualitative-report-canvas" className="bg-white rounded-2xl border border-luxury-200 p-6 md:p-8 space-y-6 shadow-sm relative">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-luxury-150/10 p-4 rounded-xl border border-luxury-200 mb-6 print:hidden">
            <span className="text-xs font-bold text-brass-600 uppercase tracking-widest font-display flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brass-500 animate-pulse" />
              <span>Relatório Prontinho! Escolha uma ação:</span>
            </span>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handlePrint}
                id="print-trigger-btn"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                title="Imprimir ou gerar arquivo PDF"
              >
                <Printer className="w-4 h-4" />
                Imprimir Relatório (PDF)
              </button>
              <button
                onClick={handleSaveReport}
                disabled={isSaving}
                id="save-report-history-btn"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-luxury-800 hover:bg-neutral-950 active:scale-[0.98] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer shadow-sm"
                title="Salvar esta compilação no histórico do resort"
              >
                <Save className="w-4 h-4 text-brass-500" />
                {isSaving ? "Gravando..." : "Salvar no Histórico"}
              </button>
            </div>
          </div>

          {/* Heading block stylized like the excel templates */}
          <div id="report-excel-header" className="text-center pb-4 border-b border-luxury-200">
            <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-400 block mb-1">
              Departamento de Guest Relations & Experiência do Hóspede
            </span>
            <h2 className="text-xl md:text-2xl font-bold font-display text-neutral-900 tracking-tight">
              {title}
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-1 font-sans">
              Incidências Analisadas de <span className="font-semibold text-neutral-700">{startDate}</span> até <span className="font-semibold text-neutral-700">{endDate}</span>
            </p>
          </div>

          {/* Excel layout style grid (Categorized Sector | Quantity | Qualitative Description) */}
          <div id="excel-styled-table" className="overflow-x-auto border border-luxury-800/20 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[650px] print:min-w-0 print:table-fixed text-sm">
              <thead>
                <tr className="bg-luxury-800 text-white text-xs font-bold tracking-wider font-display border-b border-luxury-900">
                  <th className="py-3 px-4 w-40 print:w-[25%]">RECLAMAÇÕES (SETOR)</th>
                  <th className="py-3 px-4 text-center w-24 print:w-[15%]">QUANTIDADE</th>
                  <th className="py-3 px-5 print:w-[60%]">DESCRIÇÃO QUALITATIVA (SÍNTESE INTELIGENTE)</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((sum, index) => (
                  <tr
                    key={sum.sector}
                    className={`border-b border-luxury-200/60 font-sans align-top hover:bg-luxury-50 transition-colors ${
                      index % 2 === 0 ? "bg-white" : "bg-luxury-50/40"
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-neutral-800 font-display flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brass-500 shrink-0" />
                      {sum.sector}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-center text-rose-600">
                      {sum.quantity}
                    </td>
                    <td className="py-3.5 px-5 text-neutral-700 text-xs leading-relaxed font-normal">
                      {sum.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer block */}
          <div id="report-excel-footer" className="flex items-center justify-between text-[10px] text-neutral-400 uppercase font-mono pt-4 border-t border-luxury-200">
            <span>Sintetizado com Inteligência Artificial Gemini</span>
            <span className="font-semibold">Relatório Homologado p/ Diretoria</span>
          </div>
        </div>
      )}

      {/* Previously Saved Reports History Panel */}
      <div id="report-history-block" className="print:hidden bg-white rounded-2xl border border-luxury-200 p-6">
        <h4 className="text-xs font-bold font-display uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-brass-500" />
          <span>Histórico de Relatórios Persistidos</span>
        </h4>

        {savedReports.length > 0 ? (
          <div id="history-grid-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedReports.map((rep) => (
              <div
                key={rep.id}
                onClick={() => handleLoadSavedReport(rep)}
                className={`p-4 border rounded-xl text-left transition-all hover:shadow-md cursor-pointer relative group ${
                  selectedSavedReport?.id === rep.id
                    ? "border-brass-500 bg-brass-500/5 shadow-xs"
                    : "border-luxury-200 bg-white hover:border-neutral-300"
                }`}
              >
                {/* Delete button option */}
                <button
                  onClick={(e) => handleDeleteSavedReport(rep.id, e)}
                  className="absolute top-3 right-3 p-1 hover:bg-rose-50 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                  title="Apagar Relatório"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <h5 className="font-bold text-xs text-neutral-800 line-clamp-1 pr-6 font-display">
                  {rep.title}
                </h5>
                <span className="block text-[10px] mt-1.5 text-neutral-500 font-sans">
                  {rep.startDate} até {rep.endDate}
                </span>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase text-neutral-400">
                    {rep.createdAt?.seconds ? new Date(rep.createdAt.seconds * 1000).toLocaleDateString("pt-BR") : "Histórico"}
                  </span>
                  <span className="text-[10px] text-brass-600 font-bold group-hover:underline flex items-center gap-1 cursor-pointer">
                    Exibir Tabela
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-400 text-xs border border-dashed border-luxury-200 rounded-xl bg-luxury-50">
            Nenhum relatório persistido no histórico até o momento.
          </div>
        )}
      </div>
    </div>
  );
}
