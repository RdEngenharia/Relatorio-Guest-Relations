import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { Occurrence } from "../types";
import { 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  X, 
  Download, 
  HelpCircle, 
  Sparkles, 
  Globe,
  Copy,
  Send,
  Terminal,
  Activity
} from "lucide-react";
import { motion } from "motion/react";

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

export default function CsvImporter({ onImportFinished, onCancel }: CsvImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<Partial<Occurrence>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [seeding, setSeeding] = useState(false);
  const [importMode, setImportMode] = useState<"csv" | "copypaste">("copypaste"); // Default to copypaste for immediate utility

  // States for copy-pasting raw text from Flexspot
  const [pastedText, setPastedText] = useState("");
  const [parsingText, setParsingText] = useState(false);
  const [parsedPastedItems, setParsedPastedItems] = useState<any[]>([]);
  const [savingPastedItems, setSavingPastedItems] = useState(false);

  const handleParsePastedText = async () => {
    if (!pastedText.trim()) {
      setNotification({ type: "error", msg: "Por favor, selecione e cole o texto contendo as avaliações da tela do seu portal Flexspot." });
      return;
    }

    setParsingText(true);
    setNotification(null);
    setParsedPastedItems([]);

    try {
      const response = await fetch("/api/parse-pasted-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pastedText })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setParsedPastedItems(data.items);
        if (data.items.length === 0) {
          setNotification({ type: "error", msg: "Não identificamos nenhuma avaliação nesse bloco de texto. Experimente selecionar mais texto da sua listagem do Flexspot." });
        } else {
          setNotification({ type: "success", msg: `Sucesso! O Gemini interpretou as informações e encontrou ${data.items.length} avaliações prontas para importação.` });
        }
      } else {
        setNotification({ type: "error", msg: data.error || "Erro ao processar o texto no servidor." });
      }
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Falha de rede ao tentar se conectar ao processador inteligente." });
    } finally {
      setParsingText(false);
    }
  };

  const handleSavePastedItems = async () => {
    if (parsedPastedItems.length === 0) return;

    setSavingPastedItems(true);
    setNotification(null);

    try {
      const batch = writeBatch(db);

      parsedPastedItems.forEach((item) => {
        const docRef = doc(db, "occurrences", `flexspot_paste_${Date.now()}__${Math.floor(Math.random() * 1000000)}`);
        const payload: any = {
          date: item.date,
          bookingNumber: item.bookingNumber,
          apartment: item.apartment,
          occurrenceType: item.occurrenceType,
          sector: item.sector,
          observation: item.observation,
          source: "flexspot",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (item.ratings) {
          payload.ratings = item.ratings;
        }
        batch.set(docRef, payload);
      });

      await batch.commit();

      setNotification({
        type: "success",
        msg: `Sucesso absoluto! ${parsedPastedItems.length} avaliações do portal Flexspot foram importadas com sucesso.`
      });

      setPastedText("");
      setParsedPastedItems([]);

      setTimeout(() => {
        onImportFinished();
      }, 1500);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, "occurrences/pasted_import");
      setNotification({
        type: "error",
        msg: "Erro na gravação em lote no Firestore. Verifique suas conexões e tente novamente."
      });
    } finally {
      setSavingPastedItems(false);
    }
  };



  const handleSeedGoogleTestData = async () => {
    setSeeding(true);
    setNotification(null);
    try {
      const batch = writeBatch(db);
      const googleFictionalData: Partial<Occurrence>[] = [
        {
          date: "2026-05-25",
          bookingNumber: "S/R",
          apartment: "S/A",
          occurrenceType: "Reclamação",
          sector: "Wifi",
          observation: "A internet wifi nas dependências comuns do resort e no bangalô estava extremamente lenta. Quase impossível trabalhar de home office ou assistir a um vídeo simples. Para o nível de luxo ofertado, a conexão de fibra deveria ser impecável.",
          source: "google"
        },
        {
          date: "2026-05-26",
          bookingNumber: "S/R",
          apartment: "S/A",
          occurrenceType: "Reclamação",
          sector: "AeB",
          observation: "Ficamos muito desapontados com as opções do buffet do restaurante principal. A reposição de pratos nobres demorou muito, as filas para a grelha de carnes ultrapassavam 15 minutos e os sucos servidos no café da manhã pareciam artificiais.",
          source: "google"
        },
        {
          date: "2026-05-27",
          bookingNumber: "S/R",
          apartment: "S/A",
          occurrenceType: "Reclamação",
          sector: "Lazer",
          observation: "Monitores da equipe de recreação infantil parecem sobrecarregados e dispersos. No clube infantil, deixaram menores de idade saírem sozinhos em direção à piscina grande sem que nenhum adulto percebesse. Falta de atenção inadmissível!",
          source: "google"
        },
        {
          date: "2026-05-28",
          bookingNumber: "S/R",
          apartment: "S/A",
          occurrenceType: "Reclamação",
          sector: "Manutenção",
          observation: "O ar-condicionado do quarto estava pingando água no chão e emitindo um ruído metálico ensurdecedor a noite inteira. Abrimos chamado às 20h e até o momento do checkout ninguém compareceu para consertar.",
          source: "google"
        }
      ];

      googleFictionalData.forEach((item) => {
        const id = `occ_google_seed_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        const docRef = doc(db, "occurrences", id);
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      setNotification({
        type: "success",
        msg: "Sucesso! Semeamos as 4 reclamações de teste do Google na nuvem. Você já pode visualizá-las no Histórico (Folha Google) e usá-las para testar a compilação com IA."
      });
      setTimeout(() => {
        onImportFinished();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setNotification({
        type: "error",
        msg: "Erro ao gerar base de testes rápidos do Google no Firestore."
      });
    } finally {
      setSeeding(false);
    }
  };

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
    const dateIdx = headers.findIndex(h => h.includes("data de resposta") || h.includes("data resposta") || h === "data" || h === "date" || h.includes("resposta"));
    const emailIdx = headers.findIndex(h => h === "email" || h === "e-mail");
    const surveyNameIdx = headers.findIndex(h => h.includes("nome da pesquisa") || h.includes("pesquisa"));
    const questionIdx = headers.findIndex(h => h === "pergunta" || h.includes("pergunta"));
    const answerIdx = headers.findIndex(h => h === "resposta" || h.includes("resposta") || h === "valor" || h === "nota");
    const userIdx = headers.findIndex(h => h === "usuario" || h === "nome" || h === "cliente" || h === "hospede" || h === "user");
    const bookingIdx = headers.findIndex(h => h.includes("reserva") || h.includes("booking") || h.includes("nº") || h.includes("no") || h.includes("codigo") || h === "cod" || h === "num");
    const sectorIdx = headers.findIndex(h => h.includes("tipo de reclamacao") || h.includes("reclamacao") || h.includes("setor") || h.includes("categoria") || h === "area" || h === "dep" || h === "departamento");
    const obsIdx = headers.findIndex(h => h.includes("observacao") || h.includes("descricao") || h === "obs" || h.includes("relato") || h.includes("texto") || h === "detalhe" || h.includes("comentario") || h.includes("comentário"));

    const limitStr = (val: any, max: number): string => {
      if (val === null || val === undefined) return "";
      const s = String(val).trim();
      return s.length > max ? s.substring(0, max) : s;
    };

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
        const userName = getVal(userIdx) || "Hóspede Flexspot";

        if (!apartment && !question) continue;

        // Group by apartment + userName + date + hour to keep questions from the same survey session together
        // (questions within one survey are answered across different minutes but same hour),
        // while still separating two different surveys filled on the same day at different hours.
        const dateHourKey = dateStr.trim().split(":")[0]; // e.g. "26/06/26 10" from "26/06/26 10:26"
        const key = `${apartment.toLowerCase()}|||${userName.toLowerCase()}|||${dateHourKey.toLowerCase()}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push({
          apartment,
          dateStr,
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

      Object.keys(groups).forEach(key => {
        const groupRows = groups[key];
        if (groupRows.length === 0) return;

        const firstRow = groupRows[0];
        
        let wifi: number | undefined = undefined;
        let alimentacao: number | undefined = undefined;
        let atendimento: number | undefined = undefined;
        let limpeza: number | undefined = undefined;
        let commentText = "";

        groupRows.forEach(r => {
          const qClean = cleanHeader(r.question);
          const ans = r.answer;

          // Multi-word checks to grab any matching survey question variants
          if (qClean.includes("internet") || qClean.includes("wifi") || qClean.includes("wi-fi") || qClean.includes("conexao")) {
            const score = parseRatingValue(ans);
            if (score !== undefined) wifi = score;
          } else if (qClean.includes("alimentacao") || qClean.includes("bebidas") || qClean.includes("comida") || qClean.includes("restaurante")) {
            const score = parseRatingValue(ans);
            if (score !== undefined) alimentacao = score;
          } else if (qClean.includes("recepcao") || qClean.includes("atendimento geral") || qClean.includes("servico") || qClean.includes("equipe") || qClean.includes("atendimento")) {
            const score = parseRatingValue(ans);
            if (score !== undefined) atendimento = score;
          } else if (qClean.includes("limpeza") || qClean.includes("conservacao") || qClean.includes("arrumacao") || qClean.includes("governanca")) {
            const score = parseRatingValue(ans);
            if (score !== undefined) limpeza = score;
          }

          if (qClean.includes("comentarios gerais") || qClean.includes("comentario") || qClean.includes("sugestao") || qClean.includes("observacao") || qClean.includes("comentário")) {
            if (ans && ans.toLowerCase() !== "sem comentarios adicionais" && ans.toLowerCase() !== "sem comentarios" && ans.toLowerCase() !== "bom" && ans.trim()) {
              commentText = ans.trim();
            }
          }
        });

        const finalDate = parseFlexspotDate(firstRow.dateStr);
        const apartment = firstRow.apartment || "N/A";
        const userName = firstRow.userName || "Hóspede";

        if (!commentText) {
          commentText = `Pesquisa de satisfação preenchida por ${userName} (Quarto ${apartment}).`;
        }

        // Determine main sector of interest (choose lowest score)
        let sector = "Recepção";
        let minScore = 11;
        if (wifi !== undefined && wifi < minScore) { minScore = wifi; sector = "Wifi"; }
        if (alimentacao !== undefined && alimentacao < minScore) { minScore = alimentacao; sector = "AeB"; }
        if (atendimento !== undefined && atendimento < minScore) { minScore = atendimento; sector = "Recepção"; }
        if (limpeza !== undefined && limpeza < minScore) { minScore = limpeza; sector = "Governança"; }

        // Only overwrite to "Recepção" if ALL provided scores are identical AND excellent (>= 4)
        const activeScores = [wifi, alimentacao, atendimento, limpeza].filter(s => s !== undefined) as number[];
        const allIdenticalAndHigh = activeScores.length > 0 && 
                                    activeScores.every(s => s === activeScores[0]) && 
                                    activeScores[0] >= 4;
        if (allIdenticalAndHigh) {
          sector = "Recepção";
        }

        // Determine occurrence status
        let occurrenceType = "Feedback positivo";
        if (minScore <= 3) {
          occurrenceType = "Reclamação";
        }

        const occurrence: Partial<Occurrence> = {
          date: limitStr(finalDate, 32),
          bookingNumber: limitStr(`FLEXSPOT-${apartment}-${Math.floor(1000 + Math.random() * 9000)}`, 32),
          apartment: limitStr(apartment, 32),
          occurrenceType: limitStr(occurrenceType, 128),
          sector: limitStr(sector, 128),
          observation: limitStr(commentText, 5000),
          source: "flexspot"
        };

        if (wifi !== undefined || alimentacao !== undefined || atendimento !== undefined || limpeza !== undefined) {
          occurrence.ratings = {
            wifi: wifi ?? null,
            alimentacao: alimentacao ?? null,
            atendimento: atendimento ?? null,
            limpeza: limpeza ?? null
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
            atendimento: serviceVal,
            limpeza: cleanVal
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

  // Mass batch integration with Firestore to satisfy performance guidelines
  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;

    setImporting(true);
    setNotification(null);

    try {
      // Chunk batch operations of Firestore (maximum 500 writes per batch size)
      const maxBatchSize = 400;
      let totalSaved = 0;

      for (let i = 0; i < parsedItems.length; i += maxBatchSize) {
        const batch = writeBatch(db);
        const chunk = parsedItems.slice(i, i + maxBatchSize);

        chunk.forEach((item) => {
          const docRef = doc(db, "occurrences", `occ_batch_${Date.now()}__${Math.floor(Math.random() * 1000000)}`);
          const rawData = {
            ...item,
            source: item.source || "resort",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          console.log("GRAVANDO EM LOTE NO FIRESTORE - PAYLOAD:", JSON.stringify(rawData, (key, value) => {
            // handle serverTimestamp serialization in JSON.stringify output gracefully
            if (value && typeof value === "object" && value.constructor && value.constructor.name === "FieldValue") {
              return "[FieldValue.serverTimestamp]";
            }
            return value;
          }, 2));
          batch.set(docRef, rawData);
        });

        await batch.commit();
        totalSaved += chunk.length;
      }

      setNotification({
        type: "success",
        msg: `Importação em lote concluída com sucesso! ${totalSaved} ocorrências foram salvas no console.`
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
  };

  return (
    <div className="space-y-6">
      {/* Mode Selector Tab Bar */}
      <div className="flex bg-white p-1 rounded-2xl border border-luxury-200 shadow-sm max-w-md mx-auto print:hidden">
        <button
          onClick={() => {
            setImportMode("copypaste");
            setNotification(null);
          }}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none ${
            importMode === "copypaste"
              ? "bg-luxury-800 text-white shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 hover:bg-luxury-50"
          }`}
        >
          <Copy className="w-4 h-4 text-brass-500" />
          Importar Copiando do Flexspot (IA)
        </button>
        <button
          onClick={() => {
            setImportMode("csv");
            setNotification(null);
          }}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none ${
            importMode === "csv"
              ? "bg-luxury-800 text-white shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 hover:bg-luxury-50"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-neutral-400" />
          Planilha CSV
        </button>
      </div>

      {importMode === "copypaste" && (
        <div id="copypaste-importer-container" className="bg-white rounded-2xl border border-luxury-200 shadow-sm p-6 space-y-6">
          <div className="border-b border-luxury-100 pb-4">
            <h3 className="text-base font-semibold font-display text-neutral-800 flex items-center gap-2">
              <Copy className="w-5 h-5 text-brass-500" />
              <span>Importação por Cópia do Portal Flexspot (Inteligência Artificial)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Como o Flexspot não possui um botão físico para exportar as avaliações antigas, você pode simplesmente <strong>copiar o texto da tela</strong> (com Ctrl+A / Ctrl+C ou selecionando as linhas) e colar aqui. Nosso processador inteligente com Gemini AI irá ler, estruturar e salvar as avaliações automaticamente!
            </p>
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

          <div className="space-y-3">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Cole aqui o conteúdo copiado do Flexspot:
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Exemplo de conteúdo para colar:
Felipe Costa - Quarto 104
Nota Wi-Fi: 2 - Sinal muito fraco na varanda, impossível navegar.

Paula Lima - Quarto 202
Nota Limpeza: 5 - Encontramos toalhas manchadas no banheiro hoje cedo."
              className="w-full h-48 p-4 text-xs font-mono border border-luxury-200 rounded-2xl focus:ring-1 focus:ring-brass-500 focus:border-brass-500 outline-none resize-y bg-neutral-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleParsePastedText}
              disabled={parsingText || !pastedText.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-luxury-800 hover:bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {parsingText ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gemini Analisando Textos...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-brass-400" />
                  Processar e Ler com Gemini AI
                </>
              )}
            </button>

            {parsedPastedItems.length > 0 && (
              <button
                onClick={handleSavePastedItems}
                disabled={savingPastedItems}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md animate-pulse"
              >
                {savingPastedItems ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvando Ocorrências...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    Confirmar e Gravar {parsedPastedItems.length} Avaliações
                  </>
                )}
              </button>
            )}
          </div>

          {parsedPastedItems.length > 0 && (
            <div className="border-t border-luxury-100 pt-5 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Resultados da Leitura da IA:</span>
              </h4>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {parsedPastedItems.map((item, idx) => (
                  <div key={idx} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-neutral-800 text-white rounded-md text-[9px] font-mono font-bold uppercase">
                          Quarto {item.apartment}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                          item.occurrenceType === "Reclamação" ? "bg-rose-50 border border-rose-100 text-rose-700" : "bg-emerald-50 border border-emerald-100 text-emerald-700"
                        }`}>
                          {item.occurrenceType}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase">
                          Setor: {item.sector}
                        </span>
                      </div>
                      <p className="text-neutral-700 italic font-sans leading-relaxed">"{item.observation}"</p>
                    </div>

                    {item.ratings && Object.keys(item.ratings).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        {item.ratings.wifi !== undefined && (
                          <span className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-[10px] font-mono">
                            Wi-Fi: <strong>{item.ratings.wifi}</strong>
                          </span>
                        )}
                        {item.ratings.alimentacao !== undefined && (
                          <span className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-[10px] font-mono">
                            Comida: <strong>{item.ratings.alimentacao}</strong>
                          </span>
                        )}
                        {item.ratings.atendimento !== undefined && (
                          <span className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-[10px] font-mono">
                            Serviço: <strong>{item.ratings.atendimento}</strong>
                          </span>
                        )}
                        {item.ratings.limpeza !== undefined && (
                          <span className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-[10px] font-mono">
                            Limpeza: <strong>{item.ratings.limpeza}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {importMode === "csv" && (
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

          {/* Quick Test Seeder Tool requested by the user */}
          {parsedItems.length === 0 && (
            <div id="test-seeder-banner" className="bg-brass-500/10 border border-brass-200/50 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-neutral-850 flex items-center gap-1.5 font-display uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-brass-600 animate-pulse" />
                  <span>Massa de Teste Rápida (4 Avaliações do Google)</span>
                </h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Insira instantaneamente as <strong>4 reclamações do Google para testes rápidos</strong> de gráficos segregados, filtros e compilação de relatórios com IA.
                </p>
              </div>
              <button
                onClick={handleSeedGoogleTestData}
                disabled={seeding}
                className="px-4 py-2.5 bg-luxury-800 hover:bg-neutral-950 active:scale-[0.98] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center gap-2 border border-luxury-900 shadow-sm"
              >
                <Globe className="w-4 h-4 text-brass-500" />
                {seeding ? "Criando Registros..." : "Gerar 4 Reclamações de Teste"}
              </button>
            </div>
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
                  onClick={handleClear}
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
      )}
    </div>
  );
}
