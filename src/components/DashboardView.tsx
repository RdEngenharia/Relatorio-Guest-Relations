import React, { useState, useMemo, useEffect } from "react";
import { Occurrence } from "../types";
import {
  Calendar, Printer, Search, Pencil, Trash2,
  Utensils, Wrench, Wifi, Target, Hammer, Sparkles,
  ConciergeBell, Star, Ticket, FileText,
  BarChart3, ListChecks, ChevronLeft, ChevronRight,
  Inbox, Trash, MessageSquare, TrendingUp
} from "lucide-react";
import { motion } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import ConfirmDialog from "./ConfirmDialog";
import OccurrenceForm from "./OccurrenceForm";

interface DashboardViewProps {
  occurrences: Occurrence[];
  onClearFlexspotData?: () => Promise<void>;
  onClearAllData?: () => Promise<void>;
}

// ── Ícones e cores por setor ──
const SECTOR_ICONS: Record<string, React.ReactNode> = {
  "AeB":           <Utensils className="w-4 h-4" />,
  "Estrutura":     <Wrench className="w-4 h-4" />,
  "TI":            <Wifi className="w-4 h-4" />,
  "Lazer":         <Target className="w-4 h-4" />,
  "Manutenção":    <Hammer className="w-4 h-4" />,
  "Governança":    <Sparkles className="w-4 h-4" />,
  "Recepção":      <ConciergeBell className="w-4 h-4" />,
  "All inclusive": <Star className="w-4 h-4" />,
  "Wifi":          <Wifi className="w-4 h-4" />,
  "Programações":  <Ticket className="w-4 h-4" />,
  "Geral":         <TrendingUp className="w-4 h-4" />,
  "Outro":         <FileText className="w-4 h-4" />,
};

const SECTOR_COLORS: Record<string, string> = {
  "AeB": "#1c3d5a", "Estrutura": "#c59b27", "TI": "#57534e",
  "Lazer": "#0d9488", "Manutenção": "#9a3412", "Governança": "#0891b2",
  "Recepção": "#d97706", "All inclusive": "#047857", "Wifi": "#4338ca",
  "Programações": "#8d0801", "Geral": "#6b7280", "Outro": "#78716c",
};

// ── 13 categorias Flexspot ──
const RATING_CATEGORIES = [
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

// Avaliações orgânicas (sem ratings) NÃO entram no cálculo do gráfico.
// Só registros com notas reais do Flexspot são considerados nas médias.

const normalizeScore = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (v >= 1 && v <= 5) return v;
  return null;
};

const ITEMS_PER_PAGE = 12;

export default function DashboardView({ occurrences, onClearFlexspotData, onClearAllData }: DashboardViewProps) {
  const getInitialStartDate = () => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; };
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const [activeTab, setActiveTab]           = useState<"graficos" | "avaliacoes" | "editar">("graficos");
  const [startDate, setStartDate]           = useState(getInitialStartDate());
  const [endDate, setEndDate]               = useState(getTodayDate());
  const [search, setSearch]                 = useState("");
  const [currentPage, setCurrentPage]       = useState(1);
  const [editingOccurrence, setEditingOccurrence] = useState<Occurrence | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [clearingFlexspot, setClearingFlexspot] = useState(false);
  const [showClearFlexspot, setShowClearFlexspot] = useState(false);
  const [clearingAll, setClearingAll]       = useState(false);
  const [showClearAll, setShowClearAll]     = useState(false);

  useEffect(() => { setCurrentPage(1); }, [startDate, endDate, search]);

  // ── Todas as avaliações no período (sem filtro de fonte) ──
  const allInPeriod = useMemo(() =>
    occurrences.filter(o => o.date >= startDate && o.date <= endDate)
  , [occurrences, startDate, endDate]);

  // Só registros COM ratings reais do Flexspot entram no cálculo de médias.
  // Avaliações orgânicas são ignoradas pelo gráfico.
  const flexspotStats = useMemo(() => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    RATING_CATEGORIES.forEach(c => { sums[c.key] = 0; counts[c.key] = 0; });

    let organicCount = 0;

    allInPeriod.forEach(occ => {
      const hasRatings = occ.ratings && Object.values(occ.ratings).some(v => v !== null && v !== undefined);
      if (!hasRatings) { organicCount++; return; } // orgânico — ignora no gráfico
      RATING_CATEGORIES.forEach(c => {
        const score = normalizeScore((occ.ratings as any)?.[c.key]);
        if (score !== null) { sums[c.key] += score; counts[c.key]++; }
      });
    });

    const averages: Record<string, number | null> = {};
    RATING_CATEGORIES.forEach(c => {
      averages[c.key] = counts[c.key] > 0
        ? Math.min(5, Number((sums[c.key] / counts[c.key]).toFixed(1)))
        : null;
    });

    const valid = Object.values(averages).filter((v): v is number => v !== null);
    const overall = valid.length > 0
      ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
      : null;

    const barData = RATING_CATEGORIES
      .filter(c => counts[c.key] > 0)
      .map(c => ({ name: c.label, value: averages[c.key], color: c.color }));

    const flexspotCount = allInPeriod.length - organicCount;

    return { averages, counts, overall, total: allInPeriod.length, flexspotCount, organicCount, barData };
  }, [allInPeriod]);

  // ── Lista de avaliações com busca ──
  const filteredList = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allInPeriod
      .filter(o =>
        !term ||
        o.apartment?.toLowerCase().includes(term) ||
        o.bookingNumber?.toLowerCase().includes(term) ||
        o.observation?.toLowerCase().includes(term)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allInPeriod, search]);

  const totalPages       = Math.ceil(filteredList.length / ITEMS_PER_PAGE);
  const pagedOccurrences = filteredList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const [printSectorModal, setPrintSectorModal] = useState(false);
  const [selectedSector, setSelectedSector]     = useState<string>("todos");

  // ── Lista de setores disponíveis no período ──
  const availableSectors = useMemo(() =>
    Array.from(new Set(allInPeriod.map(o => o.sector).filter(Boolean))).sort()
  , [allInPeriod]);

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try { await deleteDoc(doc(db, "occurrences", deletingId)); }
    catch (err: any) { handleFirestoreError(err, OperationType.DELETE, `occurrences/${deletingId}`); }
    finally { setIsDeleting(false); setDeletingId(null); }
  };

  const confirmClearFlexspot = async () => {
    setClearingFlexspot(true);
    try { await onClearFlexspotData?.(); }
    finally { setClearingFlexspot(false); setShowClearFlexspot(false); }
  };

  const confirmClearAll = async () => {
    setClearingAll(true);
    try { await onClearAllData?.(); }
    finally { setClearingAll(false); setShowClearAll(false); }
  };

  const periodStr = `${startDate.split("-").reverse().join("/")} até ${endDate.split("-").reverse().join("/")}`;

  // ── Gráfico de barras verticais em SVG PURO (sem Recharts) ──
  // Recharts usa ResizeObserver que colapsa no @media print do navegador.
  // SVG inline é sempre renderizado corretamente na impressão.
  const buildSVGChart = (data: { name: string; value: number | null; color: string }[]) => {
    const W = 720, H = 280, PAD_L = 28, PAD_B = 72, PAD_T = 30, PAD_R = 8;
    const cW = W - PAD_L - PAD_R;
    const cH = H - PAD_B - PAD_T;
    const barW = Math.min(42, (cW / data.length) - 5);
    const maxVal = 5;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Grade horizontal */}
        {[1,2,3,4,5].map(tick => {
          const y = PAD_T + cH - (tick / maxVal) * cH;
          return (
            <g key={tick}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={0.8} />
              <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">{tick}</text>
            </g>
          );
        })}
        {/* Eixo X */}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + cH} y2={PAD_T + cH} stroke="#d1d5db" strokeWidth={1} />
        {/* Barras */}
        {data.map((item, i) => {
          const slotW = cW / data.length;
          const x = PAD_L + slotW * i + (slotW - barW) / 2;
          const val = item.value ?? 0;
          const bH = (val / maxVal) * cH;
          const y = PAD_T + cH - bH;
          const words = item.name.split(" ");
          const lines: string[] = [];
          let cur = "";
          words.forEach(w => {
            if (cur && (cur + " " + w).length > 10) { lines.push(cur); cur = w; }
            else { cur = cur ? cur + " " + w : w; }
          });
          if (cur) lines.push(cur);
          return (
            <g key={item.name}>
              <rect x={x} y={y} width={barW} height={Math.max(bH, 1)} fill={item.color} rx={3} />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="700" fill="#1f2937">{val}</text>
              {lines.map((line, li) => (
                <text key={li} x={x + barW / 2} y={PAD_T + cH + 14 + li * 11} textAnchor="middle" fontSize={9} fontWeight="600" fill="#6b7280">{line}</text>
              ))}
            </g>
          );
        })}
      </svg>
    );
  };

  // ── Imprime comentários numa janela separada (por setor ou todos) ──
  const handlePrintCommentsBySector = (sector: string) => {
    const list = [...allInPeriod]
      .filter(o => sector === "todos" || o.sector === sector)
      .filter(o => o.observation?.trim())
      .sort((a, b) => b.date.localeCompare(a.date));
    const title = sector === "todos" ? "COMENTÁRIOS DAS AVALIAÇÕES" : `COMENTÁRIOS — ${sector.toUpperCase()}`;
    const rows = list.map(o => `
      <div style="padding:12px 0;border-bottom:1px solid #e5e7eb;page-break-inside:avoid;">
        <div style="font-size:10px;color:#6b7280;font-family:monospace;margin-bottom:4px;">
          Apto ${o.apartment} &bull; ${o.bookingNumber} &bull; ${o.date}
          ${o.occurrenceType === "Reclamação" ? '<span style="color:#ef4444;font-weight:700;"> • Reclamação</span>' : '<span style="color:#10b981;font-weight:700;"> • Feedback positivo</span>'}
          &bull; ${o.sector}
        </div>
        <div style="font-size:12px;color:#374151;line-height:1.6;">${o.observation}</div>
      </div>`).join("");
    const html = `<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#111;}
      h1{font-size:15px;border-bottom:2px solid #111;padding-bottom:8px;}
      p{font-size:11px;color:#6b7280;margin-bottom:20px;}</style></head>
      <body><h1>${title}</h1><p>Período: ${periodStr} • ${list.length} comentário(s)</p>
      ${rows || "<p>Nenhum comentário encontrado.</p>"}</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); w.close(); }
    setPrintSectorModal(false);
  };

  return (
    <div id="dashboard-view-panel" className="space-y-6">

      {/* ══ CABEÇALHO DE IMPRESSÃO ══ */}
      <div className="hidden print:block mb-6 border-b-2 border-neutral-800 pb-4">
        <h1 className="text-lg font-extrabold uppercase tracking-wider">SATISFAÇÃO DO CLIENTE — PORTAL FLEXSPOT</h1>
        <p className="text-xs text-neutral-500 mt-1">Período: {periodStr} • {flexspotStats.total} avaliações • Nota geral: {flexspotStats.overall ?? "—"}/5</p>
      </div>

      {/* ══ BARRA DE CONTROLES ══ */}
      <div className="bg-white rounded-2xl border border-luxury-200 shadow-xs p-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-brass-500 shrink-0" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="text-xs rounded-lg border border-luxury-200 bg-luxury-50 px-2.5 py-1.5 outline-none focus:border-brass-500" />
          <span className="text-neutral-400 text-xs">até</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="text-xs rounded-lg border border-luxury-200 bg-luxury-50 px-2.5 py-1.5 outline-none focus:border-brass-500" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "graficos" && (
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Imprimir Gráficos
            </button>
          )}
          {(activeTab === "avaliacoes" || activeTab === "editar") && (
            <button onClick={() => setPrintSectorModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer">
              <MessageSquare className="w-3.5 h-3.5" /> Imprimir Comentários
            </button>
          )}
        </div>
      </div>

      {/* ══ ABAS ══ */}
      <div className="flex items-center gap-2 bg-luxury-100/40 p-1.5 rounded-xl border border-luxury-200/30 w-fit print:hidden">
        {[
          { key: "graficos",   label: "Gráficos",           icon: <BarChart3 className="w-4 h-4" /> },
          { key: "avaliacoes", label: "Lista de Avaliações", icon: <ListChecks className="w-4 h-4" /> },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => { setEditingOccurrence(null); setActiveTab(tab.key as any); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${activeTab === tab.key || (activeTab === "editar" && tab.key === "avaliacoes") ? "bg-luxury-800 text-white shadow-sm" : "text-neutral-500 hover:bg-luxury-100"}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ══ ABA GRÁFICOS ══ */}
      {activeTab === "graficos" && (
        <>
          {/* KPI de notas — visível na tela */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            <div className="bg-gradient-to-br from-luxury-800 to-luxury-900 text-white p-4 rounded-2xl col-span-2 md:col-span-1 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">Nota Geral</span>
              <div>
                <span className="text-4xl font-black font-mono">{flexspotStats.overall ?? "—"}</span>
                <span className="text-sm text-neutral-400 ml-1">/5</span>
              </div>
              <p className="text-[10px] text-neutral-400">{flexspotStats.total} avaliações no período</p>
            </div>
            {[
              { label: "Wi-Fi", key: "wifi" },
              { label: "Alimentação", key: "alimentacao" },
              { label: "Recepção", key: "recepcao" },
            ].map(item => {
              const avg = flexspotStats.averages[item.key];
              const cat = RATING_CATEGORIES.find(c => c.key === item.key);
              return (
                <div key={item.key} className="bg-white rounded-2xl border border-luxury-200 p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{item.label}</span>
                  <div>
                    <span className="text-3xl font-black font-mono text-neutral-800">{avg ?? "—"}</span>
                    {avg !== null && <span className="text-xs text-neutral-400 ml-1">/5</span>}
                  </div>
                  <div className="w-full bg-luxury-100 h-1.5 rounded-full mt-2">
                    <div className="h-full rounded-full" style={{ width: `${avg ? (avg/5)*100 : 0}%`, backgroundColor: cat?.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barras HORIZONTAIS na tela */}
          <div className="bg-white rounded-2xl border border-luxury-200 p-5 space-y-5 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-display uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                <Star className="w-4 h-4 text-brass-500" />
                Satisfação Flexspot — Médias por Categoria
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-neutral-400">
                  {flexspotStats.flexspotCount} com nota
                  {flexspotStats.organicCount > 0 && (
                    <span className="text-amber-600 font-bold ml-1">• {flexspotStats.organicCount} orgânica(s) aguardando nota</span>
                  )}
                  {flexspotStats.overall !== null && (
                    <span className="ml-1">• Nota geral: <strong className="text-neutral-700">{flexspotStats.overall}/5</strong></span>
                  )}
                </span>
                {onClearFlexspotData && (
                  <button onClick={() => setShowClearFlexspot(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer uppercase tracking-wider">
                    <Trash className="w-3 h-3" /> Limpar Flexspot
                  </button>
                )}
                {onClearAllData && (
                  <button onClick={() => setShowClearAll(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-100 rounded-lg transition-all cursor-pointer uppercase tracking-wider border border-rose-200">
                    <Trash className="w-3 h-3" /> Limpar Tudo
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 -mt-2">Escala de 1 a 5 • {periodStr}</p>

            <div className="space-y-3">
              {RATING_CATEGORIES.filter(c => flexspotStats.counts[c.key] > 0).map(cat => {
                const avg = flexspotStats.averages[cat.key];
                const pct = avg !== null ? (avg / 5) * 100 : 0;
                const badge = avg === null ? "bg-neutral-100 text-neutral-400"
                  : avg >= 4 ? "bg-emerald-50 text-emerald-700"
                  : avg >= 2.5 ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700";
                return (
                  <div key={cat.key} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-neutral-600 w-40 shrink-0 truncate">{cat.label}</span>
                    <div className="flex-1 bg-luxury-100 h-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                    <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg w-14 text-center shrink-0 ${badge}`}>
                      {avg !== null ? `${avg}/5` : "—"}
                    </span>
                    <span className="text-[9px] text-neutral-400 w-16 shrink-0 font-mono">{flexspotStats.counts[cat.key]} resp.</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico SVG PURO — apenas na impressão (Recharts não renderiza no @media print) */}
          <div className="hidden print:block bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Médias por Categoria — Escala 1 a 5
            </h3>
            <p className="text-xs text-neutral-400 mb-5">Período: {periodStr} • {flexspotStats.total} avaliações • Nota geral: {flexspotStats.overall ?? "—"}/5</p>
            {buildSVGChart(flexspotStats.barData)}
          </div>
        </>
      )}

      {/* ══ ABA LISTA DE AVALIAÇÕES ══ */}
      {(activeTab === "avaliacoes" || activeTab === "editar") && (
        <div className="space-y-4">
          {/* Barra de busca */}
          {activeTab === "avaliacoes" && (
            <div className="flex gap-3 items-center print:hidden">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input type="text" placeholder="Buscar por apartamento, nome ou observação..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl border border-luxury-200 bg-white focus:border-brass-500 focus:ring-1 focus:ring-brass-500 outline-none" />
              </div>
            </div>
          )}

          {/* Formulário de edição */}
          {activeTab === "editar" && editingOccurrence && (
            <div className="max-w-3xl mx-auto">
              <div className="mb-4 p-3 bg-brass-500/10 border border-brass-200/50 rounded-xl flex items-center gap-3">
                <Pencil className="w-4 h-4 text-brass-600 shrink-0" />
                <div className="flex-1 text-xs text-brass-700">
                  <strong>Editando avaliação</strong> — Apto {editingOccurrence.apartment} • {editingOccurrence.bookingNumber} • {editingOccurrence.date}
                </div>
                <button onClick={() => { setEditingOccurrence(null); setActiveTab("avaliacoes"); }}
                  className="text-xs font-bold text-neutral-500 hover:text-neutral-700 cursor-pointer underline">Cancelar</button>
              </div>
              <OccurrenceForm
                editingOccurrence={editingOccurrence}
                onSaveFinished={() => { setEditingOccurrence(null); setActiveTab("avaliacoes"); }}
                onCancelEdit={() => { setEditingOccurrence(null); setActiveTab("avaliacoes"); }}
              />
            </div>
          )}

          {/* Lista */}
          {activeTab === "avaliacoes" && (
            <>
              <p className="text-xs text-neutral-400 font-mono print:hidden">
                {filteredList.length} registro(s){search && ` para "${search}"`}
              </p>

              {pagedOccurrences.length > 0 ? (
                <div className="space-y-3">
                  {pagedOccurrences.map(occ => {
                    const isFlexspot = !!(occ.ratings && Object.values(occ.ratings).some(v => v !== null && v !== undefined));
                    return (
                      <motion.div key={occ.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-luxury-200/60 hover:border-luxury-300 transition-all p-4 flex flex-col md:flex-row md:items-start gap-3">
                        <div className="p-2.5 rounded-xl shrink-0 mt-0.5"
                          style={{ backgroundColor: `${SECTOR_COLORS[occ.sector] || "#a8a29e"}18`, color: SECTOR_COLORS[occ.sector] || "#a8a29e" }}>
                          {SECTOR_ICONS[occ.sector] || <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-lg font-mono uppercase">Apto {occ.apartment}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{occ.bookingNumber} • {occ.date}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${occ.occurrenceType === "Reclamação" ? "bg-rose-50 text-rose-700" : occ.occurrenceType === "Feedback positivo" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                              {occ.occurrenceType}
                            </span>
                            {isFlexspot && <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600">Flexspot</span>}
                    {!isFlexspot && occ.source === "organic" && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        🔔 Orgânico — aguardando nota
                      </span>
                    )}
                          </div>
                          <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2 font-serif">{occ.observation}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 print:hidden">
                          <button onClick={() => { setEditingOccurrence(occ); setActiveTab("editar"); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-luxury-700 bg-luxury-100 hover:bg-luxury-200 rounded-xl transition-all cursor-pointer">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => setDeletingId(occ.id)}
                            className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-luxury-200 rounded-2xl bg-luxury-50/40">
                  <Inbox className="w-10 h-10 stroke-1 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-500">
                    {search ? `Nenhum resultado para "${search}"` : "Nenhuma avaliação no período."}
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 print:hidden">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <span className="text-xs font-mono font-bold text-neutral-500">Página {currentPage} de {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40">
                    Próxima <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modal de impressão de comentários por setor ── */}
      {printSectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-luxury-200/60 p-6 max-w-sm w-full mx-4">
            <h3 className="text-sm font-extrabold text-neutral-800 font-display mb-1">Imprimir Comentários</h3>
            <p className="text-xs text-neutral-500 mb-4">Selecione o setor ou imprima todos de uma vez.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              <button
                onClick={() => handlePrintCommentsBySector("todos")}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold bg-luxury-800 text-white hover:bg-neutral-900 transition-all cursor-pointer"
              >
                📋 Todos os comentários ({allInPeriod.filter(o => o.observation?.trim()).length})
              </button>
              {availableSectors.map(sector => {
                const count = allInPeriod.filter(o => o.sector === sector && o.observation?.trim()).length;
                return (
                  <button key={sector}
                    onClick={() => handlePrintCommentsBySector(sector)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold bg-luxury-50 hover:bg-luxury-100 text-luxury-800 border border-luxury-200 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {SECTOR_ICONS[sector] || <FileText className="w-4 h-4" />}
                      {sector}
                    </span>
                    <span className="text-neutral-400 font-mono text-[10px]">{count} coment.</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPrintSectorModal(false)}
              className="mt-4 w-full px-4 py-2 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modais de confirmação */}
      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir registro"
        description="Esta ação não pode ser desfeita."
        message="Deseja realmente excluir permanentemente este registro?"
        confirmLabel="Sim, excluir"
        loading={isDeleting}
        loadingLabel="Excluindo..."
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
      <ConfirmDialog
        open={showClearFlexspot}
        title="Limpar dados Flexspot"
        description="Esta ação não pode ser desfeita."
        message={<>Todos os <strong>{flexspotStats.total} registros</strong> do período serão excluídos permanentemente.</>}
        confirmLabel="Sim, excluir tudo"
        loading={clearingFlexspot}
        loadingLabel="Excluindo..."
        onConfirm={confirmClearFlexspot}
        onCancel={() => setShowClearFlexspot(false)}
      />
      <ConfirmDialog
        open={showClearAll}
        title="Limpar TODOS os registros"
        description="Esta ação apaga absolutamente tudo e não pode ser desfeita."
        message={<>Todos os <strong>{occurrences.length} registros</strong> do banco serão excluídos permanentemente, incluindo registros fora do período selecionado.</>}
        confirmLabel="Sim, apagar tudo"
        loading={clearingAll}
        loadingLabel="Excluindo em lote..."
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearAll(false)}
      />
    </div>
  );
}
