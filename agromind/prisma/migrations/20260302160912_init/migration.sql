-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FARMER', 'AGRONOMIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoFenologico" AS ENUM ('DORMANCIA', 'BROTAMIENTO', 'FLORACION', 'CUAJA', 'CRECIMIENTO_FRUTO', 'LLENADO_FRUTO', 'MADUREZ', 'POSTCOSECHA');

-- CreateEnum
CREATE TYPE "DestinoProduccion" AS ENUM ('EXPORTACION', 'MERCADO_INTERNO', 'INDUSTRIA', 'MIXTO');

-- CreateEnum
CREATE TYPE "InputCategory" AS ENUM ('FERTILIZANTE', 'HERBICIDA', 'FUNGICIDA', 'INSECTICIDA', 'RIEGO', 'MATERIAL_VEGETAL', 'OTRO');

-- CreateEnum
CREATE TYPE "LaborActivity" AS ENUM ('PODA', 'RALEO', 'APLICACION_FITOSANITARIA', 'RIEGO', 'FERTILIZACION', 'COSECHA', 'EMPAQUE', 'MONITOREO', 'INSTALACION_MALLA', 'OTRO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HELADA', 'LLUVIA_COSECHA', 'DEFICIT_HORAS_FRIO', 'GOLPE_CALOR', 'VIENTO_FUERTE', 'HUMEDAD_ALTA', 'RIEGO_PENDIENTE', 'GENERAL');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'ADVERTENCIA', 'CRITICA');

-- CreateEnum
CREATE TYPE "AlertSource" AS ENUM ('AUTOMATICA', 'IA', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'FARMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "totalArea" DOUBLE PRECISION NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "soilType" TEXT,
    "slopePerc" DOUBLE PRECISION,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crops" (
    "id" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "plantYear" INTEGER NOT NULL,
    "density" DOUBLE PRECISION NOT NULL,
    "rootstock" TEXT,
    "lotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_cycles" (
    "id" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estadoFenologico" "EstadoFenologico" NOT NULL DEFAULT 'DORMANCIA',
    "horasFrioAcumuladas" INTEGER NOT NULL DEFAULT 0,
    "calibreEstimado" DOUBLE PRECISION,
    "rendimientoEstimado" DOUBLE PRECISION,
    "fechaCosechaEstimada" TIMESTAMP(3),
    "fechaCosechaReal" TIMESTAMP(3),
    "destinoProduccion" "DestinoProduccion" NOT NULL DEFAULT 'EXPORTACION',
    "rendimientoReal" DOUBLE PRECISION,
    "precioPromedio" DOUBLE PRECISION,
    "notas" TEXT,
    "cropId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inputs" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "InputCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "productionCycleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_records" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "activity" "LaborActivity" NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "hoursPerWorker" DOUBLE PRECISION NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "costPerHour" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "productionCycleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tempC" DOUBLE PRECISION NOT NULL,
    "tempMinC" DOUBLE PRECISION,
    "tempMaxC" DOUBLE PRECISION,
    "precipMm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "windSpeedKmh" DOUBLE PRECISION,
    "windDirection" INTEGER,
    "humidity" DOUBLE PRECISION,
    "solarRadiation" DOUBLE PRECISION,
    "etMm" DOUBLE PRECISION,
    "esBajoUmbralHelada" BOOLEAN NOT NULL DEFAULT false,
    "esRiesgoLluvia" BOOLEAN NOT NULL DEFAULT false,
    "contribuyeHorasFrio" BOOLEAN NOT NULL DEFAULT false,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "triggerValue" DOUBLE PRECISION,
    "triggerMetric" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "source" "AlertSource" NOT NULL DEFAULT 'AUTOMATICA',
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "weather_logs_farmId_timestamp_idx" ON "weather_logs"("farmId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "weather_logs_farmId_timestamp_key" ON "weather_logs"("farmId", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_farmId_isRead_idx" ON "alerts"("farmId", "isRead");

-- CreateIndex
CREATE INDEX "alerts_farmId_createdAt_idx" ON "alerts"("farmId", "createdAt");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crops" ADD CONSTRAINT "crops_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_cycles" ADD CONSTRAINT "production_cycles_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inputs" ADD CONSTRAINT "inputs_productionCycleId_fkey" FOREIGN KEY ("productionCycleId") REFERENCES "production_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_records" ADD CONSTRAINT "labor_records_productionCycleId_fkey" FOREIGN KEY ("productionCycleId") REFERENCES "production_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weather_logs" ADD CONSTRAINT "weather_logs_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
