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

// ─── Labels for enums (UI) ───

export const ESTADO_FENOLOGICO_LABELS: Record<EstadoFenologico, string> = {
  DORMANCIA: "Dormancy",
  BROTAMIENTO: "Budbreak",
  FLORACION: "Flowering",
  CUAJA: "Set",
  CRECIMIENTO_FRUTO: "Growth",
  LLENADO_FRUTO: "Filling",
  MADUREZ: "Harvest",
  POSTCOSECHA: "Post-harvest",
};

export const DESTINO_LABELS: Record<DestinoProduccion, string> = {
  EXPORTACION: "Export",
  MERCADO_INTERNO: "Domestic Market",
  INDUSTRIA: "Industry",
  MIXTO: "Mixed",
};

export const INPUT_CATEGORY_LABELS: Record<InputCategory, string> = {
  FERTILIZANTE: "Fertilizer",
  HERBICIDA: "Herbicide",
  FUNGICIDA: "Fungicide",
  INSECTICIDA: "Insecticide",
  RIEGO: "Irrigation",
  MATERIAL_VEGETAL: "Plant Material",
  OTRO: "Other",
};

export const LABOR_ACTIVITY_LABELS: Record<LaborActivity, string> = {
  PODA: "Pruning",
  RALEO: "Thinning",
  APLICACION_FITOSANITARIA: "Phytosanitary Application",
  RIEGO: "Irrigation",
  FERTILIZACION: "Fertilization",
  COSECHA: "Harvest",
  EMPAQUE: "Packing",
  MONITOREO: "Monitoring",
  INSTALACION_MALLA: "Net Installation",
  OTRO: "Other",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  HELADA: "Frost",
  LLUVIA_COSECHA: "Harvest Rain",
  DEFICIT_HORAS_FRIO: "Chill Hours Deficit",
  GOLPE_CALOR: "Heat Stress",
  VIENTO_FUERTE: "Strong Wind",
  HUMEDAD_ALTA: "High Humidity",
  RIEGO_PENDIENTE: "Pending Irrigation",
  GENERAL: "General Alert",
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  INFO: "blue",
  ADVERTENCIA: "yellow",
  CRITICA: "red",
};
