import React, { useState } from "react";
import { Occurrence } from "../types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";
import { ClipboardList, ThumbsUp, AlertTriangle, HelpCircle, TrendingUp, Calendar, Hotel, Globe, Printer } from "lucide-react";
import { motion } from "motion/react";

interface DashboardViewProps {
  occurrences: Occurrence[];
}

// Warm, sophisticated luxury hospitality color palette
const SECTOR_COLORS: { [key: string]: string } = {
  "AeB": "#1c3d5a",           // Deep Blue Navy
  "Estrutura": "#c59b27",     // Rich Olive Gold
  "TI": "#57534e",            // Stone Slate
  "Lazer": "#0d9488",         // Custom Pine-Teal
  "Manutenção": "#9a3412",    // Terracotta-Brick
  "Governança": "#0891b2",    // Sky Turquoise
  "Recepção": "#d97706",      // Amber-Copper
  "All inclusive": "#047857", // Deep Forest-Emerald
  "Wifi": "#4338ca",          // Indigo Accent
  "Programações": "#8d0801",  // Bold Maroon
  "Outro": "#78716c",         // Soft Warm Gray
};

export default function DashboardView({ occurrences }: DashboardViewProps) {
  const getInitialStartDate = () => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split("T")[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activeSheet, setActiveSheet] = useState<"resort" | "google">("resort");

  // Filter occurrences strictly by sheet (source) and date
  const filtered = occurrences.filter((occ) => {
    const matchesSource = activeSheet === "google"
      ? occ.source === "google"
      : (occ.source === "resort" || !occ.source);
    return matchesSource && occ.date >= startDate && occ.date <= endDate;
  });

  const totalCount = filtered.length;
  const complaints = filtered.filter(o => o.occurrenceType === "Reclamação");
  const positiveFeedbacks = filtered.filter(o => o.occurrenceType === "Feedback positivo");
  const extraType = filtered.filter(o => o.occurrenceType === "Outro");

  // Dynamically calculate sector counts
  const sectorCountsMap: { [key: string]: number } = {};
  filtered.forEach((occ) => {
    // Only count occurrences of type 'Reclamação' in the chart to reflect the original "PERCENTUAL DE RECLAMAÇÕES"
    if (occ.occurrenceType === "Reclamação") {
      sectorCountsMap[occ.sector] = (sectorCountsMap[occ.sector] || 0) + 1;
    }
  });

  const chartData = Object.keys(sectorCountsMap).map((sec) => ({
    name: sec,
    value: sectorCountsMap[sec],
    color: SECTOR_COLORS[sec] || SECTOR_COLORS[sec.charAt(0).toUpperCase() + sec.slice(1).toLowerCase()] || "#a8a29e"
  })).sort((a, b) => b.value - a.value);

  const totalComplaintsValue = chartData.reduce((acc, curr) => acc + curr.value, 0);

  // Custom label formatter to display Category Name, Count and Percentage directly on drawing canvas
  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, value } = props;
    
    // Fallback calculation in case Recharts cannot compute percent or active sheet data has a rendering quirk
    const calculatedPercent = totalComplaintsValue > 0 ? (value / totalComplaintsValue) : 0;
    const finalPercent = typeof percent === "number" && !isNaN(percent) ? percent : calculatedPercent;
    
    if (finalPercent < 0.01) return null; // Do not render label for 0% or trivial slices to prevent overlap
    
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    
    // Starting coordinates near slice boundary, extension coordinate, text horizontal extension line
    const sx = cx + (outerRadius + 3) * cos;
    const sy = cy + (outerRadius + 3) * sin;
    const mx = cx + (outerRadius + 24) * cos;
    const my = cy + (outerRadius + 24) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 25;
    const ey = my;
    
    const textAnchor = cos >= 0 ? "start" : "end";
    const itemColor = SECTOR_COLORS[name] || SECTOR_COLORS[name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()] || props.fill || "#888";

    return (
      <g>
        {/* Connection line */}
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={itemColor}
          strokeWidth={1.5}
          fill="none"
        />
        {/* Decorative end point indicator dot */}
        <circle cx={ex} cy={ey} r={3} fill={itemColor} />
        {/* Category Label text */}
        <text
          x={ex + (cos >= 0 ? 6 : -6)}
          y={ey - 4}
          textAnchor={textAnchor}
          fill="#1f2937"
          className="font-extrabold text-[12px] font-sans"
        >
          {name}
        </text>
        {/* Value and Percentage detail text */}
        <text
          x={ex + (cos >= 0 ? 6 : -6)}
          y={ey + 10}
          textAnchor={textAnchor}
          fill="#4b5563"
          className="font-mono text-[10px] font-bold"
        >
          {`${value} (${Math.round(finalPercent * 100)}%)`}
        </text>
      </g>
    );
  };

  return (
    <div id="dashboard-view-panel" className="space-y-6">
      {/* Print-Only Premium Header Block for Direct Browser Prints */}
      <div className="hidden print:block mb-6 border-b-2 border-luxury-800 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-neutral-900 font-display uppercase tracking-wider">
              RELATÓRIO DE SÍNTESE ANALÍTICA
            </h1>
            <p className="text-[11px] text-neutral-500 font-serif italic mt-0.5">
              Guest Relations — Análise de Desempenho e Reclamações Diárias
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-brass-600 uppercase font-display block">
              {activeSheet === "google" ? "Folha Google Reviews" : "Folha Ocorrências Resort"}
            </span>
            <span className="text-[10px] font-mono text-neutral-500 mt-1 block">
              Período: {startDate ? startDate.split("-").reverse().join("/") : "Sem Limite"} até {endDate ? endDate.split("-").reverse().join("/") : "Hoje"}
            </span>
          </div>
        </div>
      </div>

      {/* Folhas Separadas Switcher */}
      <div id="sheets-tab-selector" className="bg-white p-1.5 rounded-2xl border border-luxury-200 flex flex-col sm:flex-row gap-1.5 shadow-xs print:hidden">
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

      {/* Date Filter Bar */}
      <div id="dashboard-date-filters" className="bg-white rounded-2xl border border-luxury-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-700 font-display">Período de Análise</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-2 bg-luxury-50 focus:border-brass-500 font-medium outline-none cursor-pointer"
            />
            <span className="text-neutral-400 text-xs font-medium">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs sm:text-sm rounded-xl border border-luxury-200 px-3.5 py-2 bg-luxury-50 focus:border-brass-500 font-medium outline-none cursor-pointer"
            />
          </div>
          
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm shrink-0 border border-emerald-700 font-display"
          >
            <Printer className="w-4 h-4" />
            Imprimir Dashboard
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div id="dashboard-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ocorrências */}
        <div id="kpi-card-total" className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-neutral-100 text-neutral-700 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400">Total Geral</span>
            <span className="text-2xl font-bold font-display text-neutral-800">{totalCount}</span>
          </div>
        </div>

        {/* Reclamações */}
        <div id="kpi-card-complaints" className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-rose-400">Reclamações</span>
            <span className="text-2xl font-bold font-display text-rose-700">{complaints.length}</span>
          </div>
        </div>

        {/* Feedback Positivo */}
        <div id="kpi-card-positive" className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ThumbsUp className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-emerald-400">Feedbacks</span>
            <span className="text-2xl font-bold font-display text-emerald-700">{positiveFeedbacks.length}</span>
          </div>
        </div>

        {/* Outro */}
        <div id="kpi-card-other" className="bg-white rounded-2xl p-5 border border-luxury-200 flex items-center gap-4">
          <div className="p-3.5 bg-neutral-50 text-neutral-600 rounded-xl">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-mono tracking-wider text-neutral-400">Outros</span>
            <span className="text-2xl font-bold font-display text-neutral-700">{extraType.length}</span>
          </div>
        </div>
      </div>

      {/* Analytics and Data Grid */}
      <div id="dashboard-analytics-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart Card */}
        <div id="analytics-chart-card" className="bg-white rounded-2xl border border-luxury-200 p-5 lg:col-span-2 flex flex-col">
          <h3 className="text-base font-semibold font-display text-neutral-800 flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-brass-500" />
            <span>Percentual de Reclamações por Setor</span>
          </h3>

          {totalComplaintsValue > 0 ? (
            <div id="piechart-subcontainer" className="flex-1 min-h-[550px] flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={550}>
                <PieChart margin={{ top: 25, right: 120, bottom: 25, left: 120 }}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={150}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc" }}
                    formatter={(value: any) => [`${value} reclamação(ões)`, "Volume"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Centered Total Multi-Badge */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-sm text-neutral-400 uppercase font-mono tracking-wide">Total</span>
                <span className="text-3xl font-extrabold font-display text-neutral-800">{totalComplaintsValue}</span>
                <span className="text-xs font-mono text-rose-500 font-semibold uppercase">Queixas</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] text-center text-neutral-400">
              <ClipboardList className="w-12 h-12 stroke-1 mb-2 text-neutral-300" />
              <p className="text-sm font-medium">Nenhuma reclamação registrada neste período.</p>
              <p className="text-xs text-neutral-400 mt-1">Insira novas ocorrências ou altere as datas acima.</p>
            </div>
          )}
        </div>

        {/* Sector Rank Card */}
        <div id="analytics-rank-card" className="bg-white rounded-2xl border border-luxury-200 p-5 flex flex-col">
          <h3 className="text-sm font-bold font-display uppercase tracking-wider text-neutral-400 mb-4">
            Volume de Reclamações
          </h3>

          {totalComplaintsValue > 0 ? (
            <div id="rank-sectors-list" className="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-1">
              {chartData.map((item, index) => {
                const pct = Math.round((item.value / totalComplaintsValue) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-neutral-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <div className="font-mono">
                        <span>{item.value} ({pct}%)</span>
                      </div>
                    </div>
                    {/* Progress Bar background matching screenshots */}
                    <div className="w-full bg-luxury-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400">
              <span className="text-xs">Aguardando dados...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
