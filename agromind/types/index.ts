import type {
  Farm,
  Lot,
  Crop,
  ProductionCycle,
  Input,
  LaborRecord,
  WeatherLog,
  Alert,
  User,
  EstadoFenologico,
  DestinoProduccion,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
} from "@prisma/client";

// Re-export Prisma enums
export type {
  EstadoFenologico,
  DestinoProduccion,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
};

// ─── Tipos compuestos (include relations) ───

export type FarmWithLots = Farm & {
  lots: (Lot & {
    crops: (Crop & {
      productionCycles: ProductionCycle[];
    })[];
  })[];
};

export type CycleWithRelations = ProductionCycle & {
  crop: Crop & {
    lot: Lot & {
      farm: Farm;
    };
  };
  inputs: Input[];
  laborRecords: LaborRecord[];
};

export type AlertWithFarm = Alert & {
  farm: Pick<Farm, "id" | "name" | "commune">;
};

// ─── Payloads de API ───

export interface WeatherCurrent {
  tempC: number;
  precipMm: number;
  windSpeedKmh: number;
  windDirection: number;
  humidity: number;
  solarRadiation: number;
  weatherCode: number; // WMO code
  isDay: number;
}

export interface WeatherForecastDay {
  date: string; // ISO date
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  precipProb: number; // %
  windSpeedMaxKmh: number;
  weatherCode: number;
  etMm: number;
  // Riesgo calculado para cerezos
  riesgoHelada: boolean;
  riesgoLluvia: boolean;
  riesgoCalor: boolean;
}

export interface WeatherResponse {
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  // Horas frío acumuladas en el historial reciente
  horasFrioAcumuladasPeriodo?: number;
}

// ─── Payload del agente IA ───

export interface AiReportRequest {
  farmId: string;
  cycleId: string;
  reportType: "weekly" | "risk" | "harvest";
}

export interface AiReportResponse {
  reportType: AiReportRequest["reportType"];
  generatedAt: string;
  content: string; // markdown del reporte
  alerts: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    recommendation: string;
  }[];
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Tipos de formularios ───

export interface CreateFarmInput {
  name: string;
  address: string;
  region: string;
  commune: string;
  latitude: number;
  longitude: number;
  totalArea: number;
}

export interface CreateLotInput {
  farmId: string;
  name: string;
  area: number;
  soilType?: string;
  slopePerc?: number;
}

export interface CreateCycleInput {
  cropId: string;
  season: string;
  startDate: string;
  estadoFenologico: EstadoFenologico;
  horasFrioAcumuladas: number;
  destinoProduccion: DestinoProduccion;
  calibreEstimado?: number;
  rendimientoEstimado?: number;
  fechaCosechaEstimada?: string;
  notas?: string;
}

export interface CreateInputRecord {
  productionCycleId: string;
  date: string;
  category: InputCategory;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  notes?: string;
}

export interface CreateLaborRecordInput {
  productionCycleId: string;
  date: string;
  activity: LaborActivity;
  workerCount: number;
  hoursPerWorker: number;
  costPerHour: number;
  notes?: string;
}

// ─── Resumen financiero del ciclo ───

export interface CycleCostSummary {
  totalInputsCost: number;
  totalLaborCost: number;
  totalCost: number;
  costPerHa: number;
  projectedRevenue?: number;
  projectedMargin?: number;
}

// ─── Labels para enums (UI) ───

export const ESTADO_FENOLOGICO_LABELS: Record<EstadoFenologico, string> = {
  DORMANCIA: "Dormancia",
  BROTAMIENTO: "Brotamiento",
  FLORACION: "Floración",
  CUAJA: "Cuaja",
  CRECIMIENTO_FRUTO: "Crecimiento de fruto",
  LLENADO_FRUTO: "Llenado de fruto",
  MADUREZ: "Madurez / Cosecha",
  POSTCOSECHA: "Postcosecha",
};

export const DESTINO_LABELS: Record<DestinoProduccion, string> = {
  EXPORTACION: "Exportación",
  MERCADO_INTERNO: "Mercado interno",
  INDUSTRIA: "Industria",
  MIXTO: "Mixto",
};

export const INPUT_CATEGORY_LABELS: Record<InputCategory, string> = {
  FERTILIZANTE: "Fertilizante",
  HERBICIDA: "Herbicida",
  FUNGICIDA: "Fungicida",
  INSECTICIDA: "Insecticida",
  RIEGO: "Riego",
  MATERIAL_VEGETAL: "Material vegetal",
  OTRO: "Otro",
};

export const LABOR_ACTIVITY_LABELS: Record<LaborActivity, string> = {
  PODA: "Poda",
  RALEO: "Raleo",
  APLICACION_FITOSANITARIA: "Aplicación fitosanitaria",
  RIEGO: "Riego",
  FERTILIZACION: "Fertilización",
  COSECHA: "Cosecha",
  EMPAQUE: "Empaque",
  MONITOREO: "Monitoreo",
  INSTALACION_MALLA: "Instalación de malla",
  OTRO: "Otro",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  HELADA: "Helada",
  LLUVIA_COSECHA: "Lluvia en cosecha",
  DEFICIT_HORAS_FRIO: "Déficit de horas frío",
  GOLPE_CALOR: "Golpe de calor",
  VIENTO_FUERTE: "Viento fuerte",
  HUMEDAD_ALTA: "Humedad alta",
  RIEGO_PENDIENTE: "Riego pendiente",
  GENERAL: "Alerta general",
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  INFO: "blue",
  ADVERTENCIA: "yellow",
  CRITICA: "red",
};
