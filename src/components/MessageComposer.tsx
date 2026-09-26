import { Copy, Mail, MessageSquareText, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Channel } from '../data/types';
import { renderTemplate, sendMessage } from '../data/actions';
import { byId, clientName } from '../data/selectors';
import { useData } from '../data/store';
import { toast, type ComposeRequest } from '../data/ui';
import { mailHref, smsHref } from '../lib/format';
import { Button, Field, Modal, Segmented, Select, Textarea } from './ui';

/**
 * Compose from a template, then hand off to the device's Messages / Mail app (demo), or just log it.
 * In production this is where Twilio / SendGrid sends automatically.
 */
export function MessageComposer({ request, onClose }: { request: ComposeRequest | null; onClose: () => void }) {
  const s = useData();
  const client = request ? byId(s.clients, request.clientId) : undefined;
  const [tplId, setTplId] = useState<string>('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!request) return;
    const tpl = s.templates.find((t) => t.key === request.templateKey) ?? s.templates[0];
    setTplId(tpl?.id ?? '');
    setChannel(client?.preferredContact === 'email' ? 'email' : 'sms');
    setBody(renderTemplate(tpl, request));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request || !client) return null;
  const tpl = s.templates.find((t) => t.id === tplId);

  const log = () => {
    sendMessage({ clientId: client.id, appointmentId: request.appointmentId, channel, subject: tpl?.name ?? 'Message', body });
    request.onSent?.();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Message ${clientName(client)}`}
      footer={
        <>
          <Button
            variant="ghost"
            icon={Copy}
            onClick={() => {
              void navigator.clipboard?.writeText(body);
              toast('Copied to clipboard', 'info');
            }}
          >
            Copy
          </Button>
          <Button
            onClick={() => {
              log();
              toast('Logged as sent');
              onClose();
            }}
          >
            Log as sent
          </Button>
          {channel === 'sms' ? (
            <a
              href={smsHref(client.phone, body)}
              onClick={() => {
                log();
                onClose();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Send className="size-4" /> Open in Messages
            </a>
          ) : (
            <a
              href={mailHref(client.email, tpl?.name ?? s.settings.businessName, body)}
              onClick={() => {
                log();
                onClose();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
            >
              <Mail className="size-4" /> Open email
            </a>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Template" className="min-w-48 flex-1">
            <Select
              value={tplId}
              onChange={(e) => {
                setTplId(e.target.value);
                setBody(renderTemplate(s.templates.find((t) => t.id === e.target.value), request));
              }}
            >
              {s.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Segmented
            value={channel === 'email' ? 'email' : 'sms'}
            onChange={(v) => setChannel(v)}
            options={[
              { value: 'sms', label: <span className="flex items-center gap-1.5"><MessageSquareText className="size-4" /> Text</span> },
              { value: 'email', label: <span className="flex items-center gap-1.5"><Mail className="size-4" /> Email</span> },
            ]}
          />
        </div>
        <Field label={`To: ${channel === 'sms' ? client.phone : client.email}`} hint={`${body.length} characters${channel === 'sms' && body.length > 160 ? ` · ${Math.ceil(body.length / 153)} SMS segments` : ''}`}>
          <Textarea value={body} rows={6} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Demo mode: messages open in this device’s Messages or Mail app and are logged to the client’s history. Connect an SMS/email provider later to send automatically.
        </p>
      </div>
    </Modal>
  );
}
