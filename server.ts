import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

dotenv.config();

const app = express();
const PORT = 3000;

// Read Firebase config safely from file system
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Initialize Google GenAI on the server with User-Agent required header
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

// API: Auto-Categorize text input
app.post("/api/gemini/categorize", async (req, res) => {
  try {
    const { observation } = req.body;
    if (!observation || typeof observation !== "string") {
      return res.status(400).json({ error: "Campo 'observation' inválido ou ausente." });
    }

    if (!apiKey) {
      // Graceful fallback if API key is not set up yet
      return res.json({
        occurrenceType: "Reclamação",
        sector: "AeB"
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analise a seguinte observação de um hóspede em um resort/hotel e classifique-a.
A observação é: "${observation}"

Determine o Tipo de Ocorrência dentre as opções exclusivas:
- "Reclamação"
- "Feedback positivo"
- "Outro"

Determine também o Setor (Tipo de Reclamação) dentre as opções exclusivas:
- "AeB" (Alimentos e Bebidas / Restaurantes / Bares)
- "Estrutura" (Quartos antigos, rachaduras, escadas, piscinas ruins, etc.)
- "TI" (Falta de wifi, TV que não conecta, etc.)
- "Lazer" (Falta de música, recreação, etc.)
- "Manutenção" (Ar condicionado pingando, torneiras, vazamentos, fechadura quebrada, etc.)
- "Governança" (Limpeza do quarto, falta de toalhas, etc.)
- "Recepção" (Atendimento da recepção, problemas no check-in/check-out)
- "All inclusive" (Regras de inclusão de bebidas/comidas, pagamentos extras)
- "Wifi" (Conectividade oscilando)
- "Programações" (Música ao vivo, atrações fora de hora, etc.)

Forneça sua resposta rigorosamente no formato de JSON estruturado.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            occurrenceType: {
              type: Type.STRING,
              description: "O tipo de ocorrência. Deve ser rigorosamente 'Reclamação', 'Feedback positivo' ou 'Outro'."
            },
            sector: {
              type: Type.STRING,
              description: "O setor envolvido. Deve ser rigorosamente 'AeB', 'Estrutura', 'TI', 'Lazer', 'Manutenção', 'Governança', 'Recepção', 'All inclusive', 'Wifi' ou 'Programações'."
            }
          },
          required: ["occurrenceType", "sector"]
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    res.json(result);
  } catch (error) {
    console.error("Erro ao categorizar:", error);
    res.status(500).json({
      error: "Falha na análise inteligente.",
      occurrenceType: "Reclamação",
      sector: "AeB"
    });
  }
});

// API: Aggregations and Qualitative Summary report generator
app.post("/api/gemini/summarize", async (req, res) => {
  try {
    const { occurrences, title } = req.body;
    if (!occurrences || !Array.isArray(occurrences)) {
      return res.status(400).json({ error: "Dados de ocorrências inválidos." });
    }

    if (!apiKey) {
      return res.status(401).json({ error: "Configuração do GEMINI_API_KEY ausente nas credenciais." });
    }

    // Prepare system prompt for professional hospitality report compilation
    const prompt = `Você é um analista experiente em Gestão de Relacionamento de Hóspedes (Guest Relations) de um resort de luxo.
O usuário enviará uma lista de ocorrências registradas no período do relatório "${title || 'Relatório de Ocorrências'}".
Seu objetivo é analisar as reclamações e feedbacks de cada categoria/setor e compilar um parágrafo de resumo qualitativo ultra profissional para cada categoria encontrada.

Formatos desejados das descrições qualitativas (siga o tom profissional dos relatórios de hotelaria):
- "AeB": "As reclamações concentram-se na falta recorrente de bebidas e itens (como espumante no clube de praia, Heineken no resort, água de coco, picolé, chá e frutas), além de problemas de qualidade com bebidas servidas quentes..."
- "Estrutura": "As queixas concentram-se na infraestrutura com destaque para apartamentos antigos, umidade, com mofo e desgaste de móveis..."
Utilize sempre a língua portuguesa do Brasil (PT-BR). Seja conciso, analítico e profissional.

Aqui estão os dados das ocorrências:
${JSON.stringify(occurrences, null, 2)}

Agrupe as Ocorrências por Setor de Reclamação ("sector"). Para cada setor que possua pelo menos uma ocorrência do tipo "Reclamação", escreva um parágrafo que resume a essência qualitativa dessas reclamações. Ignorar categorias vazias ou compilar "Feedback positivo" de forma construtiva em um setor específico se fizer sentido.

Forneça o resultado rigorosamente em formato JSON estruturado com a contagem exata e a descrição compilada por setor.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sector: { type: Type.STRING, description: "O setor analisado (ex: AeB, Estrutura, TI...)" },
              quantity: { type: Type.INTEGER, description: "Número total de ocorrências neste setor no período atual." },
              description: { type: Type.STRING, description: "Parágrafo sumário qualitativo e analítico em português das ocorrências/queixas registradas neste setor." }
            },
            required: ["sector", "quantity", "description"]
          }
        }
      }
    });

    const text = response.text || "[]";
    const result = JSON.parse(text.trim());
    res.json({ sectorSummaries: result });
  } catch (error) {
    console.error("Erro ao resumir período:", error);
    res.status(500).json({ error: "Não foi possível gerar a síntese com Inteligência Artificial." });
  }
});

// Endpoint to parse copy-pasted text/data from Flexspot surveys list using Gemini AI
app.post("/api/parse-pasted-text", async (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== "string") {
      return res.status(400).json({ error: "O texto bruto está vazio ou é inválido." });
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Chave do Gemini API não configurada no servidor." });
    }

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const prompt = `Você é um robô auxiliar de recepção hoteleira focado em extrair dados do sistema Flexspot.
Abaixo está um bloco de texto bruto que o usuário copiou diretamente da tela de listagem de feedbacks/cadastros/surveys ou de uma exportação de dados do portal Flexspot.
Esse texto pode conter várias avaliações misturadas com nomes de clientes, e-mails, notas, comentários ou cabeçalhos.

TEXTO BRUTO COPIADO DO FLEXSPOT:
"""
${rawText}
"""

Analise cuidadosamente este texto. Sua missão é identificar todas as avaliações e comentários de hóspedes contidos nele e extrair uma lista estruturada de avaliações.

ATENÇÃO CRÍTICA PARA FORMATOS DE EXPORTAÇÃO TABULARES (TABULAÇÕES/PLANILHA COPIADA):
O texto pode vir no formato de planilha com colunas separadas por tabulações (TSV) ou espaços, contendo linhas como:
"apartamento	data de resposta	email	nome da pesquisa	pergunta	resposta	usuário"
Neste formato tabular, cada resposta a uma pergunta individual gera uma linha diferente. Portanto, um mesmo hóspede (mesmo apartamento, mesma data/hora aproximada de resposta, e mesmo nome do usuário/hóspede) terá VÁRIAS LINHAS no texto bruto.
Você DEVE OBRIGATORIAMENTE AGRUPAR todas as linhas pertencentes à mesma sessão de resposta do hóspede em uma única avaliação consolidada!

Regras de Consolidação e Processamento:
1. Agrupamento: Identifique as linhas que possuem o mesmo "apartamento", "usuário" e "data de resposta" (ou data de resposta no mesmo dia e minuto) e agrupe-as em um único objeto de avaliação.
2. Mapeamento de Notas (Ratings):
   - Perguntas contendo "internet/wifi", "wi-fi", "wifi", "conexão" -> mapear o número correspondente da resposta para "ratings.wifi".
   - Perguntas contendo "alimentação", "alimentos", "bebidas", "comida", "restaurante" -> mapear o número correspondente da resposta para "ratings.alimentacao".
   - Perguntas contendo "recepção", "atendimento geral", "serviço", "equipe" -> mapear o número correspondente da resposta para "ratings.atendimento".
   - Perguntas contendo "limpeza do apartamento", "limpeza de quarto", "conservação e limpeza" -> mapear o número correspondente da resposta para "ratings.limpeza".
3. ESCALA DE NOTAS (Conversão de 1 a 5 para 1 a 10):
   Se as notas originais do sistema Flexspot estiverem na escala de 1 a 5 (por exemplo: "5", "4", "3", "2", "1"), converta-as obrigatoriamente para a escala de 1 a 10 multiplicando-as por 2 (ex: nota 5 vira 10, nota 4 vira 8, nota 3 vira 6, nota 2 vira 4, nota 1 vira 2). Se a nota já estiver em escala de 1 a 10, mantenha o valor original.
4. "observation" (Comentário do Hóspede):
   - Se houver uma linha de pergunta do tipo "Comentários gerais" ou "Comentários adicionais", utilize o texto da resposta como a observação principal.
   - Se não houver nenhum comentário de texto, gere uma observação sumarizada elegante em português com base nas notas consolidadas, por exemplo: "Pesquisa respondida pelo hóspede (Notas gerais excelentes)." ou "Avaliação regular com pontos de atenção coletados."
5. "occurrenceType": Classifique estritamente como "Reclamação" se houver alguma nota de setor consolidada que seja menor que 6/10 (ou menor que 3/5 na escala original) ou se a observação contiver reclamações explícitas. Caso contrário, use "Feedback positivo".
6. "sector": Escolha o setor principal com base na menor nota ou principal reclamação: "AeB", "Estrutura", "TI", "Lazer", "Manutenção", "Governança", "Recepção", "All inclusive", "Wifi" ou "Outro".
7. "date": A data da avaliação formatada em "YYYY-MM-DD". Se o formato na planilha for "DD/MM/YY HH:MM" (ex: "26/06/26 09:38"), converta para "2026-06-26". Se não houver data, use "${today}".

Retorne rigorosamente um array JSON contendo esses objetos estruturados em conformidade com o esquema fornecido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              bookingNumber: { type: Type.STRING },
              apartment: { type: Type.STRING },
              occurrenceType: { type: Type.STRING },
              sector: { type: Type.STRING },
              observation: { type: Type.STRING },
              ratings: {
                type: Type.OBJECT,
                properties: {
                  wifi: { type: Type.INTEGER },
                  alimentacao: { type: Type.INTEGER },
                  atendimento: { type: Type.INTEGER },
                  limpeza: { type: Type.INTEGER }
                }
              }
            },
            required: ["date", "bookingNumber", "apartment", "occurrenceType", "sector", "observation"]
          }
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "[]");
    res.json({ success: true, items: parsedJson });
  } catch (error: any) {
    console.error("Erro ao analisar texto colado do Flexspot:", error);
    res.status(500).json({ error: error.message || "Erro desconhecido ao processar o texto com Gemini AI." });
  }
});

// Setup Vite Dev server or production static serving
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  configureServer();
}

export default app;
