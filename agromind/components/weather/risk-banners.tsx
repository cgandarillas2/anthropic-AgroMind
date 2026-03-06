import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DetectedRisk } from "@/lib/weather/indicators";
import { formatShortDate } from "@/lib/weather/indicators";

const SEVERITY_STYLES = {
  CRITICAL: "border-red-300 bg-red-50 text-red-900",
  WARNING:  "border-yellow-300 bg-yellow-50 text-yellow-900",
  INFO:     "border-blue-300 bg-blue-50 text-blue-900",
} as const;

const SEVERITY_ICONS = {
  CRITICAL: "🚨",
  WARNING:  "⚠️",
  INFO:     "ℹ️",
} as const;

interface Props {
  riesgos: DetectedRisk[];
}

export function RiskBanners({ riesgos }: Props) {
  if (riesgos.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50 text-green-800">
        <AlertTitle className="flex items-center gap-2">
          <span>✅</span> No active climate alerts
        </AlertTitle>
        <AlertDescription className="text-green-700 text-sm">
          Forecast conditions are favorable for the crop.
        </AlertDescription>
      </Alert>
    );
  }

  // Sort: CRITICAL first
  const sorted = [...riesgos].sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-3">
      {sorted.map((risk, i) => (
        <Alert
          key={i}
          className={cn("border", SEVERITY_STYLES[risk.severity])}
        >
          <AlertTitle className="flex items-center gap-2 font-semibold">
            <span>{SEVERITY_ICONS[risk.severity]}</span>
            {risk.title}
            {risk.dates.length > 0 && (
              <span className="text-xs font-normal opacity-75 ml-auto">
                {risk.dates.map(formatShortDate).join(", ")}
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-1">
            <p className="text-sm opacity-90">{risk.description}</p>
            <p className="text-sm font-medium border-t border-current/20 pt-1 mt-1">
              <span className="opacity-60">Action: </span>
              {risk.recommendation}
            </p>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
