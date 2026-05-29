import React, { useState, useRef } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { Occurrence } from "../types";
import { Upload, FileSpreadsheet, AlertTriangle, Check, RefreshCw, X, Download, HelpCircle, Sparkles, Globe } from "lucide-react";
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

  // Pure Client-side CSV/TSV parser with automatic Brazilian locale and format detection
  const processFile = (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setNotification(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        if (!text) {
          throw new Error("O arquivo está vazio.");
        }

        // Clean Byte-Order Mark (BOM) if present
        text = text.replace(/^\uFEFF/, "").trim();

        // Split lines cleanly handling windows-based line breaks (\r\n)
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 1) {
          throw new Error("O arquivo enviado não contém linhas de dados suficientes.");
        }

        // Auto detect delimiter between comma (,) and semicolon (;)
        const firstLine = lines[0];
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = semicolonCount >= commaCount ? ";" : ",";

        // Parse first line values
        const firstLineValues = firstLine.split(delimiter).map(v => {
          return v.replace(/^["']|["']$/g, "").trim();
        });

        // Map column indexes intelligently based on names in user screenshots
        let dateIdx = -1;
        let bookingIdx = -1;
        let aptIdx = -1;
        let typeIdx = -1;
        let sectorIdx = -1;
        let obsIdx = -1;

        firstLineValues.forEach((val, index) => {
          const cleanVal = val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          
          if (
            cleanVal === "data" || 
            cleanVal === "date" || 
            cleanVal === "dia" || 
            cleanVal.includes("data da") || 
            cleanVal.includes("data de")
          ) {
            dateIdx = index;
          } else if (
            cleanVal.includes("reserva") || 
            cleanVal.includes("booking") || 
            cleanVal.includes("nº") || 
            cleanVal.includes("no") || 
            cleanVal.includes("codigo") || 
            cleanVal === "cod" ||
            cleanVal === "num"
          ) {
            bookingIdx = index;
          } else if (
            cleanVal.includes("apto") || 
            cleanVal.includes("apartamento") || 
            cleanVal.includes("quarto") || 
            cleanVal.includes("room") || 
            cleanVal === "apt" ||
            cleanVal === "ap"
          ) {
            aptIdx = index;
          } else if (
            cleanVal.includes("tipo de ocorrencia") || 
            cleanVal.includes("tipo ocorr") || 
            cleanVal.includes("ocorrencia") || 
            cleanVal === "tipo" ||
            cleanVal === "classificacao"
          ) {
            typeIdx = index;
          } else if (
            cleanVal.includes("tipo de reclamacao") || 
            cleanVal.includes("reclamacao") || 
            cleanVal.includes("setor") || 
            cleanVal.includes("categoria") || 
            cleanVal === "area" ||
            cleanVal === "dep" ||
            cleanVal === "departamento"
          ) {
            sectorIdx = index;
          } else if (
            cleanVal.includes("observacao") || 
            cleanVal.includes("descricao") || 
            cleanVal === "obs" || 
            cleanVal.includes("relato") || 
            cleanVal.includes("texto") ||
            cleanVal === "detalhe" ||
            cleanVal === "comentario"
          ) {
            obsIdx = index;
          }
        });

        // Determine number of successfully matched critical headers
        const headerMatchCount = [dateIdx, bookingIdx, aptIdx, obsIdx].filter(idx => idx !== -1).length;
        let hasHeaderRow = true;

        if (headerMatchCount < 2) {
          // Fallback to standard template/spreadsheet index ordering:
          // Col 0: Data, Col 1: Reserva, Col 2: Apto, Col 3: Tipo, Col 4: Setor, Col 5: Observação
          dateIdx = 0;
          bookingIdx = 1;
          aptIdx = 2;
          typeIdx = 3;
          sectorIdx = 4;
          obsIdx = 5;

          // Detect if the very first row is actually a header row or just raw data.
          // If first item contains common header words, skip it.
          const firstColVal = (firstLineValues[0] || "").toLowerCase();
          if (
            firstColVal.includes("data") || 
            firstColVal.includes("date") || 
            firstColVal.includes("dia") || 
            firstColVal.includes("reserva") ||
            firstColVal.includes("booking") ||
            firstColVal.includes("apto")
          ) {
            hasHeaderRow = true;
          } else {
            hasHeaderRow = false; // It has NO header, first line is direct guest records!
          }
        }

        const items: Partial<Occurrence>[] = [];
        const startRowIndex = hasHeaderRow ? 1 : 0;

        for (let i = startRowIndex; i < lines.length; i++) {
          const line = lines[i];
          // Correctly parse values ignoring delimiters encapsulated in quotes
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

          if (escapedValues.length < 2) continue; // Skip malformed empty lines

          // Extract value safely with index checks
          const getVal = (idx: number) => (idx !== -1 && idx < escapedValues.length ? escapedValues[idx] : "");

          const rawDate = getVal(dateIdx);
          const bookingVal = getVal(bookingIdx) || "S/N";
          const apartmentVal = getVal(aptIdx) || "S/A";
          const typeVal = getVal(typeIdx) || "Reclamação";
          const sectorVal = getVal(sectorIdx) || "Outro";
          const obsVal = getVal(obsIdx) || "";

          // Clean observation
          if (!obsVal) continue; // Skip empty observations

          // Parse and normalize Portuguese textual date to unified standard ISO string date format (YYYY-MM-DD)
          let finalDateStr = new Date().toISOString().split("T")[0]; // Fallback to today
          if (rawDate) {
            const dateTrimmed = rawDate.toLowerCase().trim();
            // Case 1: Match 11/mai or 11 de mai
            const matchesAbbrev = dateTrimmed.match(/^(\d{1,2})[\/\s]de?[s\s]?([a-zçãõ]+)/);
            
            if (matchesAbbrev) {
              const dayNum = parseInt(matchesAbbrev[1], 10);
              const monthAbbrev = matchesAbbrev[2].slice(0, 3); // take first 3 chars
              const monthNum = PORTUGUESE_MONTHS[monthAbbrev] ?? PORTUGUESE_MONTHS[matchesAbbrev[2]] ?? 4; // default May
              
              // Use current system year (we have 2026 declared in ADDITONAL_METADATA)
              const parsedDate = new Date(2026, monthNum, dayNum);
              if (!isNaN(parsedDate.getTime())) {
                const off = parsedDate.getTimezoneOffset();
                const cleanLocal = new Date(parsedDate.getTime() - off * 60 * 1000);
                finalDateStr = cleanLocal.toISOString().split("T")[0];
              }
            } else {
              // Case 2: standard format parsing such as "DD/MM/YYYY" or "YYYY-MM-DD"
              const slashParts = dateTrimmed.split("/");
              if (slashParts.length >= 2) {
                const day = parseInt(slashParts[0], 10);
                const month = parseInt(slashParts[1], 10) - 1;
                const year = slashParts.length === 3 ? parseInt(slashParts[2], 10) : 2026;
                const parsedDate = new Date(year, month, day);
                if (!isNaN(parsedDate.getTime())) {
                  const off = parsedDate.getTimezoneOffset();
                  const cleanLocal = new Date(parsedDate.getTime() - off * 60 * 1000);
                  finalDateStr = cleanLocal.toISOString().split("T")[0];
                }
              } else {
                // Check if already is YYYY-MM-DD
                const isoMatch = dateTrimmed.match(/^\d{4}-\d{2}-\d{2}$/);
                if (isoMatch) {
                  finalDateStr = dateTrimmed;
                }
              }
            }
          }

          items.push({
            date: finalDateStr,
            bookingNumber: bookingVal,
            apartment: apartmentVal,
            occurrenceType: typeVal.charAt(0).toUpperCase() + typeVal.slice(1).toLowerCase() === "feedback positivo" ? "Feedback positivo" : (typeVal.charAt(0).toUpperCase() + typeVal.slice(1).toLowerCase() === "outro" ? "Outro" : "Reclamação"),
            sector: sectorVal,
            observation: obsVal
          });
        }

        if (items.length === 0) {
          throw new Error("Nenhum registro válido foi encontrado na planilha lida.");
        }

        setParsedItems(items);
        setNotification({
          type: "success",
          msg: `Sucesso! Planilha lida com êxito. Identificamos ${items.length} ocorrências prontas para importar.`
        });
      } catch (err: any) {
        console.error(err);
        setNotification({
          type: "error",
          msg: err.message || "Não foi possível carregar planilha. Certifique-se de usar arquivo CSV separado por vírgula ou ponto e vírgula."
        });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
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
          batch.set(docRef, {
            ...item,
            source: "resort",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
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
            accept=".csv,text/csv,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 bg-white border border-luxury-200 rounded-2xl shadow-xs text-brass-500">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <p className="text-sm font-semibold text-neutral-700">Arrastar e soltar arquivo excel/CSV ou clique para navegar</p>
            <p className="text-xs text-neutral-400 mt-1">Suporta arquivos .csv delimitados por vírgula ( , ) ou ponto e vírgula ( ; )</p>
          </div>

          <div className="flex items-center gap-2 mt-2 py-1 px-3 bg-white border border-luxury-200/50 rounded-lg text-[10px] font-mono text-neutral-500">
            <span>DATA • Nº RESERVA • APTO • TIPO DE OCORRÊNCIA • TIPO DE RECLAMAÇÃO • OBSERVAÇÃO</span>
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
  );
}
