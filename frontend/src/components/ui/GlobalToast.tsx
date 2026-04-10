import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error';

export default function GlobalToast() {
  const [toast, setToast] = useState<{ id: number; type: ToastKind; message: string } | null>(null);

  useEffect(() => {
    let timeout: number | null = null;
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{ type: ToastKind; message: string }>;
      const detail = custom.detail;
      if (!detail?.message) return;
      const next = { id: Date.now(), type: detail.type || 'success', message: detail.message };
      setToast(next);
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setToast((current) => (current?.id === next.id ? null : current)), 4000);
    };
    window.addEventListener('rass:toast', onToast as EventListener);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener('rass:toast', onToast as EventListener);
    };
  }, []);

  if (!toast) return null;
  const tone = toast.type === 'success'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'border-rose-300 bg-rose-50 text-rose-800';

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] w-[min(420px,calc(100vw-2rem))]">
      <div className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${tone}`}>
        {toast.message}
      </div>
    </div>
  );
}

