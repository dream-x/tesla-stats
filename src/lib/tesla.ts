import { getSetting, setSetting } from "./db";

export const TESLA_AUTH_URL = "https://auth.tesla.com/oauth2/v3/authorize";
export const TESLA_TOKEN_URL =
  process.env.TESLA_TOKEN_URL || "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token";
export const TESLA_SCOPES = "openid offline_access vehicle_device_data";
const DEFAULT_API_BASE = "https://fleet-api.prd.eu.vn.cloud.tesla.com";

export const MILES_TO_KM = 1.609344;

export class VehicleAsleepError extends Error {
  constructor() {
    super("Машина спит или офлайн");
  }
}

export function teslaConfig() {
  return {
    clientId: process.env.TESLA_CLIENT_ID || "",
    clientSecret: process.env.TESLA_CLIENT_SECRET || "",
    redirectUri: process.env.TESLA_REDIRECT_URI || "http://localhost:3000/api/auth/callback",
  };
}

export function isTeslaConfigured(): boolean {
  const c = teslaConfig();
  return !!(c.clientId && c.clientSecret);
}

export function apiBase(): string {
  return getSetting("tesla_api_base") || process.env.TESLA_FLEET_API_BASE || DEFAULT_API_BASE;
}

export function isTeslaConnected(): boolean {
  return !!(getSetting("tesla_refresh_token") || process.env.TESLA_REFRESH_TOKEN);
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function saveTokens(t: TokenResponse) {
  setSetting("tesla_access_token", t.access_token);
  if (t.refresh_token) setSetting("tesla_refresh_token", t.refresh_token);
  setSetting("tesla_expires_at", String(Date.now() + (t.expires_in - 60) * 1000));
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Tesla token error ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<void> {
  const c = teslaConfig();
  const t = await tokenRequest({
    grant_type: "authorization_code",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code,
    audience: apiBase(),
    redirect_uri: c.redirectUri,
  });
  saveTokens(t);
  setSetting("tesla_api_base", null);
  await detectRegion().catch(() => undefined);
}

const tg = globalThis as unknown as { __teslaRefresh?: Promise<string> | null };

function getAccessToken(): Promise<string> {
  const token = getSetting("tesla_access_token");
  const expiresAt = Number(getSetting("tesla_expires_at") ?? 0);
  if (token && Date.now() < expiresAt) return Promise.resolve(token);
  // One shared refresh: Tesla rotates refresh tokens, so parallel refreshes would invalidate each other.
  tg.__teslaRefresh ??= refreshAccessToken().finally(() => {
    tg.__teslaRefresh = null;
  });
  return tg.__teslaRefresh;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getSetting("tesla_refresh_token") || process.env.TESLA_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("Tesla не подключена");
  const t = await tokenRequest({
    grant_type: "refresh_token",
    client_id: teslaConfig().clientId,
    refresh_token: refreshToken,
  });
  // Tesla rotates refresh tokens, so the new one must be persisted.
  saveTokens({ ...t, refresh_token: t.refresh_token ?? refreshToken });
  return t.access_token;
}

async function apiGet<T>(path: string, base = apiBase()): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    cache: "no-store",
  });
  if (res.status === 408) throw new VehicleAsleepError();
  if (!res.ok) throw new Error(`Tesla API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return ((await res.json()) as { response: T }).response;
}

async function detectRegion() {
  const r = await apiGet<{ fleet_api_base_url: string }>("/api/1/users/region");
  if (r?.fleet_api_base_url) setSetting("tesla_api_base", r.fleet_api_base_url);
}

interface VehicleListItem {
  vin: string;
  display_name: string | null;
  state: string;
}

export async function resolveVin(): Promise<string> {
  const vin = process.env.TESLA_VIN || getSetting("tesla_vin");
  if (vin) return vin;
  const list = await apiGet<VehicleListItem[]>("/api/1/vehicles");
  if (!list.length) throw new Error("В аккаунте Tesla нет машин");
  setSetting("tesla_vin", list[0].vin);
  setSetting("tesla_vehicle_name", list[0].display_name || "Tesla");
  return list[0].vin;
}

export interface VehicleData {
  display_name?: string;
  charge_state?: {
    battery_level?: number;
    battery_range?: number;
    charging_state?: string;
    charge_energy_added?: number;
    charger_power?: number;
    fast_charger_present?: boolean;
    fast_charger_type?: string;
  };
  vehicle_state?: { odometer?: number };
  drive_state?: { shift_state?: string | null; speed?: number | null };
}

/** Reads vehicle data without waking the car (throws VehicleAsleepError if it sleeps). */
export async function fetchVehicleData(): Promise<VehicleData> {
  const vin = await resolveVin();
  const endpoints = encodeURIComponent("charge_state;vehicle_state;drive_state");
  return apiGet<VehicleData>(`/api/1/vehicles/${vin}/vehicle_data?endpoints=${endpoints}`);
}

export function disconnectTesla() {
  for (const k of ["tesla_access_token", "tesla_refresh_token", "tesla_expires_at", "tesla_vin", "tesla_api_base"]) {
    setSetting(k, null);
  }
}
