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
  ClipboardList, ThumbsUp, AlertTriangle, HelpCircle, TrendingUp,
  Calendar, Hotel, Globe, Printer, Wifi, Utensils, UserCheck,
  Star, Edit3, Trash2, Filter, ChevronLeft, ChevronRight, Award, RefreshCw
} from "lucide-react";

interface DashboardViewProps {
  occurrences: Occurrence[];
  onEditRequested: (occ: Occurrence) => void;
  onClearFlexspotData: () => Promise<void>;
}

const SECTOR_COLORS: { [key: string]: string } = {
  "AeB": "#1c3d5a",
  "Estrutura": "#c59b27",
  "TI": "#57534e",
  "Lazer": "#0d9488",
  "Manutenção": "#9a3412",
  "Governança": "#0891b2",
  "Recepção": "#d97706",
  "All inclusive": "#047857",
  "Wifi": "#4338ca",
  "Programações": "#8d0801",
  "Outro": "#78716c",
};

const SECTORS = [
  "Todos", "AeB", "Estrutura", "TI", "Lazer", "Manutenção",
  "Governança", "Recepção", "All inclusive", "Wifi", "Programações", "Outro"
];

const ITEMS_PER_PAGE = 8;

const normalizeScore = (v: number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (v >= 1 && v <= 5) return v;
  return null;
};

const getInitialStartDate = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function DashboardView({ occurrences, onEditRequested, onClearFlexspotData }: DashboardViewProps) {
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activeSheet, setActiveSheet] = useState<"resort" | "google">("resort");
  const [selectedSector, setSelectedSector] = useState("Todos");
  const [flexCurrentPage, setFlexCurrentPage] = useState(1);
  const [clearingFlex, setClearingFlex] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ─── Resort / Google filtered data ───────────────────────────────────────
  const filtered = useMemo(() => occurrences.filter((occ) => {
    const matchesSource = activeSheet === "google"
      ? occ.source === "google"
      : (occ.source === "resort" || !occ.source);
    const matchesDate = occ.date >= startDate && occ.date <= endDate;
    const matchesSector = selectedSector === "Todos" || occ.sector === selectedSector;
    return matchesSource && matchesDate && matchesSector;
  }), [occurrences, activeSheet, startDate, endDate, selectedSector]);

  const totalCount = filtered.length;
  const complaints = filtered.filter(o => o.occurrenceType === "Reclamação");
  const positiveFeedbacks = filtered.filter(o => o.occurrenceType === "Feedback positivo");
  const extraType = filtered.filter(o => o.occurrenceType === "Outro");

  const buildChartData = (type: string) => {
    const map: { [key: string]: number } = {};
    filtered.forEach((occ) => {
      if (occ.occurrenceType === type) {
        map[occ.sector] = (map[occ.sector] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: SECTOR_COLORS[name] || "#a8a29e" }))
      .sort((a, b) => b.value - a.value);
  };

  const complaintsChart = buildChartData("Reclamação");
  const positivesChart = buildChartData("Feedback positivo");
  const totalComplaints = complaintsChart.reduce((s, e) => s + e.value, 0);
  const totalPositives = positivesChart.reduce((s, e) => s + e.value, 0);

  // ─── FlexSpot ratings section ────────────────────────────────────────────
  const flexspotOccurrences = useMemo(() =>
    occurrences.filter((occ) => occ.ratings && (
      occ.ratings.wifi !== null ||
      occ.ratings.alimentacao !== null ||
      occ.ratings.atendimento !== null ||
      occ.ratings.limpeza !== null
    )), [occurrences]);

  const filteredFlex = useMemo(() => {
    setFlexCurrentPage(1);
    return flexspotOccurrences.filter((occ) => occ.date >= startDate && occ.date <= endDate);
  }, [flexspotOccurrences, startDate, endDate]);

  const stats = useMemo(() => {
    let wifiSum = 0, wifiCount = 0, foodSum = 0, foodCount = 0;
    let serviceSum = 0, serviceCount = 0, cleanSum = 0, cleanCount = 0;
    filteredFlex.forEach((occ) => {
      const r = occ.ratings;
      if (!r) return;
      const w = normalizeScore(r.wifi);
      const f = normalizeScore(r.alimentacao);
      const s = normalizeScore(r.atendimento);
      const c = normalizeScore(r.limpeza);
      if (w !== null) { wifiSum += w; wifiCount++; }
      if (f !== null) { foodSum += f; foodCount++; }
      if (s !== null) { serviceSum += s; serviceCount++; }
      if (c !== null) { cleanSum += c; cleanCount++; }
    });
    const cap = (v: number) => Math.min(5, Number(v.toFixed(1)));
    const wifiAvg = wifiCount > 0 ? cap(wifiSum / wifiCount) : null;
    const foodAvg = foodCount > 0 ? cap(foodSum / foodCount) : null;
    const serviceAvg = serviceCount > 0 ? cap(serviceSum / serviceCount) : null;
    const cleanAvg = cleanCount > 0 ? cap(cleanSum / cleanCount) : null;
    const avgs = [wifiAvg, foodAvg, serviceAvg, cleanAvg].filter(v => v !== null) as number[];
    const overallAvg = avgs.length > 0 ? Number((avgs.reduce((s, v) => s + v, 0) / avgs.length).toFixed(1)) : null;
    return { wifiAvg, wifiCount, foodAvg, foodCount, serviceAvg, serviceCount, cleanAvg, cleanCount, overallAvg, totalResponses: filteredFlex.length };
  }, [filteredFlex]);

  const flexTotalPages = Math.ceil(filteredFlex.length / ITEMS_PER_PAGE);
  const flexPage = filteredFlex.slice((flexCurrentPage - 1) * ITEMS_PER_PAGE, flexCurrentPage * ITEMS_PER_PAGE);

  const handleClearFlex = async () => {
    setClearingFlex(true);
    try { await onClearFlexspotData(); } finally { setClearingFlex(false); setShowClearConfirm(false); }
  };

  const ScoreBar = ({ score }: { score: number | null }) => {
    if (score === null) return <span className="text-neutral-300 text-xs">—</span>;
    const pct = (score / 5) * 100;
    const color = score >= 4 ? "#059669" : score >= 3 ? "#d97706" : "#dc2626";
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-1.5 bg-luxury-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>{score}</span>
      </div>
    );
  };

  const ChartBar = ({ data, label, emptyMsg, emptyIcon: EmptyIcon }: {
    data: { name: string; value: number; color: string }[];
    label: string;
    emptyMsg: string;
    emptyIcon: React.ComponentType<any>;
  }) => (
    <div className="bg-white rounded-2xl border border-luxury-200 p-5 flex flex-col">
      <h3 className="text-sm font-semibold font-display text-neutral-800 uppercase tracking-wider flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-brass-500" />
        <span>{label}</span>
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, bottom: 4, left: 90 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ede4" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} tickLine={false} axisLine={false} width={86} />
            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc", fontSize: 12 }}
              formatter={(value: any) => [value, "Qtde"]}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28} label={{ position: "right", fontSize: 11, fill: "#6b7280" }}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[180px] text-center text-neutral-400">
          <EmptyIcon className="w-10 h-10 stroke-1 mb-2 text-neutral-300" />
          <p className="text-sm font-medium">{emptyMsg}</p>
        </div>
      )}
    </div>
  );

  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const fmtDate = (d: string) => {
    const obj = new Date(d + "T12:00:00");
    return `${String(obj.getDate()).padStart(2, "0")}/${monthNames[obj.getMonth()]}`;
  };

  return (
    <div className="space-y-6">
      {/* Print header */}
      <div className="hidden print:block mb-6 border-b-2 border-luxury-800 pb-5">
        <h1 className="text-xl font-extrabold text-neutral-900 font-display uppercase tracking-wider">DASHBOARD DE OCORRÊNCIAS</h1>
        <p className="text-[11px] text-neutral-500 font-serif italic mt-0.5">Guest Relations — Análise de Desempenho</p>
      </div>

      {/* Source Switcher */}
      <div className="bg-white p-1.5 rounded-2xl border border-luxury-200 flex flex-col sm:flex-row gap-1.5 shadow-xs print:hidden">
        <button
          onClick={() => setActiveSheet("resort")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 border ${
            activeSheet === "resort" ? "bg-luxury-800 text-white border-luxury-800 shadow-sm" : "bg-white text-neutral-500 border-transparent hover:bg-luxury-50"
          }`}
        >
          <Hotel className="w-4 h-4 text-brass-500" />
          Folha Resort (Captadas no Resort)
        </button>
        <button
          onClick={() => setActiveSheet("google")}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 border ${
            activeSheet === "google" ? "bg-luxury-800 text-white border-luxury-800 shadow-sm" : "bg-white text-neutral-500 border-transparent hover:bg-luxury-50"
          }`}
        >
          <Globe className="w-4 h-4 text-brass-500" />
          Folha Google (Reclamações do Google)
        </button>
      </div>

      {/* Filter Bar: dates + sector */}
      <div className="bg-white rounded-2xl border border-luxury-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-700 font-display">Filtros</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-2 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer"
            />
            <span className="text-neutral-400 text-xs">até</span>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-2 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer"
            />
          </div>
          <select
            value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}
            className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-2 bg-luxury-50 focus:border-brass-500 outline-none cursor-pointer font-medium"
          >
            {SECTORS.map(s => (
              <option key={s} value={s}>{s === "Todos" ? "Todos os Setores" : s}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-neutral-100 text-neutral-700 rounded-xl"><ClipboardList className="w-5 h-5" /></div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400">Total Geral</span>
            <span className="text-2xl font-bold font-display text-neutral-800">{totalCount}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle className="w-5 h-5" /></div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-rose-400">Reclamações</span>
            <span className="text-2xl font-bold font-display text-rose-700">{complaints.length}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl"><ThumbsUp className="w-5 h-5" /></div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-emerald-400">Feedbacks</span>
            <span className="text-2xl font-bold font-display text-emerald-700">{positiveFeedbacks.length}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-neutral-50 text-neutral-600 rounded-xl"><HelpCircle className="w-5 h-5" /></div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400">Outros</span>
            <span className="text-2xl font-bold font-display text-neutral-700">{extraType.length}</span>
          </div>
        </div>
      </div>

      {/* Charts: Complaints + Positives side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBar
          data={complaintsChart}
          label={`Reclamações por Setor (${totalComplaints})`}
          emptyMsg="Nenhuma reclamação no período."
          emptyIcon={ClipboardList}
        />
        <ChartBar
          data={positivesChart}
          label={`Feedbacks Positivos por Setor (${totalPositives})`}
          emptyMsg="Nenhum feedback positivo no período."
          emptyIcon={ThumbsUp}
        />
      </div>

      {/* ─── FlexSpot Ratings Section ─────────────────────────────────── */}
      <div className="pt-2 border-t-2 border-luxury-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-display text-neutral-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-brass-500" />
            Histórico de Avaliações Flexspot
          </h2>
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider cursor-pointer border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-all"
            >
              Limpar Dados Flexspot
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-semibold">Confirma limpeza?</span>
              <button onClick={handleClearFlex} disabled={clearingFlex}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60 flex items-center gap-1">
                {clearingFlex && <RefreshCw className="w-3 h-3 animate-spin" />}
                Sim
              </button>
              <button onClick={() => setShowClearConfirm(false)}
                className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider cursor-pointer">
                Não
              </button>
            </div>
          )}
        </div>

        {/* Ratings avg KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Wi-Fi", avg: stats.wifiAvg, count: stats.wifiCount, icon: Wifi, color: "indigo" },
            { label: "Alimentação", avg: stats.foodAvg, count: stats.foodCount, icon: Utensils, color: "amber" },
            { label: "Atendimento", avg: stats.serviceAvg, count: stats.serviceCount, icon: UserCheck, color: "teal" },
            { label: "Limpeza", avg: stats.cleanAvg, count: stats.cleanCount, icon: Star, color: "emerald" },
            { label: "Geral", avg: stats.overallAvg, count: stats.totalResponses, icon: Award, color: "brass" },
          ].map(({ label, avg, count, icon: Icon, color }) => {
            const scoreColor = avg === null ? "#a3a3a3" : avg >= 4 ? "#059669" : avg >= 3 ? "#d97706" : "#dc2626";
            return (
              <div key={label} className="bg-white rounded-2xl p-4 border border-luxury-200 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-brass-500" />
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">{label}</span>
                </div>
                {avg !== null ? (
                  <>
                    <span className="text-2xl font-bold font-display" style={{ color: scoreColor }}>{avg}</span>
                    <div className="w-full h-1.5 bg-luxury-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(avg / 5) * 100}%`, backgroundColor: scoreColor }} />
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">{count} resp.</span>
                  </>
                ) : (
                  <span className="text-sm text-neutral-300 italic">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* FlexSpot records table */}
        {filteredFlex.length > 0 ? (
          <div className="bg-white rounded-2xl border border-luxury-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                <thead className="bg-luxury-100/60 border-b border-luxury-200 font-bold text-neutral-600 font-display">
                  <tr>
                    <th className="py-3 px-4 w-20">Data</th>
                    <th className="py-3 px-4 w-20">Apto</th>
                    <th className="py-3 px-4">Comentário</th>
                    <th className="py-3 px-4 w-28 text-center">Wi-Fi</th>
                    <th className="py-3 px-4 w-28 text-center">Alimentação</th>
                    <th className="py-3 px-4 w-28 text-center">Atendimento</th>
                    <th className="py-3 px-4 w-28 text-center">Limpeza</th>
                    <th className="py-3 px-4 w-16 text-right print:hidden">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {flexPage.map((occ) => (
                    <tr key={occ.id} className="border-b border-luxury-200/50 hover:bg-luxury-50 transition-colors align-middle">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-700 uppercase">{fmtDate(occ.date)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-neutral-800">{occ.apartment}</td>
                      <td className="py-3 px-4 text-neutral-600 leading-relaxed max-w-xs" title={occ.observation}>
                        <span className="line-clamp-2">{occ.observation}</span>
                      </td>
                      <td className="py-3 px-4 text-center"><ScoreBar score={normalizeScore(occ.ratings?.wifi)} /></td>
                      <td className="py-3 px-4 text-center"><ScoreBar score={normalizeScore(occ.ratings?.alimentacao)} /></td>
                      <td className="py-3 px-4 text-center"><ScoreBar score={normalizeScore(occ.ratings?.atendimento)} /></td>
                      <td className="py-3 px-4 text-center"><ScoreBar score={normalizeScore(occ.ratings?.limpeza)} /></td>
                      <td className="py-3 px-4 text-right print:hidden">
                        <button
                          onClick={() => onEditRequested(occ)}
                          className="p-1.5 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer transition-colors"
                          title="Editar comentário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {flexTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-luxury-200 text-xs">
                <span className="text-neutral-400 font-mono">
                  {filteredFlex.length} registros · pág. {flexCurrentPage}/{flexTotalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFlexCurrentPage(p => Math.max(1, p - 1))}
                    disabled={flexCurrentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-luxury-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setFlexCurrentPage(p => Math.min(flexTotalPages, p + 1))}
                    disabled={flexCurrentPage === flexTotalPages}
                    className="p-1.5 rounded-lg hover:bg-luxury-100 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-neutral-400 text-xs border border-dashed border-luxury-200 rounded-2xl bg-luxury-50">
            <Award className="w-10 h-10 stroke-1 text-neutral-300 mx-auto mb-2" />
            <p className="font-semibold text-neutral-500">Nenhuma avaliação Flexspot no período selecionado.</p>
            <p className="text-xs mt-1">Importe um CSV do Flexspot para ver as médias aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
