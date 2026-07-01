import React, { useState, useMemo } from "react";
import { Occurrence } from "../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from "recharts";
import {
  LayoutDashboard,
  ClipboardList,
  ThumbsUp,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Printer,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  Utensils,
  Wrench,
  Wifi,
  Target,
  Hammer,
  Sparkles,
  ConciergeBell,
  Star,
  Ticket,
  FileText,
  BarChart3,
  ListChecks,
  Globe
} from "lucide-react";
import { motion } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import ConfirmDialog from "./ConfirmDialog";
import OccurrenceForm from "./OccurrenceForm";

interface DashboardViewProps {
  occurrences: Occurrence[];
}

// Mapeamento de setor -> ícone representativo
const SECTOR_ICONS: Record<string, React.ReactNode> = {
  "AeB":          <Utensils className="w-4 h-4" />,
  "Estrutura":    <Wrench className="w-4 h-4" />,
  "TI":           <Wifi className="w-4 h-4" />,
  "Lazer":        <Target className="w-4 h-4" />,
  "Manutenção":   <Hammer className="w-4 h-4" />,
  "Governança":   <Sparkles className="w-4 h-4" />,
  "Recepção":     <ConciergeBell className="w-4 h-4" />,
  "All inclusive":<Star className="w-4 h-4" />,
  "Wifi":         <Wifi className="w-4 h-4" />,
  "Programações": <Ticket className="w-4 h-4" />,
  "Outro":        <FileText className="w-4 h-4" />,
};

const SECTOR_COLORS: Record<string, string> = {
  "AeB":          "#1c3d5a",
  "Estrutura":    "#c59b27",
  "TI":           "#57534e",
  "Lazer":        "#0d9488",
  "Manutenção":   "#9a3412",
  "Governança":   "#0891b2",
  "Recepção":     "#d97706",
  "All inclusive":"#047857",
  "Wifi":         "#4338ca",
  "Programações": "#8d0801",
  "Outro":        "#78716c",
};

const ITEMS_PER_PAGE = 12;

export default function DashboardView({ occurrences }: DashboardViewProps) {
  const getInitialStartDate = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  };
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // --- Estado de navegação interna ---
  const [activeTab, setActiveTab] = useState<"graficos" | "avaliacoes" | "nova">("graficos");

  // --- Estado de filtros ---
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activeSheet, setActiveSheet] = useState<"resort" | "google">("resort");

  // --- Estado da lista/busca ---
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // --- Estado de edição ---
  const [editingOccurrence, setEditingOccurrence] = useState<Occurrence | null>(null);

  // --- Estado de exclusão ---
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Dados filtrados para gráficos ──
  const filtered = useMemo(() => occurrences.filter((occ) => {
    const matchesSource = activeSheet === "google"
      ? occ.source === "google"
      : (occ.source === "resort" || !occ.source);
    return matchesSource && occ.date >= startDate && occ.date <= endDate;
  }), [occurrences, activeSheet, startDate, endDate]);

  const complaints = filtered.filter(o => o.occurrenceType === "Reclamação");
  const positiveFeedbacks = filtered.filter(o => o.occurrenceType === "Feedback positivo");

  const buildBarData = (list: Occurrence[]) => {
    const map: Record<string, number> = {};
    list.forEach(o => { map[o.sector] = (map[o.sector] || 0) + 1; });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: SECTOR_COLORS[name] || "#a8a29e" }))
      .sort((a, b) => b.value - a.value);
  };

  const complaintsBarData = useMemo(() => buildBarData(complaints), [complaints]);
  const positiveBarData   = useMemo(() => buildBarData(positiveFeedbacks), [positiveFeedbacks]);

  // ── Dados para a lista unificada (todas as ocorrências, sem filtro de fonte) ──
  const allOccurrences = useMemo(() => {
    const term = search.toLowerCase().trim();
    return occurrences
      .filter(o =>
        o.date >= startDate && o.date <= endDate &&
        (!term ||
          o.apartment?.toLowerCase().includes(term) ||
          o.bookingNumber?.toLowerCase().includes(term) ||
          o.observation?.toLowerCase().includes(term) ||
          o.sector?.toLowerCase().includes(term))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [occurrences, startDate, endDate, search]);

  const totalPages = Math.ceil(allOccurrences.length / ITEMS_PER_PAGE);
  const pagedOccurrences = allOccurrences.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleEditRequest = (occ: Occurrence) => {
    setEditingOccurrence(occ);
    setActiveTab("nova");
  };

  const handleNewOccurrence = () => {
    setEditingOccurrence(null);
    setActiveTab("nova");
  };

  const handleSaveFinished = () => {
    setEditingOccurrence(null);
    setActiveTab("avaliacoes");
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "occurrences", deletingId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `occurrences/${deletingId}`);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  // ── Rótulo customizado do BarChart com nome do setor ──
  const CustomBarLabel = (props: any) => {
    const { x, y, width, value, name } = props;
    if (!value) return null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#374151"
        className="text-[10px] font-bold font-mono"
        fontSize={10}
      >
        {value}
      </text>
    );
  };

  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const words = (payload.value as string).split(" ");
    return (
      <g transform={`translate(${x},${y})`}>
        {words.map((word: string, i: number) => (
          <text
            key={i}
            x={0}
            y={0}
            dy={14 + i * 12}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={10}
            fontWeight={600}
          >
            {word}
          </text>
        ))}
      </g>
    );
  };

  return (
    <div id="dashboard-view-panel" className="space-y-6">
      {/* Print header */}
      <div className="hidden print:block mb-6 border-b-2 border-luxury-800 pb-5">
        <h1 className="text-xl font-extrabold text-neutral-900 font-display uppercase tracking-wider">
          RELATÓRIO DE SÍNTESE ANALÍTICA
        </h1>
        <p className="text-[11px] text-neutral-500 font-serif italic mt-0.5">
          Período: {startDate?.split("-").reverse().join("/")} até {endDate?.split("-").reverse().join("/")}
        </p>
      </div>

      {/* Cabeçalho com filtros e controles */}
      <div className="bg-white rounded-2xl border border-luxury-200 shadow-xs p-4 flex flex-wrap items-center gap-3 print:hidden">
        {/* Filtro de período */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-brass-500 shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="text-xs rounded-lg border border-luxury-200 bg-luxury-50 px-2.5 py-1.5 outline-none focus:border-brass-500"
          />
          <span className="text-neutral-400 text-xs">até</span>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="text-xs rounded-lg border border-luxury-200 bg-luxury-50 px-2.5 py-1.5 outline-none focus:border-brass-500"
          />
        </div>

        {/* Filtro de origem (apenas para gráficos) */}
        {activeTab === "graficos" && (
          <div className="flex bg-luxury-50 p-1 border border-luxury-200 rounded-xl gap-1 shrink-0">
            {[
              { key: "resort", label: "🏨 Resort" },
              { key: "google", label: "🌐 Google" }
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setActiveSheet(opt.key as any)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  activeSheet === opt.key
                    ? "bg-luxury-800 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Botão imprimir */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          Imprimir
        </button>
      </div>

      {/* Abas internas */}
      <div className="flex items-center gap-2 bg-luxury-100/40 p-1.5 rounded-xl border border-luxury-200/30 w-fit print:hidden">
        {[
          { key: "graficos",   label: "Gráficos",           icon: <BarChart3 className="w-4 h-4" /> },
          { key: "avaliacoes", label: "Lista de Avaliações", icon: <ListChecks className="w-4 h-4" /> },
          { key: "nova",       label: editingOccurrence ? "Editar Avaliação" : "Nova Avaliação", icon: <PlusCircle className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key !== "nova") setEditingOccurrence(null);
              setActiveTab(tab.key as any);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab.key
                ? "bg-luxury-800 text-white shadow-sm"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ABA: GRÁFICOS ── */}
      {activeTab === "graficos" && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total", value: filtered.length, color: "text-neutral-800", icon: <TrendingUp className="w-5 h-5" /> },
              { label: "Reclamações", value: complaints.length, color: "text-rose-600", icon: <AlertTriangle className="w-5 h-5" /> },
              { label: "Elogios", value: positiveFeedbacks.length, color: "text-emerald-600", icon: <ThumbsUp className="w-5 h-5" /> },
              { label: "Outros", value: filtered.filter(o => o.occurrenceType === "Outro").length, color: "text-neutral-500", icon: <ClipboardList className="w-5 h-5" /> },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-2xl border border-luxury-200 p-4 flex items-center gap-3">
                <span className={`${kpi.color} opacity-70`}>{kpi.icon}</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">{kpi.label}</p>
                  <p className={`text-2xl font-black font-mono ${kpi.color}`}>{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico de Reclamações — Barras Verticais */}
          <div className="bg-white rounded-2xl border border-luxury-200 p-5">
            <h3 className="text-sm font-bold font-display uppercase tracking-wider text-neutral-800 flex items-center gap-2 mb-6">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Reclamações por Setor
            </h3>
            {complaintsBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={complaintsBarData} margin={{ top: 24, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f0e9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={<CustomXAxisTick />}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc", fontSize: "11px" }}
                    formatter={(value: any) => [`${value} reclamação(ões)`, "Volume"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} label={<CustomBarLabel />}>
                    {complaintsBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                <AlertTriangle className="w-10 h-10 stroke-1 mb-2 text-neutral-300" />
                <p className="text-sm">Nenhuma reclamação no período.</p>
              </div>
            )}
          </div>

          {/* Gráfico de Elogios — Barras Verticais */}
          <div className="bg-white rounded-2xl border border-luxury-200 p-5">
            <h3 className="text-sm font-bold font-display uppercase tracking-wider text-neutral-800 flex items-center gap-2 mb-6">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              Feedbacks Positivos por Setor
            </h3>
            {positiveBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={positiveBarData} margin={{ top: 24, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f0e9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={<CustomXAxisTick />}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc", fontSize: "11px" }}
                    formatter={(value: any) => [`${value} elogio(s)`, "Volume"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} label={<CustomBarLabel />}>
                    {positiveBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                <ThumbsUp className="w-10 h-10 stroke-1 mb-2 text-neutral-300" />
                <p className="text-sm">Nenhum elogio registrado no período.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA: LISTA DE AVALIAÇÕES ── */}
      {activeTab === "avaliacoes" && (
        <div className="space-y-4">
          {/* Barra de busca + botão nova avaliação */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por apartamento, nome, setor ou observação..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl border border-luxury-200 bg-white focus:border-brass-500 focus:ring-1 focus:ring-brass-500 outline-none"
              />
            </div>
            <button
              onClick={handleNewOccurrence}
              className="flex items-center gap-2 px-4 py-2.5 bg-luxury-800 hover:bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4 text-brass-400" />
              Nova Avaliação
            </button>
          </div>

          {/* Contagem */}
          <p className="text-xs text-neutral-400 font-mono">
            {allOccurrences.length} registro(s) encontrado(s) no período
            {search && ` para "${search}"`}
          </p>

          {/* Lista de registros */}
          {pagedOccurrences.length > 0 ? (
            <div className="space-y-3">
              {pagedOccurrences.map(occ => {
                const isFlexspot = !!occ.ratings && Object.values(occ.ratings).some(v => v !== null && v !== undefined);
                return (
                  <motion.div
                    key={occ.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-luxury-200/60 hover:border-luxury-300 transition-all p-4 flex flex-col md:flex-row md:items-start gap-3"
                  >
                    {/* Ícone do setor */}
                    <div
                      className="p-2.5 rounded-xl shrink-0 mt-0.5"
                      style={{
                        backgroundColor: `${SECTOR_COLORS[occ.sector] || "#a8a29e"}18`,
                        color: SECTOR_COLORS[occ.sector] || "#a8a29e"
                      }}
                    >
                      {SECTOR_ICONS[occ.sector] || <FileText className="w-4 h-4" />}
                    </div>

                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-lg font-mono uppercase">
                          Apto {occ.apartment}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {occ.bookingNumber} • {occ.date}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                          occ.occurrenceType === "Reclamação"
                            ? "bg-rose-50 text-rose-700"
                            : occ.occurrenceType === "Feedback positivo"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {occ.occurrenceType}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-luxury-100 text-luxury-700 flex items-center gap-1">
                          {SECTOR_ICONS[occ.sector]}
                          {occ.sector}
                        </span>
                        {isFlexspot && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600">
                            Flexspot
                          </span>
                        )}
                        {occ.source === "google" && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 flex items-center gap-1">
                            <Globe className="w-2.5 h-2.5" /> Google
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2 font-serif">
                        {occ.observation}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEditRequest(occ)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-luxury-700 bg-luxury-100 hover:bg-luxury-200 rounded-xl transition-all cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingId(occ.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-luxury-200 rounded-2xl bg-luxury-50/40 text-neutral-400">
              <Search className="w-10 h-10 stroke-1 mx-auto mb-2 text-neutral-300" />
              <p className="text-sm font-medium text-neutral-500">
                {search ? `Nenhum resultado para "${search}"` : "Nenhuma avaliação no período selecionado."}
              </p>
              <button
                onClick={handleNewOccurrence}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-luxury-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Lançar primeira avaliação
              </button>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <span className="text-xs font-mono font-bold text-neutral-500">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: NOVA / EDITAR AVALIAÇÃO ── */}
      {activeTab === "nova" && (
        <div className="max-w-3xl mx-auto">
          {editingOccurrence && (
            <div className="mb-4 p-3 bg-brass-500/10 border border-brass-200/50 rounded-xl flex items-center gap-3">
              <Pencil className="w-4 h-4 text-brass-600 shrink-0" />
              <div className="flex-1 text-xs text-brass-700">
                <strong>Editando avaliação existente</strong> — Apto {editingOccurrence.apartment} • {editingOccurrence.bookingNumber} • {editingOccurrence.date}
              </div>
              <button
                onClick={() => { setEditingOccurrence(null); setActiveTab("avaliacoes"); }}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-700 cursor-pointer underline"
              >
                Cancelar
              </button>
            </div>
          )}
          <OccurrenceForm
            editingOccurrence={editingOccurrence}
            onSaveFinished={handleSaveFinished}
            onCancelEdit={() => { setEditingOccurrence(null); setActiveTab("avaliacoes"); }}
          />
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir registro"
        description="Esta ação não pode ser desfeita."
        message="Deseja realmente excluir permanentemente este registro do sistema?"
        confirmLabel="Sim, excluir"
        loading={isDeleting}
        loadingLabel="Excluindo..."
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
