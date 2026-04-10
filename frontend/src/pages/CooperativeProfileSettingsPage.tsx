import { useEffect, useState } from 'react';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Settings } from 'lucide-react';
import { RwandaLocationFields } from '../components/location/RwandaLocationFields';
import { buildLocationText, emptyRwandaLocation, parseLocationText } from '../utils/rwandaLocation';

export const CooperativeProfileSettingsPage = () => {
  const { logout } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', region: '', district: '', sector: '', cell: '', location: '' });
  const [locationForm, setLocationForm] = useState(emptyRwandaLocation());
  const [msg, setMsg] = useState('');

  const load = async () => {
    const res = await api.get('/api/cooperative/my-cooperative').catch(() => ({ data: null }));
    if (!res.data) return;
    setForm({
      name: res.data.name || '',
      phone: res.data.phone || '',
      email: res.data.email || '',
      region: res.data.region || '',
      district: res.data.district || '',
      sector: res.data.sector || '',
      cell: res.data.cell || '',
      location: res.data.location || '',
    });
    setLocationForm({
      ...parseLocationText(res.data.location || ''),
      province: res.data.region || parseLocationText(res.data.location || '').province,
      district: res.data.district || parseLocationText(res.data.location || '').district,
      sector: res.data.sector || parseLocationText(res.data.location || '').sector,
      cell: res.data.cell || parseLocationText(res.data.location || '').cell,
    });
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    await api.put('/api/cooperative/my-cooperative/profile', {
      ...form,
      region: locationForm.province,
      district: locationForm.district,
      sector: locationForm.sector,
      cell: locationForm.cell || null,
      location: buildLocationText(locationForm),
    });
    setMsg('Cooperative profile updated successfully.');
    await load();
  };

  return (
    <DashboardShell
      brand="RASS Cooperative"
      subtitle="Profile administration"
      title="Cooperative profile settings"
      activeKey="profile"
      navItems={[{ key: 'profile', label: 'Profile settings', icon: <Settings className="h-4 w-4" /> }]}
      onNavChange={() => {}}
      onLogout={logout}
      rightStatus="Manager access"
    >
      <Card className="p-5">
        <h3 className="text-lg font-black text-slate-900">Update cooperative profile</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Cooperative name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input label="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <div className="md:col-span-2">
            <RwandaLocationFields
              value={locationForm}
              onChange={setLocationForm}
              showDetail
              detailRequired
              detailLabel="Location details"
              detailPlaceholder="Office, warehouse gate, or cooperative campus"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Save changes</Button>
          {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}
        </div>
      </Card>
    </DashboardShell>
  );
};
