export const Loader = ({ label = 'Loading...' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
    <span className="text-sm font-medium">{label}</span>
  </div>
);

