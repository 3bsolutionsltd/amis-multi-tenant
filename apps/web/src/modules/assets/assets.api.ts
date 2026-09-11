import { apiFetch } from "../../lib/apiFetch";

export interface MasterAsset {
  id: string; asset_code: string; name: string; category: string; description: string | null;
  default_useful_life_years: number | null;
}
export interface Asset {
  id: string; master_asset_id: string; asset_tag: string; serial_number: string | null; status: string;
  location: string | null; custody_department: string | null; custody_holder: string | null;
  master_name: string; category: string;
}
export const listMasterAssets = () => apiFetch<MasterAsset[]>("/assets/master");
export const createMasterAsset = (body: { asset_code: string; name: string; category: string; description?: string }) =>
  apiFetch<MasterAsset>("/assets/master", { method: "POST", body: JSON.stringify(body) });
export const listAssets = () => apiFetch<Asset[]>("/assets");
export const createAsset = (body: { master_asset_id: string; asset_tag: string; serial_number?: string; location?: string; custody_department?: string; custody_holder?: string }) =>
  apiFetch<Asset>("/assets", { method: "POST", body: JSON.stringify(body) });
