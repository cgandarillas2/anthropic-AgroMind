-- ============================================================
-- Migration: english_schema_and_iot
-- Renames Spanish → English columns/enums + adds IoT tables
-- Uses RENAME to preserve all existing data
-- ============================================================

-- Step 1: Rename enum VALUES in place (preserves data in columns)

-- 1a. EstadoFenologico values → PhenologicalStage values
ALTER TYPE "EstadoFenologico" RENAME VALUE 'DORMANCIA' TO 'DORMANCY';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'BROTAMIENTO' TO 'BUDBREAK';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'FLORACION' TO 'FLOWERING';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'CUAJA' TO 'FRUIT_SET';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'CRECIMIENTO_FRUTO' TO 'FRUIT_GROWTH';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'LLENADO_FRUTO' TO 'FRUIT_FILL';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'MADUREZ' TO 'MATURITY';
ALTER TYPE "EstadoFenologico" RENAME VALUE 'POSTCOSECHA' TO 'POST_HARVEST';
ALTER TYPE "EstadoFenologico" RENAME TO "PhenologicalStage";

-- 1b. DestinoProduccion values → ProductionDestination values
ALTER TYPE "DestinoProduccion" RENAME VALUE 'EXPORTACION' TO 'EXPORT';
ALTER TYPE "DestinoProduccion" RENAME VALUE 'MERCADO_INTERNO' TO 'DOMESTIC_MARKET';
ALTER TYPE "DestinoProduccion" RENAME VALUE 'INDUSTRIA' TO 'INDUSTRY';
ALTER TYPE "DestinoProduccion" RENAME VALUE 'MIXTO' TO 'MIXED';
ALTER TYPE "DestinoProduccion" RENAME TO "ProductionDestination";

-- 1c. AlertSeverity: ADVERTENCIA → WARNING, CRITICA → CRITICAL
ALTER TYPE "AlertSeverity" RENAME VALUE 'ADVERTENCIA' TO 'WARNING';
ALTER TYPE "AlertSeverity" RENAME VALUE 'CRITICA' TO 'CRITICAL';

-- 1d. AlertSource: AUTOMATICA → AUTOMATIC, IA → AI
ALTER TYPE "AlertSource" RENAME VALUE 'AUTOMATICA' TO 'AUTOMATIC';
ALTER TYPE "AlertSource" RENAME VALUE 'IA' TO 'AI';

-- 1e. AlertType: Spanish → English
ALTER TYPE "AlertType" RENAME VALUE 'HELADA' TO 'FROST';
ALTER TYPE "AlertType" RENAME VALUE 'LLUVIA_COSECHA' TO 'HARVEST_RAIN';
ALTER TYPE "AlertType" RENAME VALUE 'DEFICIT_HORAS_FRIO' TO 'CHILL_HOUR_DEFICIT';
ALTER TYPE "AlertType" RENAME VALUE 'GOLPE_CALOR' TO 'HEAT_WAVE';
ALTER TYPE "AlertType" RENAME VALUE 'VIENTO_FUERTE' TO 'STRONG_WIND';
ALTER TYPE "AlertType" RENAME VALUE 'HUMEDAD_ALTA' TO 'HIGH_HUMIDITY';
ALTER TYPE "AlertType" RENAME VALUE 'RIEGO_PENDIENTE' TO 'IRRIGATION_PENDING';
-- GENERAL stays the same

-- 1f. InputCategory: Spanish → English
ALTER TYPE "InputCategory" RENAME VALUE 'FERTILIZANTE' TO 'FERTILIZER';
ALTER TYPE "InputCategory" RENAME VALUE 'HERBICIDA' TO 'HERBICIDE';
ALTER TYPE "InputCategory" RENAME VALUE 'FUNGICIDA' TO 'FUNGICIDE';
ALTER TYPE "InputCategory" RENAME VALUE 'INSECTICIDA' TO 'INSECTICIDE';
ALTER TYPE "InputCategory" RENAME VALUE 'RIEGO' TO 'IRRIGATION';
ALTER TYPE "InputCategory" RENAME VALUE 'MATERIAL_VEGETAL' TO 'PLANT_MATERIAL';
ALTER TYPE "InputCategory" RENAME VALUE 'OTRO' TO 'OTHER';

-- 1g. LaborActivity: Spanish → English
ALTER TYPE "LaborActivity" RENAME VALUE 'PODA' TO 'PRUNING';
ALTER TYPE "LaborActivity" RENAME VALUE 'RALEO' TO 'THINNING';
ALTER TYPE "LaborActivity" RENAME VALUE 'APLICACION_FITOSANITARIA' TO 'PESTICIDE_APPLICATION';
ALTER TYPE "LaborActivity" RENAME VALUE 'RIEGO' TO 'IRRIGATION';
ALTER TYPE "LaborActivity" RENAME VALUE 'FERTILIZACION' TO 'FERTILIZATION';
ALTER TYPE "LaborActivity" RENAME VALUE 'COSECHA' TO 'HARVEST';
ALTER TYPE "LaborActivity" RENAME VALUE 'EMPAQUE' TO 'PACKING';
ALTER TYPE "LaborActivity" RENAME VALUE 'MONITOREO' TO 'MONITORING';
ALTER TYPE "LaborActivity" RENAME VALUE 'INSTALACION_MALLA' TO 'NETTING_INSTALLATION';
ALTER TYPE "LaborActivity" RENAME VALUE 'OTRO' TO 'OTHER';

-- Step 2: Rename columns in production_cycles
ALTER TABLE "production_cycles" RENAME COLUMN "estadoFenologico" TO "phenologicalStage";
ALTER TABLE "production_cycles" RENAME COLUMN "horasFrioAcumuladas" TO "chillHoursAccumulated";
ALTER TABLE "production_cycles" RENAME COLUMN "calibreEstimado" TO "estimatedCalibration";
ALTER TABLE "production_cycles" RENAME COLUMN "rendimientoEstimado" TO "estimatedYield";
ALTER TABLE "production_cycles" RENAME COLUMN "fechaCosechaEstimada" TO "estimatedHarvestDate";
ALTER TABLE "production_cycles" RENAME COLUMN "fechaCosechaReal" TO "actualHarvestDate";
ALTER TABLE "production_cycles" RENAME COLUMN "destinoProduccion" TO "productionDestination";
ALTER TABLE "production_cycles" RENAME COLUMN "rendimientoReal" TO "actualYield";
ALTER TABLE "production_cycles" RENAME COLUMN "precioPromedio" TO "averagePrice";
ALTER TABLE "production_cycles" RENAME COLUMN "notas" TO "notes";

-- Step 3: Rename columns in weather_logs
ALTER TABLE "weather_logs" RENAME COLUMN "esBajoUmbralHelada" TO "isBelowFrostThreshold";
ALTER TABLE "weather_logs" RENAME COLUMN "esRiesgoLluvia" TO "isRainRisk";
ALTER TABLE "weather_logs" RENAME COLUMN "contribuyeHorasFrio" TO "contributesToChillHours";

-- Step 4: Update default for alerts.source
ALTER TABLE "alerts" ALTER COLUMN "source" SET DEFAULT 'AUTOMATIC'::"AlertSource";

-- Step 5: Create new IoT enum types
CREATE TYPE "IoTDeviceType" AS ENUM ('WEATHER_STATION', 'TEMPERATURE_HUMIDITY', 'SOIL_MOISTURE', 'FROST_SENSOR', 'FLOW_METER', 'LEAF_WETNESS');
CREATE TYPE "IoTDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- Step 6: Create iot_devices table
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IoTDeviceType" NOT NULL,
    "status" "IoTDeviceStatus" NOT NULL DEFAULT 'ONLINE',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "batteryPct" INTEGER,
    "serialNumber" TEXT,
    "notes" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "farmId" TEXT NOT NULL,
    "lotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create iot_readings table
CREATE TABLE "iot_readings" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,
    CONSTRAINT "iot_readings_pkey" PRIMARY KEY ("id")
);

-- Step 8: Create indexes
CREATE INDEX "iot_devices_farmId_idx" ON "iot_devices"("farmId");
CREATE INDEX "iot_devices_lotId_idx" ON "iot_devices"("lotId");
CREATE INDEX "iot_readings_deviceId_timestamp_idx" ON "iot_readings"("deviceId", "timestamp");
CREATE INDEX "iot_readings_deviceId_metric_timestamp_idx" ON "iot_readings"("deviceId", "metric", "timestamp");

-- Step 9: Add foreign keys
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "iot_readings" ADD CONSTRAINT "iot_readings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
