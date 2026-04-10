import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5172';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rass_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const lang = localStorage.getItem('rass_lang') || 'en';
  config.headers['X-Lang'] = lang;
  return config;
});

const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);
const noisyActionPathPatterns: RegExp[] = [
  /^\/api\/auth\//i,
  /^\/api\/chat\//i,
  /^\/api\/aichat/i,
  /^\/api\/aiinsights\//i,
  /^\/api\/role-analytics\//i,
  /^\/api\/forecast/i,
];
const importantCrudPathPatterns: RegExp[] = [
  /^\/api\/admin\//i,
  /^\/api\/applications\//i,
  /^\/api\/lots\//i,
  /^\/api\/harvest/i,
  /^\/api\/market/i,
  /^\/api\/contracts\//i,
  /^\/api\/buyerorders\//i,
  /^\/api\/storage/i,
  /^\/api\/transport/i,
  /^\/api\/cooperative\//i,
  /^\/api\/farmers\//i,
  /^\/api\/buyers\//i,
  /^\/api\/transporters\//i,
];

const normalizePath = (url?: string) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return new URL(trimmed).pathname;
    }
  } catch {
    // fall through to relative parsing
  }
  return trimmed.split('?')[0];
};

const shouldToastForPath = (method?: string, url?: string) => {
  const normalizedMethod = (method || '').toLowerCase();
  if (!mutationMethods.has(normalizedMethod)) return false;
  const path = normalizePath(url);
  if (!path) return false;
  if (noisyActionPathPatterns.some((r) => r.test(path))) return false;
  return importantCrudPathPatterns.some((r) => r.test(path));
};

const humanize = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const fallbackSuccessMessage = (method?: string, url?: string) => {
  const m = (method || '').toLowerCase();
  const rawPath = (url || '').split('?')[0];
  const parts = rawPath
    .split('/')
    .filter(Boolean)
    .filter((p) => p.toLowerCase() !== 'api' && !/^[0-9a-f-]{8,}$/i.test(p))
    .map(humanize);
  const target = parts.slice(-2).join(' ').trim() || 'record';
  const verb = m === 'post' ? 'Created' : m === 'put' || m === 'patch' ? 'Updated' : m === 'delete' ? 'Deleted' : 'Completed';
  return `${verb} ${target} successfully.`;
};

const emitToast = (type: 'success' | 'error', message: string) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rass:toast', { detail: { type, message } }));
};

const extractValidationErrors = (errors: unknown): string | null => {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    const joined = errors.map((e) => String(e)).filter(Boolean).join(', ');
    return joined || null;
  }
  if (typeof errors === 'object') {
    const values = Object.values(errors as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .map((v) => String(v))
      .filter(Boolean);
    if (values.length > 0) return values.join(', ');
  }
  return null;
};

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    if (shouldToastForPath(method, response.config.url)) {
      const payload = response.data;
      const headerMessage = response.headers?.['x-action-message'];
      const explicitMessage =
        (typeof headerMessage === 'string' && headerMessage) ||
        (typeof payload === 'string' && payload) ||
        payload?.message ||
        payload?.title ||
        payload?.detail;
      emitToast('success', explicitMessage || fallbackSuccessMessage(method, response.config.url));
    }
    return response;
  },
  (error) => {
    const method = error?.config?.method?.toLowerCase();
    if (shouldToastForPath(method, error?.config?.url)) {
      const data = error?.response?.data;
      const validationErrors = extractValidationErrors(data?.errors);
      const explicitReason =
        (typeof data === 'string' && data) ||
        data?.message ||
        data?.title ||
        data?.detail ||
        validationErrors ||
        error?.message ||
        'Action failed.';
      emitToast('error', explicitReason);
    }
    return Promise.reject(error);
  },
);

export { api, API_BASE_URL };

