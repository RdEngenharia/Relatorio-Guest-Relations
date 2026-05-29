import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Setup Vite Dev server or production static serving
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
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

configureServer();
