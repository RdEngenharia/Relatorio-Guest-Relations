import React, { useState } from "react";
import { X, Star, AlertTriangle, ThumbsUp, BarChart3, Upload, Pencil, MessageSquare, Printer, ChevronRight, ChevronLeft, CheckCircle } from "lucide-react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    icon: <Star className="w-8 h-8 text-brass-500" />,
    title: "O que é o Guest Relations Console?",
    color: "from-luxury-800 to-luxury-900",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">
          O sistema centraliza todas as avaliações de hóspedes do <strong>PSP Resort</strong> em um único lugar, permitindo acompanhar a satisfação, identificar pontos de atenção e gerar relatórios para reuniões.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "📥", label: "Importar CSV do Flexspot", desc: "Avaliações automáticas dos hóspedes" },
            { icon: "📊", label: "Gráficos de desempenho", desc: "Médias por categoria em tempo real" },
            { icon: "✏️", label: "Editar avaliações", desc: "Acrescentar observações manuais" },
            { icon: "🖨️", label: "Imprimir relatórios", desc: "Por setor ou geral" },
          ].map((item, i) => (
            <div key={i} className="bg-luxury-50 rounded-xl p-3 border border-luxury-200">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-xs font-bold text-neutral-700">{item.label}</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    icon: <Upload className="w-8 h-8 text-indigo-500" />,
    title: "Como importar avaliações do Flexspot?",
    color: "from-indigo-600 to-indigo-800",
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          {[
            { step: "1", text: "Acesse o portal Flexspot e vá em Dados e Insights → Respostas de Pesquisas" },
            { step: "2", text: 'Clique no botão CSV para baixar o arquivo de respostas' },
            { step: "3", text: 'No sistema, clique em "Importar Planilha" no menu superior' },
            { step: "4", text: "Arraste ou selecione o arquivo CSV baixado" },
            { step: "5", text: 'Confira a prévia e clique em "Confirmar Importação"' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{item.step}</span>
              <p className="text-sm text-neutral-600">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-700">⚠️ Dica importante</p>
          <p className="text-xs text-amber-600 mt-1">Use sempre o arquivo <strong>.CSV</strong> (não o XLSX). O sistema reconhece e organiza automaticamente todas as respostas sem duplicar registros já importados.</p>
        </div>
      </div>
    )
  },
  {
    icon: <AlertTriangle className="w-8 h-8 text-rose-500" />,
    title: "Quando uma avaliação é \"Reclamação\"?",
    color: "from-rose-600 to-rose-800",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">
          O sistema usa a <strong>nota de Satisfação Geral</strong> (pergunta "No geral, como ficou seu nível de satisfação?") como critério principal:
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
            <span className="text-2xl">😟</span>
            <div>
              <p className="text-sm font-bold text-rose-700">Satisfação Geral ≤ 3 → <span className="bg-rose-600 text-white px-2 py-0.5 rounded-lg text-xs">Reclamação</span></p>
              <p className="text-xs text-rose-500 mt-0.5">Ex: nota 3/5 na satisfação geral = experiência abaixo da expectativa</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <span className="text-2xl">😊</span>
            <div>
              <p className="text-sm font-bold text-emerald-700">Satisfação Geral ≥ 4 → <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-lg text-xs">Feedback positivo</span></p>
              <p className="text-xs text-emerald-500 mt-0.5">Mesmo que algum setor específico tenha nota baixa</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-bold text-blue-700">💡 Exemplo real (Apto 46)</p>
          <p className="text-xs text-blue-600 mt-1">
            O hóspede deu Wi-Fi=3, Alimentação=3, Estrutura do Apto=2 — mas a <strong>Satisfação Geral foi 3/5</strong>. Por isso entrou como Reclamação: ele saiu com uma percepção mediana da experiência geral, não apenas de um setor específico.
          </p>
        </div>
      </div>
    )
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-brass-500" />,
    title: "Como o setor é atribuído?",
    color: "from-amber-600 to-amber-800",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">
          O sistema identifica o setor relevante de cada avaliação em <strong>3 etapas, nesta ordem:</strong>
        </p>
        <div className="space-y-3">
          <div className="border border-luxury-200 rounded-xl p-3">
            <p className="text-xs font-black text-luxury-800 uppercase tracking-wider mb-1">1º — Texto do comentário</p>
            <p className="text-xs text-neutral-600">Se o hóspede mencionou um setor no comentário, esse setor é atribuído.</p>
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-mono bg-neutral-50 px-2 py-1 rounded">"internet caindo o tempo todo" → <strong>Wifi</strong></p>
              <p className="text-[10px] font-mono bg-neutral-50 px-2 py-1 rounded">"a comida estava ótima" → <strong>AeB</strong></p>
              <p className="text-[10px] font-mono bg-neutral-50 px-2 py-1 rounded">"recepcionista muito gentil" → <strong>Recepção</strong></p>
            </div>
          </div>
          <div className="border border-luxury-200 rounded-xl p-3">
            <p className="text-xs font-black text-luxury-800 uppercase tracking-wider mb-1">2º — Nota crítica (≤ 3)</p>
            <p className="text-xs text-neutral-600">Se o comentário não mencionar nenhum setor, o sistema usa o setor da <strong>pior nota</strong> — mas só se ela for 3 ou menos.</p>
            <p className="text-[10px] font-mono bg-neutral-50 px-2 py-1 rounded mt-2">Estrutura Apto = 2/5 (pior nota) → <strong>Estrutura</strong></p>
          </div>
          <div className="border border-luxury-200 rounded-xl p-3">
            <p className="text-xs font-black text-luxury-800 uppercase tracking-wider mb-1">3º — Geral</p>
            <p className="text-xs text-neutral-600">Se o comentário for genérico ("Ótima estadia", "Tudo bem") e todas as notas forem ≥ 4, o setor fica como <strong>Geral</strong>. Esses comentários aparecem apenas em "Todos os comentários" — não poluem nenhum setor específico.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: <Printer className="w-8 h-8 text-neutral-600" />,
    title: "Como imprimir relatórios?",
    color: "from-neutral-700 to-neutral-900",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Existem <strong>dois tipos de impressão</strong>, acessíveis pelos botões no topo da tela:
        </p>
        <div className="space-y-3">
          <div className="bg-luxury-50 border border-luxury-200 rounded-xl p-4">
            <p className="text-sm font-bold text-luxury-800 flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4" /> Imprimir Gráficos
            </p>
            <p className="text-xs text-neutral-600">Gera um PDF com as barras de médias por categoria (satisfação, wifi, alimentação, etc.). Ideal para apresentar em reuniões com a gestão. <strong>Visível apenas na aba Gráficos.</strong></p>
          </div>
          <div className="bg-luxury-50 border border-luxury-200 rounded-xl p-4">
            <p className="text-sm font-bold text-luxury-800 flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4" /> Imprimir Comentários
            </p>
            <p className="text-xs text-neutral-600 mb-2">Abre um painel para você escolher:</p>
            <div className="space-y-1">
              <p className="text-xs bg-white border border-luxury-200 rounded-lg px-3 py-1.5">📋 <strong>Todos os comentários</strong> — imprime tudo do período</p>
              <p className="text-xs bg-white border border-luxury-200 rounded-lg px-3 py-1.5">🍽 <strong>AeB</strong> — só comentários que mencionam alimentação/bebidas</p>
              <p className="text-xs bg-white border border-luxury-200 rounded-lg px-3 py-1.5">📶 <strong>Wifi</strong> — só comentários sobre internet/conexão</p>
              <p className="text-xs text-neutral-400 text-[10px] px-3">…e assim por diante para cada setor disponível</p>
            </div>
            <p className="text-[10px] text-neutral-500 mt-2"><strong>Visível apenas na aba Lista de Avaliações.</strong></p>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: <Pencil className="w-8 h-8 text-emerald-500" />,
    title: "Como editar uma avaliação?",
    color: "from-emerald-600 to-emerald-800",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Toda avaliação importada do Flexspot pode ser complementada com informações adicionais pela equipe.
        </p>
        <div className="space-y-3">
          {[
            { icon: "1️⃣", text: 'Vá para a aba "Lista de Avaliações"' },
            { icon: "2️⃣", text: 'Encontre o hóspede desejado (use a busca por apartamento ou nome)' },
            { icon: "3️⃣", text: 'Clique no botão "Editar" no card do hóspede' },
            { icon: "4️⃣", text: 'Veja as notas do Flexspot (somente leitura) e edite a observação, tipo ou setor' },
            { icon: "5️⃣", text: 'Clique em "Salvar Alterações"' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg shrink-0">{item.icon}</span>
              <p className="text-sm text-neutral-600">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-xs font-bold text-emerald-700">✅ As notas do Flexspot são preservadas</p>
          <p className="text-xs text-emerald-600 mt-1">Ao editar uma avaliação, as pontuações originais do hóspede nunca são alteradas — apenas a observação, tipo e setor podem ser modificados pela equipe.</p>
        </div>
      </div>
    )
  },
  {
    icon: <CheckCircle className="w-8 h-8 text-brass-500" />,
    title: "Resumo rápido",
    color: "from-luxury-800 to-luxury-900",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-neutral-600">Guia de referência rápida para o dia a dia:</p>
        <div className="space-y-2">
          {[
            { emoji: "📥", acao: "Todo dia", desc: "Baixar CSV do Flexspot e importar no sistema" },
            { emoji: "🔴", acao: "Reclamação", desc: "Satisfação Geral ≤ 3/5 — hóspede saiu insatisfeito" },
            { emoji: "🟢", acao: "Feedback positivo", desc: "Satisfação Geral ≥ 4/5 — mesmo com algum item baixo" },
            { emoji: "📂", acao: "Setor", desc: "Definido pelo comentário ou pela pior nota (se ≤ 3)" },
            { emoji: "⚪", acao: "Setor Geral", desc: "Comentários genéricos sem setor específico identificado" },
            { emoji: "🖨️", acao: "Reunião", desc: "Imprimir Gráficos (aba Gráficos) para apresentar médias" },
            { emoji: "📋", acao: "Por setor", desc: "Imprimir Comentários (aba Lista) → escolher o setor" },
            { emoji: "✏️", acao: "Editar", desc: "Acrescentar observações mantendo as notas originais" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-luxury-50 rounded-xl px-3 py-2 border border-luxury-100">
              <span className="text-lg shrink-0">{item.emoji}</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-luxury-700 w-28 shrink-0">{item.acao}</span>
              <span className="text-xs text-neutral-600">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden" style={{ padding: '20px' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: 'min(90vh, 700px)' }}>

        {/* Header colorido */}
        <div className={`bg-gradient-to-br ${current.color} text-white p-6 flex items-start gap-4 shrink-0`}>
          <div className="p-3 bg-white/15 rounded-2xl shrink-0">{current.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/60 mb-1">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h2 className="text-base font-extrabold font-display leading-tight">{current.title}</h2>
          </div>
          <button onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="flex gap-1 px-6 py-3 bg-neutral-50 border-b border-neutral-100 shrink-0">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${i === step ? "bg-luxury-800" : i < step ? "bg-brass-500" : "bg-neutral-200"}`} />
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {current.content}
        </div>

        {/* Navegação */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-100 bg-white shrink-0">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          <span className="text-[10px] text-neutral-400 font-mono">{step + 1}/{STEPS.length}</span>

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-luxury-800 hover:bg-neutral-900 rounded-xl transition-all cursor-pointer">
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer">
              <CheckCircle className="w-4 h-4" /> Entendido!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
