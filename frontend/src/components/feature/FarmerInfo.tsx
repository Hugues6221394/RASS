import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface FarmerInfoProps {
  cooperativeName: string;
  region: string;
  district: string;
  sector?: string;
  cell?: string;
  location?: string;
  phone?: string;
  email?: string;
  verified?: boolean;
}

export const FarmerInfo = ({ cooperativeName, region, district, sector, cell, location, phone, email, verified }: FarmerInfoProps) => (
  <Card className="p-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-slate-900">Supplier Profile</h3>
      {verified ? <Badge text="Verified" tone="success" /> : <Badge text="Pending verification" tone="warning" />}
    </div>
    <div className="space-y-2 text-sm text-slate-600">
      <p><span className="font-semibold text-slate-800">Cooperative:</span> {cooperativeName}</p>
      <p><span className="font-semibold text-slate-800">Region:</span> {region}</p>
      <p><span className="font-semibold text-slate-800">District:</span> {district}</p>
      {sector && <p><span className="font-semibold text-slate-800">Sector:</span> {sector}</p>}
      {cell && <p><span className="font-semibold text-slate-800">Cell:</span> {cell}</p>}
      {location && <p><span className="font-semibold text-slate-800">Listing location:</span> {location}</p>}
      {phone && <p><span className="font-semibold text-slate-800">Phone:</span> {phone}</p>}
      {email && <p><span className="font-semibold text-slate-800">Email:</span> {email}</p>}
    </div>
  </Card>
);
