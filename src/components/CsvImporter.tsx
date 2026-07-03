import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, writeBatch, serverTimestamp, getDocs, query, collection, where, getDoc } from "firebase/firestore";
import { Occurrence } from "../types";
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  RefreshCw, 
  Download, 
  HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import ConfirmDialog from "./ConfirmDialog";

interface CsvImporterProps {
  onImportFinished: () => void;
  onCancel: () => void;
}

// Maps Portuguese month abbreviations to number index (0-indexed)
const PORTUGUESE_MONTHS: { [key: string]: number } = {
  jan: 0, janeiro: 0,
  fev: 1, fevereiro: 1,
  mar: 2, marco: 2, março: 2,
  abr: 3, abril: 3,
  mai: 4, maio: 4,
  jun: 5, junho: 5,
  jul: 6, julho: 6,
  ago: 7, agosto: 7,
  set: 8, setembro: 8,
  out: 9, outubro: 9,
  nov: 10, novembro: 10,
  dez: 11, dezembro: 11
};

// Trunca uma string até o tamanho máximo permitido — usada em qualquer ponto do
// arquivo (no parser e também na deduplicação/merge em handleConfirmImport).
const limitStr = (val: any, max: number): string => {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  return s.length > max ? s.substring(0, max) : s;
};

export default function CsvImporter({ onImportFinished, onCancel }: CsvImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<Partial<Occurrence>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Download template CSV helper
  const handleDownloadTemplate = () => {
    const headers = ["DATA", "Nº RESERVA", "APTO", "TIPO DE OCORRÊNCIA", "TIPO DE RECLAMAÇÃO", "OBSERVAÇÃO"];
    const rows = [
      ["01/mai", "117228", "98", "Reclamação", "Estrutura", "Reclamou das escadas de acesso ao apartamento"],
      ["01/mai", "117119", "140", "Feedback positivo", "Geral", "Disse que gostou da estadia e que não há nada a pontuar"],
      ["02/mai", "112994", "58", "Reclamação", "Lazer", "Reclamou do fato de não ter musica ao vivo no clube de praia"]
    ];

    // Semicolon separator is standard for Excel in European and South American locales (like Brazil)
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(row => row.map(val => `"${val}"`).join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_ocorrencias_guest_relations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Robust Local Parser with automatic format grouping for Flexspot & standard formats
  const processParsedRows = (rows: any[][]): Partial<Occurrence>[] => {
    const firstRow = rows[0];
    if (!firstRow || firstRow.length === 0) {
      throw new Error("A primeira linha do arquivo está vazia.");
    }

    const cleanHeader = (val: any) => {
      if (val === null || val === undefined) return "";
      return String(val)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const headers = firstRow.map(cleanHeader);

    const aptIdx = headers.findIndex(h => h.includes("apartamento") || h === "apto" || h === "quarto" || h === "apt");
    // IMPORTANTE: "data de resposta" também contém a palavra "resposta", então a detecção
    // da coluna de DATA precisa ser checada com prioridade e de forma exclusiva,
    // e a coluna de RESPOSTA (nota) não deve casar com colunas que falem de "data".
    const dateIdx = headers.findIndex(h => h.includes("data de resposta") || h.includes("data resposta") || h === "data" || h === "date");
    const emailIdx = headers.findIndex(h => h === "email" || h === "e-mail");
    const surveyNameIdx = headers.findIndex(h => h.includes("nome da pesquisa") || h.includes("pesquisa"));
    const questionIdx = headers.findIndex(h => h === "pergunta" || h.includes("pergunta"));
    const answerIdx = headers.findIndex((h, idx) => idx !== dateIdx && (h === "resposta" || (h.includes("resposta") && !h.includes("data")) || h === "valor" || h === "nota"));
    const userIdx = headers.findIndex(h => h === "usuario" || h === "nome" || h === "cliente" || h === "hospede" || h === "user");
    const bookingIdx = headers.findIndex(h => h.includes("reserva") || h.includes("booking") || h.includes("nº") || h.includes("no") || h.includes("codigo") || h === "cod" || h === "num");
    const sectorIdx = headers.findIndex(h => h.includes("tipo de reclamacao") || h.includes("reclamacao") || h.includes("setor") || h.includes("categoria") || h === "area" || h === "dep" || h === "departamento");
    const obsIdx = headers.findIndex(h => h.includes("observacao") || h.includes("descricao") || h === "obs" || h.includes("relato") || h.includes("texto") || h === "detalhe" || h.includes("comentario") || h.includes("comentário"));

    // If it is a Flexspot Tabular Export (specifically has a question & answer row per survey question)
    if (aptIdx !== -1 && questionIdx !== -1 && answerIdx !== -1) {
      const groups: { [key: string]: any[] } = {};

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const getVal = (idx: number) => {
          if (idx === -1 || idx >= row.length) return "";
          return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
        };

        const apartment = getVal(aptIdx);
        const dateStr = getVal(dateIdx);
        const email = getVal(emailIdx);
        const surveyName = getVal(surveyNameIdx);
        const question = getVal(questionIdx);
        const answer = getVal(answerIdx);
        // Usa nome do usuário; fallback para parte do email se nome vier vazio
        const rawUserName = getVal(userIdx);
        const userName = rawUserName || (email ? email.split("@")[0] : "") || "Hóspede Flexspot";

        if (!apartment && !question) continue;

        // Agrupamos por apartamento + nome do hóspede + DIA (sem hora), porque o mesmo
        // hóspede pode responder a pesquisa mais de uma vez no mesmo dia (em sessões com
        // horários diferentes). Cada sessão é identificada internamente por dateHourKey e,
        // se houver mais de uma sessão no mesmo dia, suas notas serão consolidadas por média
        // (ver lógica de consolidação abaixo).
        const dateDayKey = dateStr.trim().split(" ")[0]; // e.g. "26/06/26" de "26/06/26 10:26"
        const dateHourKey = dateStr.trim().split(":")[0]; // e.g. "26/06/26 10" de "26/06/26 10:26" — identifica a sessão
        const key = `${apartment.toLowerCase()}|||${userName.toLowerCase()}|||${dateDayKey.toLowerCase()}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push({
          apartment,
          dateStr,
          dateHourKey,
          email,
          surveyName,
          question,
          answer,
          userName
        });
      }

      const items: Partial<Occurrence>[] = [];

      const parseRatingValue = (valStr: string): number | undefined => {
        const cleanVal = valStr.trim();
        const num = parseFloat(cleanVal);
        if (isNaN(num) || num <= 0) return undefined;
        // Already on 1-5 scale
        if (num <= 5) return Math.round(num);
        // 6-10 scale → convert to 1-5
        if (num <= 10) return Math.round((num / 10) * 5);
        // 1-100 percentage scale → convert to 1-5
        if (num <= 100) return Math.round((num / 100) * 5);
        return undefined;
      };

      const parseFlexspotDate = (rawDate: string): string => {
        if (!rawDate) return new Date().toISOString().split("T")[0];
        const datePart = rawDate.trim().split(" ")[0]; // Take "26/06/26" from "26/06/26 09:38"
        const slashParts = datePart.split("/");
        if (slashParts.length >= 2) {
          const day = parseInt(slashParts[0], 10);
          const month = parseInt(slashParts[1], 10) - 1;
          let year = slashParts.length === 3 ? parseInt(slashParts[2], 10) : 2026;
          if (year < 100) {
            year = 2000 + year; // Convert "26" to 2026
          }
          const parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            const off = parsedDate.getTimezoneOffset();
            const cleanLocal = new Date(parsedDate.getTime() - off * 60 * 1000);
            return cleanLocal.toISOString().split("T")[0];
          }
        }
        return new Date().toISOString().split("T")[0];
      };

      // Mapa de detecção das 13 perguntas de PONTUAÇÃO (escala 1-5) do Flexspot.
      // Cada entrada é verificada em ordem; a primeira que "casar" com a pergunta vence.
      // IMPORTANT: frases mais específicas vêm antes das mais genéricas para evitar
      // que, por exemplo, "Avalie atendimento geral" seja capturada por uma regra de "recepção".
      const RATING_MATCHERS: { key: keyof NonNullable<Partial<Occurrence>["ratings"]>; test: (q: string) => boolean }[] = [
        { key: "atendimentoGeral", test: q => q.includes("atendimento geral") },
        { key: "wifi", test: q => q.includes("internet") || q.includes("wifi") || q.includes("wi-fi") || q.includes("conexao") },
        { key: "boutique", test: q => q.includes("boutique") },
        { key: "bebidas", test: q => q.includes("bebidas") },
        { key: "alimentacao", test: q => q.includes("alimentacao") || q.includes("comida") || q.includes("restaurante") },
        { key: "areasSociais", test: q => q.includes("areas sociais") || q.includes("conservacao e limpeza") },
        { key: "equipeLazer", test: q => q.includes("equipe de lazer") },
        { key: "estruturaLazer", test: q => q.includes("estrutura de lazer") },
        { key: "parqueAventuras", test: q => q.includes("parque de aventuras") || q.includes("parque") },
        { key: "limpezaApartamento", test: q => q.includes("limpeza do apartamento") || q.includes("limpeza apto") },
        { key: "estruturaApartamento", test: q => q.includes("estrutura do apartamento") || q.includes("estrutura apto") },
        { key: "recepcao", test: q => q.includes("recepcao") },
        { key: "satisfacaoGeral", test: q => q.includes("nivel de satisfacao") || q.includes("satisfacao") }
      ];

      // Mapa de detecção das informações GERAIS/qualitativas (não são notas).
      const isPrimeiraVezQuestion = (q: string) => q.includes("primeira vez") || q.includes("hospedado conosco");
      const isComentariosQuestion = (q: string) => q.includes("comentarios gerais") || q.includes("comentario") || q.includes("sugestao");

      const EMPTY_COMMENT_VALUES = new Set([
        "sem comentarios adicionais.",
        "sem comentarios adicionais",
        "sem comentarios",
        "bom",
        "ok",
        ""
      ]);

      Object.keys(groups).forEach(key => {
        const groupRows = groups[key];
        if (groupRows.length === 0) return;

        // Separa as linhas do grupo (mesmo hóspede + mesmo dia) em sub-sessões,
        // identificadas pela hora aproximada de resposta (dateHourKey). Isso é necessário
        // porque um hóspede pode ter respondido a pesquisa MAIS DE UMA VEZ no mesmo dia
        // (em horários diferentes) — nesse caso, cada resposta é uma sessão distinta, e as
        // notas de cada sessão serão consolidadas por MÉDIA entre as sessões existentes.
        const sessionsMap: { [hourKey: string]: any[] } = {};
        groupRows.forEach(r => {
          const hKey = r.dateHourKey || "default";
          if (!sessionsMap[hKey]) sessionsMap[hKey] = [];
          sessionsMap[hKey].push(r);
        });
        const sessions = Object.values(sessionsMap);

        const firstRow = groupRows[0];

        // Para cada sessão, extrai suas próprias notas/informações gerais isoladamente.
        const perSessionRatings: NonNullable<Partial<Occurrence>["ratings"]>[] = [];
        let primeiraVez: string | undefined = undefined;
        let commentText = "";

        sessions.forEach(sessionRows => {
          const sessionRatings: NonNullable<Partial<Occurrence>["ratings"]> = {};

          sessionRows.forEach((r: any) => {
            const qClean = cleanHeader(r.question);
            const ans = r.answer;

            // 1) Tenta casar com uma das 13 perguntas de pontuação
            const matcher = RATING_MATCHERS.find(m => m.test(qClean));
            if (matcher) {
              const score = parseRatingValue(ans);
              if (score !== undefined) {
                sessionRatings[matcher.key] = score;
              }
              return; // pergunta de nota não é também comentário/geral
            }

            // 2) Pergunta "É sua primeira vez hospedado conosco?" — Sim/Não, não é nota
            if (isPrimeiraVezQuestion(qClean)) {
              if (ans && ans.trim()) primeiraVez = ans.trim();
              return;
            }

            // 3) "Comentários gerais" e variações — texto livre, não é nota.
            // Quando há múltiplas sessões, mantemos o comentário mais recente não vazio.
            if (isComentariosQuestion(qClean)) {
              const ansClean = cleanHeader(ans || "");
              if (ans && ans.trim() && !EMPTY_COMMENT_VALUES.has(ansClean)) {
                commentText = ans.trim();
              }
            }
          });

          perSessionRatings.push(sessionRatings);
        });

        // Consolida as notas: se só há 1 sessão, usa os valores diretamente.
        // Se há múltiplas sessões, calcula a MÉDIA de cada categoria entre as sessões
        // que responderam aquela categoria (arredondada para o inteiro mais próximo,
        // já que a escala de notas é 1-5).
        const ratings: NonNullable<Partial<Occurrence>["ratings"]> = {};
        const allRatingKeys = new Set<string>();
        perSessionRatings.forEach(sr => Object.keys(sr).forEach(k => allRatingKeys.add(k)));

        allRatingKeys.forEach(k => {
          const values = perSessionRatings
            .map(sr => (sr as any)[k])
            .filter((v): v is number => v !== undefined && v !== null);
          if (values.length === 0) return;
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          (ratings as any)[k] = Math.round(avg);
        });

        const finalDate = parseFlexspotDate(firstRow.dateStr);
        const apartment = firstRow.apartment || "N/A";
        const userName = firstRow.userName || "Hóspede";

        if (!commentText) {
          commentText = `Pesquisa de satisfação preenchida por ${userName} (Quarto ${apartment}).`;
        }
        if (sessions.length > 1) {
          commentText += ` (Média consolidada de ${sessions.length} respostas enviadas no mesmo dia.)`;
        }

        // Determine setor de maior atenção (menor nota entre as categorias com pior cobertura de setor)
        const SECTOR_BY_RATING_KEY: Record<string, string> = {
          wifi: "Wifi",
          alimentacao: "AeB",
          bebidas: "AeB",
          boutique: "AeB",
          limpezaApartamento: "Governança",
          areasSociais: "Governança",
          atendimentoGeral: "Recepção",
          recepcao: "Recepção",
          equipeLazer: "Lazer",
          estruturaLazer: "Lazer",
          parqueAventuras: "Lazer",
          estruturaApartamento: "Estrutura",
          satisfacaoGeral: "Recepção"
        };

        const ratingEntries = Object.entries(ratings).filter(([, v]) => v !== undefined && v !== null) as [string, number][];

        let sector = "Recepção";
        let minScore = 11;
        ratingEntries.forEach(([k, v]) => {
          if (v < minScore) {
            minScore = v;
            sector = SECTOR_BY_RATING_KEY[k] || "Recepção";
          }
        });

        const activeScores = ratingEntries.map(([, v]) => v);
        const allIdenticalAndHigh = activeScores.length > 0 &&
                                    activeScores.every(s => s === activeScores[0]) &&
                                    activeScores[0] >= 4;
        if (allIdenticalAndHigh) {
          sector = "Recepção";
        }

        // Classificação do tipo de ocorrência:
        // 1º critério: nota de SATISFAÇÃO GERAL do hóspede (a mais fiel à percepção dele)
        // 2º critério (fallback): média geral de todas as notas
        // Só classifica como Reclamação se a satisfação geral for ≤ 3,
        // ou se não houver satisfação geral e a média das notas for ≤ 3.
        let occurrenceType = "Feedback positivo";
        if (activeScores.length > 0) {
          const satisfacaoGeral = (ratings as any)["satisfacaoGeral"];
          if (satisfacaoGeral !== null && satisfacaoGeral !== undefined) {
            // Usa satisfação geral como critério principal
            if (satisfacaoGeral <= 3) occurrenceType = "Reclamação";
          } else {
            // Fallback: média geral de todas as notas
            const avgScore = activeScores.reduce((a, b) => a + b, 0) / activeScores.length;
            if (avgScore <= 3) occurrenceType = "Reclamação";
          }
        }

        const occurrence: Partial<Occurrence> & { _dedupKey?: string } = {
          date: limitStr(finalDate, 32),
          bookingNumber: limitStr(`FLEXSPOT-${apartment}-${Math.floor(1000 + Math.random() * 9000)}`, 32),
          apartment: limitStr(apartment, 32),
          occurrenceType: limitStr(occurrenceType, 128),
          sector: limitStr(sector, 128),
          observation: limitStr(commentText, 5000),
          source: "flexspot"
        };

        // Chave de deduplicação: identifica de forma estável o MESMO hóspede no MESMO
        // apartamento no MESMO dia, independente de quantas vezes este arquivo seja
        // reimportado. Usada em handleConfirmImport para evitar registros duplicados.
        occurrence._dedupKey = `${apartment}|||${userName}|||${finalDate}`.toLowerCase();

        if (ratingEntries.length > 0) {
          occurrence.ratings = ratings;
        }

        if (primeiraVez !== undefined || commentText) {
          occurrence.generalInfo = {
            primeiraVez: primeiraVez ?? null,
            comentariosGerais: commentText || null
          };
        }

        items.push(occurrence);
      });

      return items;
    } else {
      // Fallback to standard 6-column sheet importer OR wide multi-sector rating columns sheet
      const wifiColIdx = headers.findIndex(h => h.includes("wifi") || h.includes("wi-fi") || h.includes("internet") || h.includes("conexao"));
      const foodColIdx = headers.findIndex(h => h.includes("alimentacao") || h.includes("bebidas") || h.includes("comida") || h.includes("restaurante") || h === "aeb" || h === "a&b");
      const serviceColIdx = headers.findIndex(h => h.includes("recepcao") || h.includes("atendimento") || h.includes("equipe") || h === "servico");
      const cleanColIdx = headers.findIndex(h => h.includes("limpeza") || h.includes("governanca") || h.includes("arrumacao") || h.includes("higiene"));

      const hasRatingCols = wifiColIdx !== -1 || foodColIdx !== -1 || serviceColIdx !== -1 || cleanColIdx !== -1;

      let matchedDateIdx = dateIdx !== -1 ? dateIdx : 0;
      
      let matchedBookingIdx = bookingIdx !== -1 ? bookingIdx : 1;
      if (hasRatingCols && (matchedBookingIdx === wifiColIdx || matchedBookingIdx === foodColIdx || matchedBookingIdx === serviceColIdx || matchedBookingIdx === cleanColIdx)) {
        matchedBookingIdx = -1;
      }

      let matchedAptIdx = aptIdx !== -1 ? aptIdx : 2;
      if (hasRatingCols && (matchedAptIdx === wifiColIdx || matchedAptIdx === foodColIdx || matchedAptIdx === serviceColIdx || matchedAptIdx === cleanColIdx)) {
        matchedAptIdx = -1;
      }

      let matchedTypeIdx = headers.findIndex(h => h.includes("tipo de ocorrencia") || h.includes("tipo ocorr") || h === "tipo");
      if (matchedTypeIdx === -1) matchedTypeIdx = 3;
      if (hasRatingCols && (matchedTypeIdx === wifiColIdx || matchedTypeIdx === foodColIdx || matchedTypeIdx === serviceColIdx || matchedTypeIdx === cleanColIdx)) {
        matchedTypeIdx = -1;
      }

      let matchedSectorIdx = sectorIdx !== -1 ? sectorIdx : 4;
      if (hasRatingCols && (matchedSectorIdx === wifiColIdx || matchedSectorIdx === foodColIdx || matchedSectorIdx === serviceColIdx || matchedSectorIdx === cleanColIdx)) {
        matchedSectorIdx = -1;
      }

      let matchedObsIdx = obsIdx !== -1 ? obsIdx : 5;
      if (hasRatingCols && (matchedObsIdx === wifiColIdx || matchedObsIdx === foodColIdx || matchedObsIdx === serviceColIdx || matchedObsIdx === cleanColIdx)) {
        matchedObsIdx = -1;
      }

      const parseRatingVal = (valStr: string): number | null => {
        if (!valStr) return null;
        const clean = valStr.trim();
        const num = parseFloat(clean);
        if (isNaN(num)) return null;
        if (num >= 1 && num <= 5) {
          return num;
        }
        if (num > 5 && num <= 10) {
          return Math.round(num / 2);
        }
        return null;
      };

      const items: Partial<Occurrence>[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const getVal = (idx: number) => {
          if (idx === -1 || idx >= row.length) return "";
          return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
        };

        const rawDate = getVal(matchedDateIdx);
        const bookingVal = matchedBookingIdx !== -1 ? getVal(matchedBookingIdx) : `S/N-${Math.floor(1000 + Math.random() * 9000)}`;
        const apartmentVal = matchedAptIdx !== -1 ? getVal(matchedAptIdx) : "S/A";
        const typeVal = matchedTypeIdx !== -1 ? getVal(matchedTypeIdx) : "";
        const sectorVal = matchedSectorIdx !== -1 ? getVal(matchedSectorIdx) : "";
        const obsVal = matchedObsIdx !== -1 ? getVal(matchedObsIdx) : "";

        if (!obsVal && !apartmentVal && !hasRatingCols) continue;

        let finalDateStr = new Date().toISOString().split("T")[0];
        if (rawDate) {
          const slashParts = rawDate.split("/");
          if (slashParts.length >= 2) {
            const day = parseInt(slashParts[0], 10);
            const month = parseInt(slashParts[1], 10) - 1;
            let year = slashParts.length === 3 ? parseInt(slashParts[2], 10) : 2026;
            if (year < 100) year = 2000 + year;
            const parsedDate = new Date(year, month, day);
            if (!isNaN(parsedDate.getTime())) {
              const off = parsedDate.getTimezoneOffset();
              const cleanLocal = new Date(parsedDate.getTime() - off * 60 * 1000);
              finalDateStr = cleanLocal.toISOString().split("T")[0];
            }
          }
        }

        const wifiVal = wifiColIdx !== -1 ? parseRatingVal(getVal(wifiColIdx)) : null;
        const foodVal = foodColIdx !== -1 ? parseRatingVal(getVal(foodColIdx)) : null;
        const serviceVal = serviceColIdx !== -1 ? parseRatingVal(getVal(serviceColIdx)) : null;
        const cleanVal = cleanColIdx !== -1 ? parseRatingVal(getVal(cleanColIdx)) : null;

        let finalSector = sectorVal || "Outro";
        let minScore = 11;
        let ratingSector = "Recepção";

        if (wifiVal !== null && wifiVal < minScore) { minScore = wifiVal; ratingSector = "Wifi"; }
        if (foodVal !== null && foodVal < minScore) { minScore = foodVal; ratingSector = "AeB"; }
        if (serviceVal !== null && serviceVal < minScore) { minScore = serviceVal; ratingSector = "Recepção"; }
        if (cleanVal !== null && cleanVal < minScore) { minScore = cleanVal; ratingSector = "Governança"; }

        if (wifiVal !== null || foodVal !== null || serviceVal !== null || cleanVal !== null) {
          if (!sectorVal || sectorVal.trim() === "" || sectorVal === "Outro" || !isNaN(parseFloat(sectorVal))) {
            const activeScores = [wifiVal, foodVal, serviceVal, cleanVal].filter(s => s !== null) as number[];
            const allIdenticalAndHigh = activeScores.length > 0 && 
                                        activeScores.every(s => s === activeScores[0]) && 
                                        activeScores[0] >= 4;
            if (allIdenticalAndHigh) {
              finalSector = "Recepção";
            } else {
              finalSector = ratingSector;
            }
          }
        }

        let finalType = "Feedback positivo";
        if (typeVal) {
          const typeClean = typeVal.toLowerCase();
          finalType = typeClean.includes("positivo") ? "Feedback positivo" : (typeClean.includes("outro") ? "Outro" : "Reclamação");
        } else if (wifiVal !== null || foodVal !== null || serviceVal !== null || cleanVal !== null) {
          if (minScore <= 3) {
            finalType = "Reclamação";
          } else {
            finalType = "Feedback positivo";
          }
        } else {
          finalType = "Reclamação";
        }

        const occurrence: Partial<Occurrence> = {
          date: limitStr(finalDateStr, 32),
          bookingNumber: limitStr(bookingVal, 32),
          apartment: limitStr(apartmentVal, 32),
          occurrenceType: limitStr(finalType, 128),
          sector: limitStr(finalSector, 128),
          observation: limitStr(obsVal || `Avaliação de satisfação do hóspede (Quarto ${apartmentVal}).`, 5000),
          source: "flexspot"
        };

        if (wifiVal !== null || foodVal !== null || serviceVal !== null || cleanVal !== null) {
          occurrence.ratings = {
            wifi: wifiVal,
            alimentacao: foodVal,
            atendimentoGeral: serviceVal,
            limpezaApartamento: cleanVal
          };
        } else {
          occurrence.source = "resort"; // Keep original source if it has no ratings
        }

        items.push(occurrence);
      }

      return items;
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setNotification(null);

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let rows: any[][] = [];
        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json<any[][]>(worksheet, { header: 1, defval: "" });
        } else {
          let text = e.target?.result as string;
          if (!text) throw new Error("O arquivo está vazio.");
          text = text.replace(/^\uFEFF/, "").trim();

          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          if (lines.length < 1) throw new Error("O arquivo está vazio.");

          // Auto-detect delimiter: semicolon, comma, or tab
          const firstLine = lines[0];
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const tabCount = (firstLine.match(/\t/g) || []).length;
          
          let delimiter = ",";
          if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ";";
          else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = "\t";

          rows = lines.map(line => {
            const escapedValues: string[] = [];
            let currentVal = "";
            let insideQuotes = false;

            for (let j = 0; j < line.length; j++) {
              const char = line[j];
              if (char === '"' || char === "'") {
                insideQuotes = !insideQuotes;
              } else if (char === delimiter && !insideQuotes) {
                escapedValues.push(currentVal.trim().replace(/^["']|["']$/g, ""));
                currentVal = "";
              } else {
                currentVal += char;
              }
            }
            escapedValues.push(currentVal.trim().replace(/^["']|["']$/g, ""));
            return escapedValues;
          });
        }

        if (rows.length < 2) {
          throw new Error("O arquivo enviado não contém linhas de dados suficientes.");
        }

        const items = processParsedRows(rows);
        setParsedItems(items);
        setNotification({
          type: "success",
          msg: `Sucesso! Planilha lida com êxito. Identificamos ${items.length} ocorrências consolidadas prontas para importar.`
        });
      } catch (err: any) {
        console.error(err);
        setNotification({
          type: "error",
          msg: err.message || "Não foi possível carregar a planilha. Certifique-se de usar um arquivo CSV ou Excel válido."
        });
      } finally {
        setLoading(false);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Gera um ID de documento determinístico e estável a partir da dedupKey, para que
  // reimportar o mesmo hóspede/apartamento/dia sempre aponte para o MESMO documento
  // no Firestore, em vez de criar uma cópia nova a cada importação.
  const slugifyDedupKey = (key: string): string => {
    return key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 100);
  };

  // Mass batch integration with Firestore — com deduplicação inteligente contra
  // registros já existentes, para que reimportar o mesmo arquivo (ou um arquivo que
  // contenha hóspedes já cadastrados) nunca gere avaliações duplicadas.
  // IMPORTANTE: cada item é processado de forma INDEPENDENTE — se um item específico
  // falhar (ex: erro de leitura pontual), os demais continuam sendo importados
  // normalmente, em vez de travar a importação inteira.
  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;

    setImporting(true);
    setNotification(null);

    let totalSaved = 0;
    let totalMerged = 0;
    let totalFailed = 0;
    const batch = writeBatch(db);

    for (const item of parsedItems as (Partial<Occurrence> & { _dedupKey?: string })[]) {
      try {
        const { _dedupKey, ...cleanItem } = item;

        // Itens sem dedupKey (ex: planilhas genéricas sem identificação de hóspede)
        // são sempre gravados como registro novo, com ID aleatório como antes.
        if (!_dedupKey) {
          const docRef = doc(db, "occurrences", `occ_batch_${Date.now()}__${Math.floor(Math.random() * 1000000)}`);
          batch.set(docRef, {
            ...cleanItem,
            source: cleanItem.source || "resort",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          totalSaved++;
          continue;
        }

        const docId = `flexspot_${slugifyDedupKey(_dedupKey)}`;
        const docRef = doc(db, "occurrences", docId);
        const existingSnap = await getDoc(docRef);

        if (existingSnap.exists()) {
          // Já existe um registro para este hóspede/apartamento/dia: mescla as notas
          // calculando a MÉDIA entre o que já estava salvo e a nova resposta importada,
          // em vez de duplicar ou simplesmente sobrescrever.
          const existing = existingSnap.data() as Occurrence;
          const mergedRatings: Record<string, number> = {};
          const allKeys = new Set([
            ...Object.keys(existing.ratings || {}),
            ...Object.keys(cleanItem.ratings || {})
          ]);
          allKeys.forEach((k) => {
            const oldVal = (existing.ratings as any)?.[k];
            const newVal = (cleanItem.ratings as any)?.[k];
            const values = [oldVal, newVal].filter((v) => v !== undefined && v !== null) as number[];
            if (values.length > 0) {
              mergedRatings[k] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
            }
          });

          batch.set(docRef, {
            ...cleanItem,
            ratings: mergedRatings,
            observation: existing.observation?.includes("consolidada")
              ? existing.observation
              : limitStr(`${cleanItem.observation} (Consolidado com avaliação já existente para este hóspede/dia.)`, 5000),
            source: cleanItem.source || existing.source || "resort",
            createdAt: existing.createdAt,
            updatedAt: serverTimestamp()
          });
          totalMerged++;
        } else {
          batch.set(docRef, {
            ...cleanItem,
            source: cleanItem.source || "resort",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          totalSaved++;
        }
      } catch (itemErr) {
        // Um item específico falhou (ex: leitura de duplicidade deu erro pontual).
        // Registra a falha e CONTINUA com os próximos itens, em vez de abortar tudo.
        console.error("Falha ao processar item da importação, pulando este item:", item, itemErr);
        totalFailed++;
      }
    }

    try {
      await batch.commit();

      const parts = [];
      if (totalSaved > 0) parts.push(`${totalSaved} nova(s) avaliação(ões) salva(s)`);
      if (totalMerged > 0) parts.push(`${totalMerged} já existente(s) atualizada(s) por média (sem duplicar)`);
      if (totalFailed > 0) parts.push(`${totalFailed} item(ns) ignorado(s) por erro (veja o console)`);

      setNotification({
        type: totalFailed > 0 && totalSaved === 0 && totalMerged === 0 ? "error" : "success",
        msg: parts.length > 0
          ? `Importação concluída! ${parts.join(", ")}.`
          : "Nenhum item foi processado."
      });

      setTimeout(() => {
        onImportFinished();
      }, 1500);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, "occurrences/batch_import");
      setNotification({
        type: "error",
        msg: "Erro na gravação em lote. Verifique se possui permissões suficientes ou se excedeu o tamanho máximo."
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClear = () => {
    setParsedItems([]);
    setFileName("");
    setNotification(null);
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-6">
      <div id="csv-importer-container" className="bg-white rounded-2xl border border-luxury-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-luxury-100 pb-4">
            <div>
              <h3 className="text-base font-semibold font-display text-neutral-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brass-500" />
                <span>Importação Avançada de Planilha</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-1">Carregue dados legados ou relatórios externos em formato CSV</p>
            </div>
            
            <button
              onClick={handleDownloadTemplate}
              id="template-download-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-luxury-200 hover:bg-luxury-100 text-neutral-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              title="Baixar modelo de planilha CSV configurada"
            >
              <Download className="w-4 h-4 text-brass-500" />
              Baixar Modelo
            </button>
          </div>

          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3.5 rounded-xl text-xs font-medium ${
                notification.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {notification.msg}
            </motion.div>
          )}

          {/* File Dropping Zone */}
          {parsedItems.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              id="drag-drop-zone"
              className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                dragActive
                  ? "border-brass-500 bg-brass-500/5"
                  : "border-luxury-200 bg-luxury-50/50 hover:bg-luxury-50 hover:border-neutral-300"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-4 bg-white border border-luxury-200 rounded-2xl shadow-xs text-brass-500">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <p className="text-sm font-semibold text-neutral-700">Arrastar e soltar planilha do Flexspot (Excel/CSV) ou clique para navegar</p>
                <p className="text-xs text-neutral-400 mt-1">Carregue o arquivo diretamente do Flexspot (.xlsx ou .csv) ou use o nosso modelo</p>
              </div>

              <div className="flex flex-col gap-1 items-center mt-2 py-1.5 px-3 bg-white border border-luxury-200/50 rounded-lg text-[9px] font-mono text-neutral-500 text-center">
                <span className="font-bold text-neutral-600">FORMATOS RECONHECIDOS AUTOMATICAMENTE:</span>
                <span>• Exportação Flexspot: apartamento, data de resposta, pergunta, resposta, usuário</span>
                <span>• Modelo Padrão: data, reserva, apto, tipo de ocorrência, setor, observação</span>
              </div>
            </div>
          ) : (
            /* Preview list of Parsed items audit grid */
            <div className="space-y-4">
              <div className="flex items-center justify-between font-display">
                <div className="text-xs text-neutral-400 uppercase font-mono font-bold tracking-wide">
                  Arquivo: <span className="text-neutral-700 bg-luxury-100 px-2 py-0.5 rounded font-mono font-medium">{fileName}</span>
                </div>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider cursor-pointer"
                >
                  Excluir e resetar planilha
                </button>
              </div>

              <div id="preview-grid-scroller" className="border border-luxury-200 rounded-xl overflow-x-auto max-h-[300px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-luxury-100/50 border-b border-luxury-200 sticky top-0 font-bold text-neutral-600 z-10 font-display">
                    <tr>
                      <th className="py-2.5 px-3 w-24">Data Interpretada</th>
                      <th className="py-2.5 px-3 w-20">Apto</th>
                      <th className="py-2.5 px-3 w-24">Reserva</th>
                      <th className="py-2.5 px-3 w-28">Tipo</th>
                      <th className="py-2.5 px-3 w-28">Setor</th>
                      <th className="py-2.5 px-3">Observação de Entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => {
                      const isPositive = item.occurrenceType === "Feedback positivo";
                      return (
                        <tr key={idx} className="border-b border-luxury-200/60 align-middle hover:bg-luxury-50 transition-colors">
                          <td className="py-2 px-3 font-mono text-neutral-700 font-semibold">{item.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-neutral-800">{item.apartment}</td>
                          <td className="py-2 px-3 font-mono text-neutral-500">{item.bookingNumber}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              isPositive ? "bg-emerald-50 text-emerald-700 border border-emerald-200/40" : "bg-rose-50 text-rose-700 border border-rose-200/40"
                            }`}>
                              {item.occurrenceType}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-neutral-700 font-display">{item.sector}</td>
                          <td className="py-2 px-3 text-neutral-600 truncate max-w-xs font-sans" title={item.observation}>{item.observation}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-1.5 p-3.5 bg-neutral-50 rounded-xl text-neutral-500 border border-luxury-200 text-xs leading-normal">
                <HelpCircle className="w-4.5 h-4.5 shrink-0 text-brass-500" />
                <span>Por favor, faça uma rápida validação visual das ocorrências acima lidas da sua planilha antes de concluir. Clique em "Confirmar Importação" para lançar e persistir tudo na nuvem com segurança.</span>
              </div>
            </div>
          )}

          {/* Button controls */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-luxury-100">
            <button
              onClick={onCancel}
              disabled={importing}
              className="px-4 py-2 bg-luxury-100 hover:bg-luxury-200 text-neutral-650 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancelar
            </button>

            {parsedItems.length > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                id="confirm-batch-import-btn"
                className="inline-flex items-center gap-2 px-5 py-3 bg-luxury-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-75 cursor-pointer shadow-md"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-brass-500 animate-bounce" />
                )}
                {importing ? "Importando em Lote..." : `Confirmar Importação (${parsedItems.length})`}
              </button>
            )}
          </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        title="Resetar planilha"
        description="Esta ação não pode ser desfeita."
        message={
          <>
            A leitura atual do arquivo <strong>{fileName}</strong> será descartada. Nada ainda foi salvo na nuvem — isso apenas limpa a pré-visualização desta tela.
          </>
        }
        confirmLabel="Sim, excluir e resetar"
        loadingLabel="Excluindo..."
        onConfirm={handleClear}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
