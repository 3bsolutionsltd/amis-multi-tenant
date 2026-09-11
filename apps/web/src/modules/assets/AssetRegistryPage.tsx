import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureGlobalCss, PageHeader, Card, Field, inputCss, PrimaryBtn, SecondaryBtn, DataTable, TR, TD, ErrorBanner } from "../../lib/ui";
import { createAsset, createMasterAsset, listAssets, listMasterAssets } from "./assets.api";

ensureGlobalCss();

export default function AssetRegistryPage() {
  const qc = useQueryClient();
  const masters = useQuery({ queryKey: ["assets.master"], queryFn: listMasterAssets });
  const assets = useQuery({ queryKey: ["assets"], queryFn: listAssets });
  const [master, setMaster] = useState({ asset_code: "", name: "", category: "equipment", description: "" });
  const [asset, setAsset] = useState({ master_asset_id: "", asset_tag: "", serial_number: "", location: "", custody_department: "", custody_holder: "" });
  const [error, setError] = useState<string | null>(null);
  const masterMut = useMutation({ mutationFn: () => createMasterAsset(master), onSuccess: () => { setMaster({ asset_code: "", name: "", category: "equipment", description: "" }); qc.invalidateQueries({ queryKey: ["assets.master"] }); }, onError: (e) => setError(String(e)) });
  const assetMut = useMutation({ mutationFn: () => createAsset(asset), onSuccess: () => { setAsset({ master_asset_id: "", asset_tag: "", serial_number: "", location: "", custody_department: "", custody_holder: "" }); qc.invalidateQueries({ queryKey: ["assets"] }); }, onError: (e) => setError(String(e)) });
  const update = (key: keyof typeof asset, value: string) => setAsset((current) => ({ ...current, [key]: value }));

  return <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
    <PageHeader title="Asset Registry" description="Maintain the master asset catalogue and assets assigned to departments or custodians" />
    {error && <ErrorBanner message={error} />}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
      <Card style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Master Asset Registry</h3>
        <Field label="Asset Code"><input style={inputCss} value={master.asset_code} onChange={(e) => setMaster({ ...master, asset_code: e.target.value })} /></Field>
        <Field label="Asset Name"><input style={inputCss} value={master.name} onChange={(e) => setMaster({ ...master, name: e.target.value })} /></Field>
        <Field label="Category"><input style={inputCss} value={master.category} onChange={(e) => setMaster({ ...master, category: e.target.value })} /></Field>
        <PrimaryBtn onClick={() => masterMut.mutate()} disabled={masterMut.isPending || !master.asset_code || !master.name}>Add Master Asset</PrimaryBtn>
      </Card>
      <Card style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Register Asset</h3>
        <Field label="Master Asset"><select style={inputCss} value={asset.master_asset_id} onChange={(e) => update("master_asset_id", e.target.value)}><option value="">Select master asset</option>{(masters.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.asset_code} - {item.name}</option>)}</select></Field>
        <Field label="Asset Tag"><input style={inputCss} value={asset.asset_tag} onChange={(e) => update("asset_tag", e.target.value)} /></Field>
        <Field label="Serial Number"><input style={inputCss} value={asset.serial_number} onChange={(e) => update("serial_number", e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Field label="Location"><input style={inputCss} value={asset.location} onChange={(e) => update("location", e.target.value)} /></Field><Field label="Custody Department / HOD"><input style={inputCss} value={asset.custody_department} onChange={(e) => update("custody_department", e.target.value)} /></Field></div>
        <Field label="Custodian"><input style={inputCss} value={asset.custody_holder} onChange={(e) => update("custody_holder", e.target.value)} /></Field>
        <PrimaryBtn onClick={() => assetMut.mutate()} disabled={assetMut.isPending || !asset.master_asset_id || !asset.asset_tag}>Register Asset</PrimaryBtn>
      </Card>
    </div>
    <Card style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Registered Assets</h3><DataTable isLoading={assets.isLoading} headers={["Asset Tag", "Asset", "Category", "Status", "Location", "Custody"]}>{(assets.data ?? []).map((item) => <TR key={item.id}><TD>{item.asset_tag}</TD><TD>{item.master_name}</TD><TD>{item.category}</TD><TD>{item.status}</TD><TD>{item.location ?? "-"}</TD><TD>{item.custody_department ?? item.custody_holder ?? "-"}</TD></TR>)}</DataTable></Card>
  </div>;
}
