import React, { useState, useMemo } from "react";
import { Occurrence } from "../types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Cell
} from "recharts";
import { Wifi, Utensils, UserCheck, Sparkles, TrendingUp, Calendar, Inbox, Star, Info, Printer, ClipboardList, Trash2 } from "lucide-react";

interface RatingsDashboardProps {
  occurrences: Occurrence[];
  onClearData?: () => Promise<void>;
}

export default function RatingsDashboard({ occurrences, onClearData }: RatingsDashboardProps) {
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearData?.();
    } finally {
      setClearing(false);
      setShowConfirm(false);
    }
  };
  // Filter for occurrences that have rating information (source is "flexspot" or has occurrences with ratings object)
  const flexspotOccurrences = useMemo(() => {
    return occurrences.filter((occ) => occ.ratings && (
      occ.ratings.wifi !== null ||
      occ.ratings.alimentacao !== null ||
      occ.ratings.atendimento !== null ||
      occ.ratings.limpeza !== null
    ));
  }, [occurrences]);

  // Date filters
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

  // Filter list by selected dates
  const filteredOccurrences = useMemo(() => {
    return flexspotOccurrences.filter((occ) => {
      return occ.date >= startDate && occ.date <= endDate;
    });
  }, [flexspotOccurrences, startDate, endDate]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let wifiSum = 0, wifiCount = 0;
    let foodSum = 0, foodCount = 0;
    let serviceSum = 0, serviceCount = 0;
    let cleanSum = 0, cleanCount = 0;

    filteredOccurrences.forEach((occ) => {
      const r = occ.ratings;
      if (!r) return;
      if (typeof r.wifi === "number") {
        wifiSum += r.wifi;
        wifiCount++;
      }
      if (typeof r.alimentacao === "number") {
        foodSum += r.alimentacao;
        foodCount++;
      }
      if (typeof r.atendimento === "number") {
        serviceSum += r.atendimento;
        serviceCount++;
      }
      if (typeof r.limpeza === "number") {
        cleanSum += r.limpeza;
        cleanCount++;
      }
    });

    const wifiAvg = wifiCount > 0 ? Number((wifiSum / wifiCount).toFixed(1)) : null;
    const foodAvg = foodCount > 0 ? Number((foodSum / foodCount).toFixed(1)) : null;
    const serviceAvg = serviceCount > 0 ? Number((serviceSum / serviceCount).toFixed(1)) : null;
    const cleanAvg = cleanCount > 0 ? Number((cleanSum / cleanCount).toFixed(1)) : null;

    // Overall Average
    let overallSum = 0;
    let overallCount = 0;
    if (wifiAvg !== null) { overallSum += wifiAvg; overallCount++; }
    if (foodAvg !== null) { overallSum += foodAvg; overallCount++; }
    if (serviceAvg !== null) { overallSum += serviceAvg; overallCount++; }
    if (cleanAvg !== null) { overallSum += cleanAvg; overallCount++; }

    const overallAvg = overallCount > 0 ? Number((overallSum / overallCount).toFixed(1)) : null;

    return {
      wifiAvg,
      wifiCount,
      foodAvg,
      foodCount,
      serviceAvg,
      serviceCount,
      cleanAvg,
      cleanCount,
      overallAvg,
      totalResponses: filteredOccurrences.length
    };
  }, [filteredOccurrences]);

  // Chart Data: Pie Chart representing volume of reviews per sector, just like the dashboard
  const sectorPieData = useMemo(() => {
    return [
      { name: "Wi-Fi Conexão", value: stats.wifiCount, avg: stats.wifiAvg, color: "#4338ca" },
      { name: "Alimentos & Bebidas", value: stats.foodCount, avg: stats.foodAvg, color: "#1c3d5a" },
      { name: "Atendimento Recepção", value: stats.serviceCount, avg: stats.serviceAvg, color: "#d97706" },
      { name: "Governança Limpeza", value: stats.cleanCount, avg: stats.cleanAvg, color: "#0891b2" }
    ].filter(item => item.value > 0);
  }, [stats]);

  // Helper to determine badge background for ratings (1-5 scale)
  const getRatingBadgeClass = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "bg-neutral-100 text-neutral-400";
    if (score >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score >= 2.5) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
  };

  // Custom label formatter to display Category Name, Count and Percentage directly on drawing canvas
  const renderCustomizedLabel = (totalValue: number) => (props: any) => {
    const { cx, cy, midAngle, outerRadius, percent, name, value } = props;
    const calculatedPercent = totalValue > 0 ? (value / totalValue) : 0;
    const finalPercent = typeof percent === "number" && !isNaN(percent) ? percent : calculatedPercent;
    if (finalPercent < 0.01) return null;
    
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    
    const sx = cx + (outerRadius + 3) * cos;
    const sy = cy + (outerRadius + 3) * sin;
    const mx = cx + (outerRadius + 20) * cos;
    const my = cy + (outerRadius + 20) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 20;
    const ey = my;
    
    const textAnchor = cos >= 0 ? "start" : "end";
    const itemColor = props.fill || "#888";

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={itemColor}
          strokeWidth={1.5}
          fill="none"
        />
        <circle cx={ex} cy={ey} r={3} fill={itemColor} />
        <text
          x={ex + (cos >= 0 ? 6 : -6)}
          y={ey - 4}
          textAnchor={textAnchor}
          fill="#1f2937"
          className="font-extrabold text-[11px] font-sans"
        >
          {name}
        </text>
        <text
          x={ex + (cos >= 0 ? 6 : -6)}
          y={ey + 10}
          textAnchor={textAnchor}
          fill="#4b5563"
          className="font-mono text-[9px] font-bold"
        >
          {value} avaliações ({Math.round(finalPercent * 100)}%)
        </text>
      </g>
    );
  };

  return (
    <div id="flexspot-ratings-dashboard" className="space-y-6">
      {/* Date Filter Panel & Title */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-luxury-200/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight font-display text-luxury-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brass-500 animate-pulse" />
            SATISFAÇÃO DO CLIENTE (PORTAL FLEXSPOT)
          </h2>
          <p className="text-xs text-neutral-500 font-serif mt-1">
            Mapeamento dinâmico em tempo real de notas por setor e tendências do hotel.
          </p>
          <p className="hidden print:block text-[10px] font-mono text-neutral-500 mt-1">
            Período do Relatório: {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-luxury-100/40 p-1 rounded-xl border border-luxury-200/30 print:hidden">
            <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 px-2">Período</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold font-mono text-neutral-700 bg-white border border-luxury-200/40 rounded-lg px-2 py-1 outline-hidden focus:ring-1 focus:ring-brass-500"
            />
            <span className="text-neutral-300 text-xs px-1">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold font-mono text-neutral-700 bg-white border border-luxury-200/40 rounded-lg px-2 py-1 outline-hidden focus:ring-1 focus:ring-brass-500"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brass-500 hover:bg-brass-600 active:bg-brass-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer select-none print:hidden h-9"
            id="print-ratings-dashboard-btn"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>

          {onClearData && flexspotOccurrences.length > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer select-none print:hidden h-9"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Dados
            </button>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-luxury-200/60 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-neutral-800 font-display">Limpar dados do Flexspot</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
              Todos os <strong>{flexspotOccurrences.length} registros</strong> de avaliações do Flexspot serão excluídos permanentemente do sistema.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer"
                disabled={clearing}
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer disabled:opacity-60"
              >
                {clearing ? "Excluindo..." : "Sim, excluir tudo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {flexspotOccurrences.length === 0 ? (
        <div className="bg-white border border-luxury-200/60 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-xs mt-10">
          <div className="w-16 h-16 bg-luxury-100 rounded-full flex items-center justify-center text-brass-500 mx-auto mb-4 border border-luxury-200/30">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-extrabold text-luxury-800 font-display">Aguardando Importação do Flexspot</h3>
          <p className="text-xs text-neutral-500 mt-2 font-serif max-w-sm mx-auto leading-relaxed">
            Ainda não há avaliações do Flexspot cadastradas no sistema. Utilize a nossa ferramenta inteligente para carregar seus dados.
          </p>
          <div className="mt-4 p-4 bg-luxury-100/50 rounded-xl text-left border border-luxury-200/30 text-[11px] text-neutral-600 space-y-2">
            <span className="font-bold text-neutral-700 flex items-center gap-1"><Info className="w-3.5 h-3.5 text-brass-500" /> Como alimentar o painel:</span>
            <p className="leading-relaxed">
              Vá na aba <strong>Importador</strong> no topo da tela, cole qualquer bloco de texto copiado diretamente do seu portal Flexspot ou selecione um arquivo de exportação e clique em processar. O Gemini lerá e estruturará todas as notas automaticamente!
            </p>
          </div>
        </div>
      ) : filteredOccurrences.length === 0 ? (
        <div className="bg-white border border-luxury-200/60 rounded-3xl p-12 text-center max-w-md mx-auto shadow-xs">
          <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400 mx-auto mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-luxury-800">Nenhum dado encontrado no período</h3>
          <p className="text-xs text-neutral-400 mt-1">Altere o filtro de datas acima para visualizar as notas.</p>
        </div>
      ) : (
        <>
          {/* Key Metric Score Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Overall Score */}
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-luxury-800 to-luxury-900 text-white p-4.5 rounded-2xl border border-luxury-900 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Star className="w-20 h-20 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 font-display">Pontuação Geral</span>
                <span className="p-1 bg-white/10 rounded-lg text-brass-400"><Sparkles className="w-4 h-4" /></span>
              </div>
              <div className="my-3">
                <span className="text-4xl font-black font-mono tracking-tight text-white">
                  {stats.overallAvg !== null ? stats.overallAvg : "N/A"}
                </span>
                <span className="text-xs text-neutral-400 ml-1 font-bold">/5</span>
              </div>
              <p className="text-[10px] text-neutral-400 font-serif">
                Média geral de {stats.totalResponses} avaliações coletadas.
              </p>
            </div>

            {/* Wi-Fi Conexão */}
            <div className="bg-white p-4.5 rounded-2xl border border-luxury-200/60 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-display">Wi-Fi Conexão</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl"><Wifi className="w-4 h-4" /></span>
              </div>
              <div className="my-3">
                <span className="text-3xl font-extrabold font-mono text-neutral-800">
                  {stats.wifiAvg !== null ? stats.wifiAvg : "—"}
                </span>
                {stats.wifiAvg !== null && <span className="text-[10px] text-neutral-400 ml-1 font-bold">/5</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{stats.wifiCount} respostas</span>
                {stats.wifiAvg && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                    stats.wifiAvg >= 4 ? "bg-emerald-50 text-emerald-600" : stats.wifiAvg >= 2.5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {stats.wifiAvg >= 4 ? "Excelente" : stats.wifiAvg >= 2.5 ? "Regular" : "Crítico"}
                  </span>
                )}
              </div>
            </div>

            {/* Alimentos e Bebidas */}
            <div className="bg-white p-4.5 rounded-2xl border border-luxury-200/60 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-display">Alimentos & Bebidas</span>
                <span className="p-1.5 bg-neutral-100 text-neutral-700 rounded-xl"><Utensils className="w-4 h-4" /></span>
              </div>
              <div className="my-3">
                <span className="text-3xl font-extrabold font-mono text-neutral-800">
                  {stats.foodAvg !== null ? stats.foodAvg : "—"}
                </span>
                {stats.foodAvg !== null && <span className="text-[10px] text-neutral-400 ml-1 font-bold">/5</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{stats.foodCount} respostas</span>
                {stats.foodAvg && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                    stats.foodAvg >= 4 ? "bg-emerald-50 text-emerald-600" : stats.foodAvg >= 2.5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {stats.foodAvg >= 4 ? "Excelente" : stats.foodAvg >= 2.5 ? "Regular" : "Crítico"}
                  </span>
                )}
              </div>
            </div>

            {/* Atendimento */}
            <div className="bg-white p-4.5 rounded-2xl border border-luxury-200/60 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-display">Recepção / Serviço</span>
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl"><UserCheck className="w-4 h-4" /></span>
              </div>
              <div className="my-3">
                <span className="text-3xl font-extrabold font-mono text-neutral-800">
                  {stats.serviceAvg !== null ? stats.serviceAvg : "—"}
                </span>
                {stats.serviceAvg !== null && <span className="text-[10px] text-neutral-400 ml-1 font-bold">/5</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{stats.serviceCount} respostas</span>
                {stats.serviceAvg && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                    stats.serviceAvg >= 4 ? "bg-emerald-50 text-emerald-600" : stats.serviceAvg >= 2.5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {stats.serviceAvg >= 4 ? "Excelente" : stats.serviceAvg >= 2.5 ? "Regular" : "Crítico"}
                  </span>
                )}
              </div>
            </div>

            {/* Limpeza */}
            <div className="bg-white p-4.5 rounded-2xl border border-luxury-200/60 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-display">Limpeza / Quarto</span>
                <span className="p-1.5 bg-cyan-50 text-cyan-600 rounded-xl"><Sparkles className="w-4 h-4" /></span>
              </div>
              <div className="my-3">
                <span className="text-3xl font-extrabold font-mono text-neutral-800">
                  {stats.cleanAvg !== null ? stats.cleanAvg : "—"}
                </span>
                {stats.cleanAvg !== null && <span className="text-[10px] text-neutral-400 ml-1 font-bold">/5</span>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{stats.cleanCount} respostas</span>
                {stats.cleanAvg && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                    stats.cleanAvg >= 4 ? "bg-emerald-50 text-emerald-600" : stats.cleanAvg >= 2.5 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {stats.cleanAvg >= 4 ? "Excelente" : stats.cleanAvg >= 2.5 ? "Regular" : "Crítico"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Charts Area - Pizza Style (Pie Chart) like Dashboard */}
          <div className="bg-white p-6 rounded-3xl border border-luxury-200/60 shadow-xs max-w-3xl mx-auto w-full">
            <h3 className="text-xs font-black uppercase tracking-wider text-luxury-800 font-display flex items-center gap-2 mb-6 justify-center">
              <span className="w-2.5 h-2.5 bg-brass-500 rounded-full animate-pulse"></span>
              Distribuição de Avaliações por Setor (Volume)
            </h3>
            
            <div className="flex flex-col items-center justify-center relative min-h-[360px]">
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={sectorPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={115}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderCustomizedLabel(stats.totalResponses)}
                    labelLine={false}
                  >
                    {sectorPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc", fontFamily: "Inter, sans-serif", fontSize: "11px" }}
                    formatter={(value: any, name: any, props: any) => {
                      const avgStr = props.payload.avg !== null ? `${props.payload.avg}/5` : "N/A";
                      return [`${value} avaliações (Média: ${avgStr})`, "Volume"];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Centered Total Indicator */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-neutral-400 uppercase font-mono tracking-wider font-semibold">Total</span>
                <span className="text-3xl font-black font-display text-neutral-800">{stats.totalResponses}</span>
                <span className="text-[9px] font-mono text-brass-500 font-bold uppercase">Avaliações</span>
              </div>
            </div>

            {/* Custom Interactive Legend below the chart to show Average Ratings directly */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-100">
              {sectorPieData.map((item, index) => (
                <div key={index} className="flex flex-col items-center text-center p-3 rounded-2xl bg-neutral-50/40 border border-neutral-100">
                  <div className="flex items-center gap-1.5 mb-1 justify-center">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-extrabold text-neutral-700 tracking-tight">{item.name}</span>
                  </div>
                  <div className="text-base font-extrabold text-neutral-800 font-mono">
                    {item.avg !== null ? `${item.avg}/5` : "—"}
                  </div>
                  <span className="text-[9px] text-neutral-400 font-mono">{item.value} respostas</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Evaluations list */}
          <div className="bg-white rounded-3xl border border-luxury-200/60 shadow-xs p-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-luxury-800 font-display mb-4 flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-brass-500" />
              AVALIAÇÕES RECENTES COLETADAS (FLEXSPOT)
            </h3>

            <div className="space-y-4">
              {filteredOccurrences.slice(0, 15).map((occ) => {
                const r = occ.ratings;
                return (
                  <div key={occ.id} className="p-4 bg-luxury-100/30 rounded-2xl border border-luxury-200/30 hover:border-luxury-200 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-neutral-900 text-white rounded-lg text-[9px] uppercase font-mono tracking-wider font-bold">
                          Quarto {occ.apartment}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Nº {occ.bookingNumber} • {occ.date}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${
                          occ.occurrenceType === "Reclamação" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {occ.occurrenceType}
                        </span>
                      </div>

                      <div className="text-neutral-700 text-xs leading-relaxed whitespace-pre-line font-serif">
                        {occ.observation}
                      </div>
                    </div>

                    {/* Sector Ratings grid inside item */}
                    {r && (
                      <div className="grid grid-cols-2 md:flex md:items-center gap-2 shrink-0">
                        {typeof r.wifi === "number" && (
                          <div className="px-3 py-1.5 bg-white border border-neutral-100 rounded-xl flex items-center gap-2">
                            <Wifi className="w-3.5 h-3.5 text-indigo-500" />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 font-bold">Wi-Fi</span>
                              <span className="text-xs font-bold text-neutral-800 font-mono">{r.wifi}/5</span>
                            </div>
                          </div>
                        )}
                        {typeof r.alimentacao === "number" && (
                          <div className="px-3 py-1.5 bg-white border border-neutral-100 rounded-xl flex items-center gap-2">
                            <Utensils className="w-3.5 h-3.5 text-neutral-600" />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 font-bold">Comida</span>
                              <span className="text-xs font-bold text-neutral-800 font-mono">{r.alimentacao}/5</span>
                            </div>
                          </div>
                        )}
                        {typeof r.atendimento === "number" && (
                          <div className="px-3 py-1.5 bg-white border border-neutral-100 rounded-xl flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 font-bold">Serviço</span>
                              <span className="text-xs font-bold text-neutral-800 font-mono">{r.atendimento}/5</span>
                            </div>
                          </div>
                        )}
                        {typeof r.limpeza === "number" && (
                          <div className="px-3 py-1.5 bg-white border border-neutral-100 rounded-xl flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 font-bold">Limpeza</span>
                              <span className="text-xs font-bold text-neutral-800 font-mono">{r.limpeza}/5</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
