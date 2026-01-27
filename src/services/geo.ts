import { getDatabase } from "../db/index.ts";

interface GeoData {
  country: string;
  city: string;
}

interface IpApiResponse {
  status: string;
  country: string;
  countryCode: string;
  city: string;
}

export async function lookupGeo(ip: string): Promise<GeoData | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as IpApiResponse;
    if (data.status !== "success") {
      return null;
    }
    return {
      country: data.countryCode,
      city: data.city,
    };
  } catch {
    return null;
  }
}

export async function updateClickGeo(
  clickId: string,
  ip: string
): Promise<void> {
  const geoData = await lookupGeo(ip);
  if (geoData) {
    const db = getDatabase();
    db.prepare(
      `UPDATE clicks SET country = ?, city = ? WHERE id = ?`
    ).run(geoData.country, geoData.city, clickId);
  }
}
