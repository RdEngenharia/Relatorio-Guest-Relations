import React, { useState, useMemo, useEffect } from "react";
import { Occurrence } from "../types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Cell
} from "recharts";
import { Wifi, Utensils, UserCheck, Sparkles, TrendingUp, Calendar, Inbox, Star, Info, Printer, Trash2, ClipboardList, ChevronLeft, ChevronRight, BarChart3, ListChecks } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";

const ITEMS_PER_PAGE = 10;

interface RatingsDashboardProps {
  occurrences: Occurrence[];
  onClearData?: () => Promise<void>;
}

const normalizeScore = (v: number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  if (v >= 1 && v <= 5) return v;
  return null; // valores fora de 1-5 são dados inválidos — ignorar
};

export default function RatingsDashboard({ occurrences, onClearData }: RatingsDashboardProps) {
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeView, setActiveView] = useState<"graficos" | "lista">("graficos");
  const [currentPage, setCurrentPage] = useState(1);

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
    return occurrences.filter((occ) =>
      occ.ratings && Object.values(occ.ratings).some((v) => v !== null && v !== undefined)
    );
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

  // Filter list by selected dates — ordenado por data da avaliação, mais recente primeiro
  const filteredOccurrences = useMemo(() => {
    return flexspotOccurrences
      .filter((occ) => occ.date >= startDate && occ.date <= endDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [flexspotOccurrences, startDate, endDate]);

  // Reseta a paginação da lista sempre que o período filtrado mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate]);

  // Definição das 13 categorias de pontuação exibidas no dashboard, com metadados visuais.
  const RATING_CATEGORIES: { key: keyof NonNullable<Occurrence["ratings"]>; label: string; color: string; icon: any }[] = [
    { key: "satisfacaoGeral", label: "Satisfação Geral", color: "#9333ea", icon: Star },
    { key: "atendimentoGeral", label: "Atendimento Geral", color: "#d97706", icon: UserCheck },
    { key: "recepcao", label: "Recepção", color: "#ea580c", icon: UserCheck },
    { key: "wifi", label: "Wi-Fi / Conexão", color: "#4338ca", icon: Wifi },
    { key: "alimentacao", label: "Alimentação", color: "#1c3d5a", icon: Utensils },
    { key: "bebidas", label: "Bebidas", color: "#0369a1", icon: Utensils },
    { key: "boutique", label: "Boutique", color: "#be185d", icon: Sparkles },
    { key: "areasSociais", label: "Áreas Sociais (Limpeza)", color: "#0891b2", icon: Sparkles },
    { key: "limpezaApartamento", label: "Limpeza do Apto", color: "#0e7490", icon: Sparkles },
    { key: "estruturaApartamento", label: "Estrutura do Apto", color: "#65a30d", icon: Sparkles },
    { key: "equipeLazer", label: "Equipe de Lazer", color: "#ca8a04", icon: Sparkles },
    { key: "estruturaLazer", label: "Estrutura de Lazer", color: "#16a34a", icon: Sparkles },
    { key: "parqueAventuras", label: "Parque de Aventuras", color: "#059669", icon: Sparkles }
  ];

  // Calculations for KPI Cards — agora cobrindo as 13 categorias reais do CSV, calculadas dinamicamente
  const stats = useMemo(() => {
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    RATING_CATEGORIES.forEach(c => { sums[c.key] = 0; counts[c.key] = 0; });

    filteredOccurrences.forEach((occ) => {
      const r = occ.ratings;
      if (!r) return;
      RATING_CATEGORIES.forEach(c => {
        const score = normalizeScore((r as any)[c.key]);
        if (score !== null) {
          sums[c.key] += score;
          counts[c.key] += 1;
        }
      });
    });

    const capAvg = (val: number) => Math.min(5, Number(val.toFixed(1)));
    const averages: Record<string, number | null> = {};
    RATING_CATEGORIES.forEach(c => {
      averages[c.key] = counts[c.key] > 0 ? capAvg(sums[c.key] / counts[c.key]) : null;
    });

    // Overall Average — média das médias de todas as categorias com pelo menos 1 resposta
    const validAverages = RATING_CATEGORIES
      .map(c => averages[c.key])
      .filter((v): v is number => v !== null);
    const overallAvg = validAverages.length > 0
      ? Number((validAverages.reduce((a, b) => a + b, 0) / validAverages.length).toFixed(1))
      : null;

    return {
      averages,
      counts,
      overallAvg,
      totalResponses: filteredOccurrences.length
    };
  }, [filteredOccurrences]);

  // Chart Data: Pie Chart representing volume of reviews per category, just like the dashboard
  const sectorPieData = useMemo(() => {
    return RATING_CATEGORIES
      .map(c => ({ name: c.label, value: stats.counts[c.key] || 0, avg: stats.averages[c.key], color: c.color }))
      .filter(item => item.value > 0);
  }, [stats]);

  // Helper to determine badge background for ratings (1-5 scale)
  const getRatingBadgeClass = (score: number | null | undefined) => {
    if (score === null || score === undefined) return "bg-neutral-100 text-neutral-400";
    if (score >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score >= 2.5) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
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
      <ConfirmDialog
        open={showConfirm}
        title="Limpar dados do Flexspot"
        description="Esta ação não pode ser desfeita."
        message={
          <>
            Todos os <strong>{flexspotOccurrences.length} registros</strong> de avaliações do Flexspot serão excluídos permanentemente do sistema.
          </>
        }
        confirmLabel="Sim, excluir tudo"
        loading={clearing}
        loadingLabel="Excluindo..."
        onConfirm={handleClear}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Navegação por abas: Gráficos (KPIs + pizza) vs Lista detalhada por apartamento */}
      {flexspotOccurrences.length > 0 && filteredOccurrences.length > 0 && (
        <div className="flex items-center gap-2 bg-luxury-100/40 p-1.5 rounded-xl border border-luxury-200/30 w-fit print:hidden">
          <button
            onClick={() => setActiveView("graficos")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeView === "graficos" ? "bg-luxury-800 text-white shadow-sm" : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Gráficos e Médias
          </button>
          <button
            onClick={() => setActiveView("lista")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeView === "lista" ? "bg-luxury-800 text-white shadow-sm" : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Avaliações por Apartamento
          </button>
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
          {/* Bloco de GRÁFICOS E MÉDIAS — visível apenas na aba "Gráficos", inclusive na impressão */}
          <div id="flexspot-tab-graficos" data-tab-active={activeView === "graficos"} className={activeView === "graficos" ? "space-y-6" : "hidden print:hidden"}>
          {/* Balões com Pontuação Geral e Total de Respostas, fora do gráfico */}
          <div className="flex flex-wrap justify-center gap-4">
            <div className="bg-gradient-to-br from-luxury-800 to-luxury-900 text-white px-8 py-5 rounded-2xl border border-luxury-900 shadow-md flex items-center gap-5 relative overflow-hidden max-w-md w-full sm:w-auto">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Star className="w-16 h-16 text-white" />
              </div>
              <span className="p-2.5 bg-white/10 rounded-xl text-brass-400 shrink-0"><Sparkles className="w-5 h-5" /></span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 font-display block">Pontuação Geral</span>
                <span className="text-3xl font-black font-mono tracking-tight text-white">
                  {stats.overallAvg !== null ? stats.overallAvg : "N/A"}
                </span>
                <span className="text-xs text-neutral-400 ml-1 font-bold">/5</span>
              </div>
            </div>

            <div className="bg-white px-8 py-5 rounded-2xl border border-luxury-200/60 shadow-xs flex items-center gap-5 relative overflow-hidden max-w-md w-full sm:w-auto">
              <span className="p-2.5 bg-brass-500/10 rounded-xl text-brass-600 shrink-0"><ClipboardList className="w-5 h-5" /></span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 font-display block">Total de Respostas</span>
                <span className="text-3xl font-black font-mono tracking-tight text-neutral-800">
                  {stats.totalResponses}
                </span>
                <p className="text-[10px] text-neutral-400 font-serif mt-0.5">
                  Avaliações coletadas no período selecionado.
                </p>
              </div>
            </div>
          </div>

          {/* Charts Area - Pizza Style (Pie Chart) like Dashboard */}
          <div className="bg-white p-6 rounded-3xl border border-luxury-200/60 shadow-xs max-w-3xl mx-auto w-full relative">
            <h3 className="text-xs font-black uppercase tracking-wider text-luxury-800 font-display flex items-center gap-2 mb-6 justify-center">
              <span className="w-2.5 h-2.5 bg-brass-500 rounded-full animate-pulse"></span>
              Distribuição de Avaliações por Setor (Volume)
            </h3>

            {/* Nota fixa no canto explicando a escala uma única vez */}
            <span className="absolute top-5 right-6 text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-wide bg-neutral-50 border border-neutral-100 rounded-full px-2.5 py-1">
              Notas em escala de 1 a 5
            </span>
            
            <div id="flexspot-piechart-container" className="flex flex-col items-center justify-center relative w-full" style={{ height: 380 }}>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={sectorPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={150}
                    paddingAngle={2}
                    dataKey="value"
                    label={(props: any) => {
                      // Mostra o nome do setor + a nota DENTRO das fatias grandes o bastante
                      // para o texto caber em duas linhas sem se sobrepor à fatia vizinha.
                      const { cx, cy, midAngle, innerRadius, outerRadius, percent, payload, name } = props;
                      if (!percent || percent < 0.06) return null; // fatia pequena: nome fica só na legenda
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const avgStr = payload?.avg !== null && payload?.avg !== undefined ? `${payload.avg}` : "";
                      // Quebra o nome do setor em até 2 linhas curtas para caber dentro da fatia
                      const words = String(name).split(" ");
                      const lines: string[] = [];
                      let current = "";
                      words.forEach(w => {
                        const test = current ? `${current} ${w}` : w;
                        if (test.length > 11 && current) {
                          lines.push(current);
                          current = w;
                        } else {
                          current = test;
                        }
                      });
                      if (current) lines.push(current);
                      const nameLines = lines.slice(0, 2);
                      return (
                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none">
                          {nameLines.map((line, i) => (
                            <tspan
                              key={i}
                              x={x}
                              dy={i === 0 ? `${-0.3 * (nameLines.length - 1) - 0.55}em` : "1.05em"}
                              fill="#ffffff"
                              className="font-sans font-extrabold text-[9px]"
                            >
                              {line}
                            </tspan>
                          ))}
                          <tspan x={x} dy="1.15em" fill="#ffffff" className="font-mono font-black text-[14px]">
                            {avgStr}
                          </tspan>
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {sectorPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e9e6dc", fontFamily: "Inter, sans-serif", fontSize: "11px" }}
                    formatter={(value: any, name: any, props: any) => {
                      const avgStr = props.payload.avg !== null ? `${props.payload.avg}/5` : "N/A";
                      return [`${value} avaliações (Média: ${avgStr})`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Centered Total Indicator — verdadeiramente centralizado no contêiner */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-neutral-400 uppercase font-mono tracking-wider font-semibold">Total</span>
                <span className="text-3xl font-black font-display text-neutral-800">{stats.totalResponses}</span>
                <span className="text-[9px] font-mono text-brass-500 font-bold uppercase">Avaliações</span>
              </div>
            </div>
          </div>
          </div>
          {/* Fim do bloco de GRÁFICOS E MÉDIAS */}

          {/* Bloco de AVALIAÇÕES POR APARTAMENTO — visível na aba "Lista" e sempre na impressão */}
          <div id="flexspot-tab-lista" data-tab-active={activeView === "lista"} className={activeView === "lista" ? "" : "hidden print:hidden"}>
          {(() => {
            const totalPages = Math.ceil(filteredOccurrences.length / ITEMS_PER_PAGE);
            const pagedOccurrences = filteredOccurrences.slice(
              (currentPage - 1) * ITEMS_PER_PAGE,
              currentPage * ITEMS_PER_PAGE
            );

            const EvalCard = ({ occ }: { occ: typeof filteredOccurrences[0] }) => {
              const r = occ.ratings;
              const gi = occ.generalInfo;
              return (
                <div className="p-4 bg-luxury-100/30 rounded-2xl border border-luxury-200/30 hover:border-luxury-200 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {gi?.primeiraVez && (
                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-sky-50 text-sky-700">
                          {gi.primeiraVez === "Sim" ? "1ª hospedagem" : "Hóspede recorrente"}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-700 text-xs leading-relaxed whitespace-pre-line font-serif">
                      {occ.observation}
                    </div>
                  </div>
                  {r && (
                    <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-center gap-2 shrink-0 max-w-full md:max-w-md">
                      {RATING_CATEGORIES.filter(cat => normalizeScore((r as any)[cat.key]) !== null).map(cat => {
                        const Icon = cat.icon;
                        return (
                          <div key={cat.key} className="px-3 py-1.5 bg-white border border-neutral-100 rounded-xl flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cat.color }} />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 font-bold whitespace-nowrap">{cat.label}</span>
                              <span className="text-xs font-bold text-neutral-800 font-mono">{normalizeScore((r as any)[cat.key])}/5</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="bg-white rounded-3xl border border-luxury-200/60 shadow-xs p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-luxury-800 font-display mb-4 flex items-center gap-2">
                  <ClipboardList className="w-4.5 h-4.5 text-brass-500" />
                  AVALIAÇÕES COLETADAS (FLEXSPOT) — {filteredOccurrences.length} no total
                </h3>

                {/* Screen: paginated view */}
                <div className="space-y-4 print:hidden">
                  {pagedOccurrences.map((occ) => (
                    <EvalCard key={occ.id} occ={occ} />
                  ))}
                </div>

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100 print:hidden">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    <span className="text-xs font-mono font-bold text-neutral-500">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Print: show ALL evaluations without pagination */}
                <div className="hidden print:block space-y-3">
                  {filteredOccurrences.map((occ) => (
                    <EvalCard key={occ.id} occ={occ} />
                  ))}
                </div>
              </div>
            );
          })()}
          </div>
          {/* Fim do bloco de AVALIAÇÕES POR APARTAMENTO */}
        </>
      )}
    </div>
  );
}
