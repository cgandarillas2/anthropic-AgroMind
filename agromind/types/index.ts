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
  IoTDevice,
  IoTReading,
  PhenologicalStage,
  ProductionDestination,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
  IoTDeviceType,
  IoTDeviceStatus,
} from "@prisma/client";

// Re-export Prisma enums
export type {
  PhenologicalStage,
  ProductionDestination,
  InputCategory,
  LaborActivity,
  AlertType,
  AlertSeverity,
  AlertSource,
  UserRole,
  IoTDeviceType,
  IoTDeviceStatus,
  IoTDevice,
  IoTReading,
};

// ─── Composite types (include relations) ───

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

// ─── API Payloads ───

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
  // Calculated risks for cherries
  riesgoHelada: boolean;
  riesgoLluvia: boolean;
  riesgoCalor: boolean;
}

export interface WeatherResponse {
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  // Chill hours accumulated in recent history
  chillHoursAccumulatedPeriod?: number;
}

// ─── AI Agent Payload ───

export interface AiReportRequest {
  farmId: string;
  cycleId: string;
  reportType: "weekly" | "risk" | "harvest";
}

export interface AiReportResponse {
  reportType: AiReportRequest["reportType"];
  generatedAt: string;
  content: string; // markdown report
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

// ─── Form Types ───

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
  phenologicalStage: PhenologicalStage;
  chillHoursAccumulated: number;
  productionDestination: ProductionDestination;
  estimatedCalibration?: number;
  estimatedYield?: number;
  estimatedHarvestDate?: string;
  notes?: string;
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

// ─── Cycle financial summary ───

export interface CycleCostSummary {
  totalInputsCost: number;
  totalLaborCost: number;
  totalCost: number;
  costPerHa: number;
  projectedRevenue?: number;
  projectedMargin?: number;
}

// ─── Labels for enums (UI) ───

export const PHENOLOGICAL_STAGE_LABELS: Record<PhenologicalStage, string> = {
  DORMANCY:     "Dormancy",
  BUDBREAK:     "Budbreak",
  FLOWERING:    "Flowering",
  FRUIT_SET:    "Fruit Set",
  FRUIT_GROWTH: "Fruit Growth",
  FRUIT_FILL:   "Fruit Fill",
  MATURITY:     "Maturity",
  POST_HARVEST: "Post-harvest",
};

export const DESTINATION_LABELS: Record<ProductionDestination, string> = {
  EXPORT:          "Export",
  DOMESTIC_MARKET: "Domestic Market",
  INDUSTRY:        "Industry",
  MIXED:           "Mixed",
};

export const INPUT_CATEGORY_LABELS: Record<InputCategory, string> = {
  FERTILIZER:     "Fertilizer",
  HERBICIDE:      "Herbicide",
  FUNGICIDE:      "Fungicide",
  INSECTICIDE:    "Insecticide",
  IRRIGATION:     "Irrigation",
  PLANT_MATERIAL: "Plant Material",
  OTHER:          "Other",
};

export const LABOR_ACTIVITY_LABELS: Record<LaborActivity, string> = {
  PRUNING:               "Pruning",
  THINNING:              "Thinning",
  PESTICIDE_APPLICATION: "Pesticide Application",
  IRRIGATION:            "Irrigation",
  FERTILIZATION:         "Fertilization",
  HARVEST:               "Harvest",
  PACKING:               "Packing",
  MONITORING:            "Monitoring",
  NETTING_INSTALLATION:  "Netting Installation",
  OTHER:                 "Other",
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  FROST:               "Frost",
  HARVEST_RAIN:        "Harvest Rain",
  CHILL_HOUR_DEFICIT:  "Chill Hours Deficit",
  HEAT_WAVE:           "Heat Wave",
  STRONG_WIND:         "Strong Wind",
  HIGH_HUMIDITY:       "High Humidity",
  IRRIGATION_PENDING:  "Pending Irrigation",
  GENERAL:             "General Alert",
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  INFO:     "blue",
  WARNING:  "yellow",
  CRITICAL: "red",
};

// ─── IoT Labels ───

export const IOT_DEVICE_TYPE_LABELS: Record<IoTDeviceType, string> = {
  WEATHER_STATION:      "Weather Station",
  TEMPERATURE_HUMIDITY: "Temp/Humidity",
  SOIL_MOISTURE:        "Soil Moisture",
  FROST_SENSOR:         "Frost Sensor",
  FLOW_METER:           "Flow Meter",
  LEAF_WETNESS:         "Leaf Wetness",
};

export const IOT_DEVICE_TYPE_ICONS: Record<IoTDeviceType, string> = {
  WEATHER_STATION:      "🌤️",
  TEMPERATURE_HUMIDITY: "🌡️",
  SOIL_MOISTURE:        "💧",
  FROST_SENSOR:         "🧊",
  FLOW_METER:           "🚿",
  LEAF_WETNESS:         "🌿",
};

export const IOT_DEVICE_STATUS_STYLES: Record<IoTDeviceStatus, { badge: string; dot: string; label: string }> = {
  ONLINE:      { badge: "bg-green-100 text-green-700",  dot: "bg-green-500",  label: "Online"      },
  OFFLINE:     { badge: "bg-red-100 text-red-700",      dot: "bg-red-500",    label: "Offline"     },
  MAINTENANCE: { badge: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500", label: "Maintenance" },
};

export type IoTDeviceWithReadings = IoTDevice & {
  readings: IoTReading[];
  lot?: { id: string; name: string } | null;
};
