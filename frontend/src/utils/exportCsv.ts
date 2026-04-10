import { api } from '../api/client';

export interface ExportFilters {
  crop?: string;
  region?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

/**
 * Downloads a CSV report from the universal /api/reports/export-csv endpoint.
 * Uses the Axios client so JWT auth tokens are included automatically.
 */
export async function exportReportCsv(reportType: string, filters: ExportFilters = {}) {
  const params = new URLSearchParams();
  params.set('reportType', reportType);
  if (filters.crop) params.set('crop', filters.crop);
  if (filters.region) params.set('region', filters.region);
  if (filters.district) params.set('district', filters.district);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.status) params.set('status', filters.status);

  const res = await api.get(`/api/reports/export-csv?${params.toString()}`, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const disposition = res.headers['content-disposition'];
  a.download = disposition?.match(/filename="?(.+)"?/)?.[1] || `RASS_${reportType}_report.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
