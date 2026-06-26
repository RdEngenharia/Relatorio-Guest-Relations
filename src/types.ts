// Categorias de PONTUAÇÃO (escala 1-5) extraídas da pesquisa Flexspot.
// Mantidas separadas das informações gerais/qualitativas (ver GeneralInfo abaixo).
export interface Ratings {
  atendimentoGeral?: number | null;
  wifi?: number | null;
  boutique?: number | null;
  bebidas?: number | null;
  alimentacao?: number | null;
  areasSociais?: number | null;
  equipeLazer?: number | null;
  estruturaLazer?: number | null;
  parqueAventuras?: number | null;
  limpezaApartamento?: number | null;
  estruturaApartamento?: number | null;
  recepcao?: number | null;
  satisfacaoGeral?: number | null;
}

// Informações GERAIS/qualitativas da pesquisa (não são notas, não entram em médias).
export interface GeneralInfo {
  primeiraVez?: string | null; // "Sim" | "Não"
  comentariosGerais?: string | null;
}

export interface Occurrence {
  id: string;
  date: string; // YYYY-MM-DD
  bookingNumber: string;
  apartment: string;
  occurrenceType: string; // "Reclamação" | "Feedback positivo" | "Outro"
  sector: string; // "AeB" | "Estrutura" | "TI" | "Lazer" | "Manutenção" | "Governança" | "Recepção" | "All inclusive" | "Wifi" | "Programações" | "Outro"
  observation: string;
  source?: "resort" | "google" | "flexspot";
  ratings?: Ratings;
  generalInfo?: GeneralInfo;
  createdAt: any; // ServerTimestamp
  updatedAt: any; // ServerTimestamp
}

export interface SectorSummary {
  sector: string;
  quantity: number;
  description: string;
}

export interface SavedReport {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  sectorSummaries: string; // Serialized string array of SectorSummary
  createdAt: any; // ServerTimestamp
}
