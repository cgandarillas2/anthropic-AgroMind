import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Wind, Eye, Zap } from "lucide-react";
import { getWeatherInfo, type CurrentWeather } from "@/lib/weather/open-meteo";
import { getWindDirection } from "@/lib/weather/indicators";

interface Props {
  weather: CurrentWeather;
  farmName: string;
  commune: string;
}

export function CurrentWeatherCard({ weather, farmName, commune }: Props) {
  const { label, emoji } = getWeatherInfo(weather.weatherCode);

  return (
    <Card className="bg-gradient-to-br from-sky-500 to-blue-700 text-white border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-blue-100">
          {farmName} — {commune}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-6xl font-bold leading-none">
              {Math.round(weather.tempC)}°
            </div>
            <div className="text-blue-100 mt-1 text-sm">{label}</div>
          </div>
          <span className="text-7xl">{emoji}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
            <Droplets className="w-4 h-4 text-blue-200" />
            <div>
              <div className="text-blue-100 text-xs">Humidity</div>
              <div className="font-semibold">{weather.humidity}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
            <Wind className="w-4 h-4 text-blue-200" />
            <div>
              <div className="text-blue-100 text-xs">Wind</div>
              <div className="font-semibold">
                {Math.round(weather.windSpeedKmh)} km/h {getWindDirection(weather.windDirection)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
            <Eye className="w-4 h-4 text-blue-200" />
            <div>
              <div className="text-blue-100 text-xs">Precipitation</div>
              <div className="font-semibold">{weather.precipMm.toFixed(1)} mm</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-blue-200" />
            <div>
              <div className="text-blue-100 text-xs">Radiation</div>
              <div className="font-semibold">{Math.round(weather.solarRadiation)} W/m²</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
