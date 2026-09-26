import { MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import type { DayRoute } from '../data/planning';
import { byId, clientName } from '../data/selectors';
import { useData } from '../data/store';
import { compose } from '../data/ui';
import { fmtTime, toMin } from '../lib/time';
import { Badge, Button, Modal, Segmented } from './ui';

/** Push remaining ETAs back by N minutes and notify the clients whose window is now at risk. */
export function RunningLateModal({ open, onClose, route }: { open: boolean; onClose: () => void; route?: DayRoute }) {
  const s = useData();
  const [mins, setMins] = useState('20');
  if (!route) return null;
  const remaining = route.appointments.filter((a) => !['completed', 'arrived'].includes(a.status));
  const delay = Number(mins);
  return (
    <Modal open={open} onClose={onClose} title="Running late" footer={<Button onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-slate-600">How far behind are you? VetSet recalculates each remaining stop and flags who will fall outside their window.</p>
      <Segmented value={mins} onChange={setMins} options={['10', '20', '30', '45', '60'].map((m) => ({ value: m, label: `${m} min` }))} className="mb-4" />
      <ul className="space-y-2">
        {remaining.map((a) => {
          const p = route.plan?.stops.find((x) => x.id === a.id);
          const eta = (p?.arrival ?? toMin(a.windowStart)) + delay;
          const late = eta > toMin(a.windowEnd);
          return (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
              <span>
                <span className="font-medium text-slate-900">{clientName(byId(s.clients, a.clientId))}</span>
                <span className="block text-xs text-slate-500">
                  New ETA {fmtTime(eta)} · window ends {fmtTime(a.windowEnd)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {late && <Badge tone="red">Outside window</Badge>}
                <Button
                  size="sm"
                  variant={late ? 'primary' : 'secondary'}
                  icon={MessageSquareText}
                  onClick={() => compose({ clientId: a.clientId, appointmentId: a.id, templateKey: 'running_late', extra: { minutes: delay, eta: fmtTime(eta) } })}
                >
                  Notify
                </Button>
              </span>
            </li>
          );
        })}
        {!remaining.length && <p className="text-sm text-slate-500">No remaining stops today.</p>}
      </ul>
    </Modal>
  );
}
