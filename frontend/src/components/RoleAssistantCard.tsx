import { useState } from 'react';
import { api } from '../api/client';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';

interface RoleAssistantCardProps {
  title: string;
  intro: string;
  placeholder?: string;
}

export const RoleAssistantCard = ({ title, intro, placeholder = 'Ask AI Assistant...' }: RoleAssistantCardProps) => {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: intro },
  ]);

  const askAssistant = async () => {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    try {
      const res = await api.post('/api/aichat/query', { message: q });
      const answer = String(res.data?.response || res.data?.answer || t('shared.no_answer_generated', 'No answer generated.'));
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: t('shared.assistant_unavailable', 'Assistant is temporarily unavailable. Please retry.') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <div className="mt-3 h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {messages.map((m, idx) => (
          <div key={idx} className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
            {m.text}
          </div>
        ))}
        {loading && <p className="text-xs text-slate-500">{t('shared.thinking', 'Thinking...')}</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          placeholder={placeholder}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              askAssistant();
            }
          }}
        />
        <Button onClick={askAssistant} disabled={loading || !question.trim()}>{t('shared.ask_ai', 'Ask AI')}</Button>
      </div>
    </Card>
  );
};
