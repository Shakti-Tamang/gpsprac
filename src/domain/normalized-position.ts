export interface NormalizedPosition {
  device_id: string;
  provider: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  ignition: boolean | null;
  timestamp: Date;
  raw: Record<string, unknown>;
}
