import { useEffect, useState } from 'react';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { FileText, MessageSquare } from 'lucide-react';
import { encodeFileToPayload, type EncodedFileUpload } from '../utils/fileUpload';

type Tab = 'status' | 'messages' | 'documents';

export const ApplicantDashboardPage = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [application, setApplication] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [doc, setDoc] = useState<{ documentName: string; file: EncodedFileUpload | null }>({ documentName: '', file: null });
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    const res = await api.get('/api/applications/me').catch(() => ({ data: null }));
    setApplication(res.data);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    await api.post('/api/applications/me/messages', { message });
    setMessage('');
    setFeedback('Message sent.');
    await load();
  };
  const upload = async () => {
    if (!doc.file) return;
    await api.post('/api/applications/me/documents', {
      documentName: doc.documentName,
      fileName: doc.file.fileName,
      contentType: doc.file.contentType,
      base64Content: doc.file.base64Content,
    });
    setDoc({ documentName: '', file: null });
    setFeedback('Document uploaded.');
    await load();
  };

  return (
    <DashboardShell
      brand="RASS Applicant"
      subtitle="Application workflow"
      title="Applicant dashboard"
      activeKey={activeTab}
      navItems={[
        { key: 'status', label: 'Status', icon: <FileText className="h-4 w-4" /> },
        { key: 'messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
        { key: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
      ]}
      onNavChange={(k) => setActiveTab(k as Tab)}
      onLogout={logout}
      rightStatus={application?.status || 'Pending'}
    >
      <div className="space-y-6">
        {activeTab === 'status' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Application status</h3>
            {!application ? <p className="mt-3 text-sm text-slate-500">No application found.</p> : (
              <div className="mt-3 space-y-2 text-sm">
                <p><span className="font-semibold">Role:</span> {application.targetRole}</p>
                <p><span className="font-semibold">Status:</span> {application.status}</p>
                <p><span className="font-semibold">Admin note:</span> {application.adminNote || '—'}</p>
              </div>
            )}
          </Card>
        )}
        {activeTab === 'messages' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Messages</h3>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {(application?.messages || []).map((m: any) => (
                <div key={m.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <p className="font-semibold">{m.senderType} • {m.senderName}</p>
                  <p className="text-slate-600">{m.message}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input label="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
              <Button onClick={send} disabled={!message.trim()}>Send</Button>
            </div>
          </Card>
        )}
        {activeTab === 'documents' && (
          <Card className="p-5">
            <h3 className="text-lg font-black text-slate-900">Documents</h3>
            <div className="mt-3 space-y-2">
              {(application?.documents || []).map((d: any) => (
                <div key={d.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <p className="font-semibold">{d.documentName}</p>
                  <a className="text-emerald-700 underline" href={d.documentUrl} target="_blank" rel="noreferrer">{d.originalFileName || d.documentUrl}</a>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Document name" value={doc.documentName} onChange={(e) => setDoc((p) => ({ ...p, documentName: e.target.value }))} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">File</span>
                <input
                  className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={async (e) => {
                    const nextFile = e.target.files?.[0];
                    setDoc((p) => ({ ...p, file: nextFile ? null : p.file }));
                    if (!nextFile) return;
                    const encoded = await encodeFileToPayload(nextFile);
                    setDoc((p) => ({ ...p, file: encoded }));
                  }}
                />
                {doc.file && <p className="mt-1 text-xs text-slate-500">{doc.file.fileName}</p>}
              </label>
            </div>
            <div className="mt-3"><Button onClick={upload} disabled={!doc.documentName.trim() || !doc.file}>Upload document</Button></div>
          </Card>
        )}
        {feedback && <p className="text-xs font-semibold text-emerald-700">{feedback}</p>}
      </div>
    </DashboardShell>
  );
};
