import { exotelProvider } from "./exotel";
import { mockProvider } from "./mock";
import type { TelephonyProvider } from "./types";

const ALL: TelephonyProvider[] = [mockProvider, exotelProvider];

export function getProvider(key: string): TelephonyProvider {
  const p = ALL.find((x) => x.key === key);
  if (!p) throw new Error(`Unknown provider ${key}`);
  return p;
}

export function availableProviders() {
  return ALL.map((p) => ({ key: p.key, label: p.label, configured: p.configured() }));
}

export type { TelephonyProvider } from "./types";
