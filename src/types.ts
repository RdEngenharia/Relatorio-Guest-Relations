export interface Occurrence {
  id: string;
  date: string; // YYYY-MM-DD
  bookingNumber: string;
  apartment: string;
  occurrenceType: string; // "Reclamação" | "Feedback positivo" | "Outro"
  sector: string; // "AeB" | "Estrutura" | "TI" | "Lazer" | "Manutenção" | "Governança" | "Recepção" | "All inclusive" | "Wifi" | "Programações" | "Outro"
  observation: string;
  source?: "resort" | "google" | "flexspot";
  ratings?: {
    wifi?: number | null;
    alimentacao?: number | null;
    atendimento?: number | null;
    limpeza?: number | null;
  };
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
