import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ID, MessageTemplate } from './types';

export interface ComposeRequest {
  clientId: ID;
  appointmentId?: ID;
  petIds?: ID[];
  templateKey?: MessageTemplate['key'];
  extra?: Record<string, string | number>;
  onSent?: () => void;
}

export type Role = 'office' | 'doctor' | 'driver';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  action?: { label: string; to: string };
}

interface UiState {
  role: Role;
  actingTeamId: ID;
  appointmentId?: ID;
  compose: ComposeRequest | null;
  toasts: Toast[];
  setRole: (role: Role) => void;
  setActingTeam: (id: ID) => void;
  openAppointment: (id?: ID) => void;
  openCompose: (req: ComposeRequest | null) => void;
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      role: 'office',
      actingTeamId: 'team_west',
      toasts: [],
      compose: null,
      openCompose: (compose) => set({ compose }),
      setRole: (role) => set({ role }),
      setActingTeam: (actingTeamId) => set({ actingTeamId }),
      openAppointment: (appointmentId) => set({ appointmentId }),
      toast: (message, tone = 'success', action) => {
        const id = ++toastId;
        set({ toasts: [...get().toasts, { id, message, tone, action }] });
        setTimeout(() => get().dismissToast(id), action ? 7000 : 4000);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    { name: 'vetset:ui', partialize: (s) => ({ role: s.role, actingTeamId: s.actingTeamId }) },
  ),
);

export const toast = (...args: Parameters<UiState['toast']>) => useUi.getState().toast(...args);
export const compose = (req: ComposeRequest) => useUi.getState().openCompose(req);
