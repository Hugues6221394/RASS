import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { api } from '../api/client';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation } from '../utils/rwandaLocation';
import { encodeFileToPayload, type EncodedFileUpload } from '../utils/fileUpload';

export const ApplyRolePage = () => {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    targetRole: 'CooperativeManager',
    organizationName: '',
    farmersCount: '',
    farmSizeHectares: '',
    location: '',
    organizationEmail: '',
    organizationPhone: '',
    vehicleType: '',
    licenseNumber: '',
    plateNumber: '',
    storageLocation: '',
    warehouseCapacity: '',
    notes: '',
  });
  const [applicationLocation, setApplicationLocation] = useState(emptyRwandaLocation());
  const [storageLocation, setStorageLocation] = useState(emptyRwandaLocation());
  const [drivingLicenseDocument, setDrivingLicenseDocument] = useState<EncodedFileUpload | null>(null);
  const [rdbCertificateDocument, setRdbCertificateDocument] = useState<EncodedFileUpload | null>(null);

  const handleFileSelection = async (
    file: File | null,
    setter: (payload: EncodedFileUpload | null) => void,
  ) => {
    if (!file) {
      setter(null);
      return;
    }
    const payload = await encodeFileToPayload(file);
    setter(payload);
  };

  const submit = async () => {
    setMsg('');
    try {
      const payload = {
        ...form,
        province: applicationLocation.province,
        district: applicationLocation.district,
        sector: applicationLocation.sector,
        cell: applicationLocation.cell || null,
        location: buildLocationText(applicationLocation),
        storageLocation: form.targetRole === 'StorageOperator' ? buildLocationText(storageLocation) : form.storageLocation,
        farmersCount: form.farmersCount ? Number(form.farmersCount) : null,
        farmSizeHectares: form.farmSizeHectares ? Number(form.farmSizeHectares) : null,
        drivingLicenseDocument,
        rdbCertificateDocument,
      };
      const res = await api.post('/api/applications/submit', payload);
      setMsg(String(res.data?.message || 'Application submitted.'));
      setTimeout(() => navigate('/login'), 1200);
    } catch (e: any) {
      setMsg(String(e?.response?.data || 'Failed to submit application.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-3xl px-4">
        <Card className="p-6">
          <h1 className="text-2xl font-black text-slate-900">Apply for role</h1>
          <p className="mt-1 text-sm text-slate-500">Restricted roles require approval workflow.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label="Full name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
            <Input label="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Target role</span>
              <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" value={form.targetRole} onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value }))}>
                {['CooperativeManager', 'Transporter', 'StorageOperator', 'MarketAgent'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <Input label="Organization name" value={form.organizationName} onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))} />
            <div className="md:col-span-2">
              <RwandaLocationFields
                value={applicationLocation}
                onChange={setApplicationLocation}
                showDetail
                detailRequired
                detailLabel="Organization location"
                detailPlaceholder="Office, roadside collection point, or cooperative office"
              />
            </div>
            <Input label="Organization email" value={form.organizationEmail} onChange={(e) => setForm((p) => ({ ...p, organizationEmail: e.target.value }))} />
            <Input label="Organization phone" value={form.organizationPhone} onChange={(e) => setForm((p) => ({ ...p, organizationPhone: e.target.value }))} />
            {(form.targetRole === 'CooperativeManager') && (
              <>
                <Input label="Farmers count" type="number" value={form.farmersCount} onChange={(e) => setForm((p) => ({ ...p, farmersCount: e.target.value }))} />
                <Input label="Farm size (hectares)" type="number" value={form.farmSizeHectares} onChange={(e) => setForm((p) => ({ ...p, farmSizeHectares: e.target.value }))} />
              </>
            )}
            {(form.targetRole === 'Transporter') && (
              <>
                <Input label="Vehicle type" value={form.vehicleType} onChange={(e) => setForm((p) => ({ ...p, vehicleType: e.target.value }))} />
                <Input label="License number" value={form.licenseNumber} onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))} />
                <Input label="Plate number" value={form.plateNumber} onChange={(e) => setForm((p) => ({ ...p, plateNumber: e.target.value }))} />
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Driving license certificate</span>
                  <input className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" type="file" accept=".pdf,image/*" onChange={(e) => { void handleFileSelection(e.target.files?.[0] || null, setDrivingLicenseDocument); }} />
                  {drivingLicenseDocument && <p className="mt-1 text-xs text-slate-500">{drivingLicenseDocument.fileName}</p>}
                </label>
              </>
            )}
            {(form.targetRole === 'StorageOperator') && (
              <>
                <div className="md:col-span-2">
                  <RwandaLocationFields
                    value={storageLocation}
                    onChange={setStorageLocation}
                    showDetail
                    detailRequired
                    detailLabel="Storage location"
                    detailPlaceholder="Warehouse name, block, or gate reference"
                  />
                </div>
                <Input label="Warehouse capacity" value={form.warehouseCapacity} onChange={(e) => setForm((p) => ({ ...p, warehouseCapacity: e.target.value }))} />
              </>
            )}
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">RDB certificate or business supporting document</span>
              <input className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" type="file" accept=".pdf,image/*" onChange={(e) => { void handleFileSelection(e.target.files?.[0] || null, setRdbCertificateDocument); }} />
              {rdbCertificateDocument && <p className="mt-1 text-xs text-slate-500">{rdbCertificateDocument.fileName}</p>}
            </label>
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={submit}>Submit application</Button>
            {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};
