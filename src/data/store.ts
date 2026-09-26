import { create } from 'zustand';
import { LocalRepository } from './localRepository';
import type { Repository } from './repository';
import { DATA_VERSION, generateDemoData } from './seed';
import type { CollectionKey, DataSnapshot, EntityOf, ID, Settings } from './types';
import { nowMinutes, todayStr } from '../lib/time';

export interface DataState extends DataSnapshot {
  ready: boolean;
  backendLabel: string;
}

const empty = (): DataSnapshot => ({
  version: DATA_VERSION,
  settings: {
    businessName: '',
    phone: '',
    email: '',
    windowMins: 120,
    bufferMins: 10,
    tripFeeZones: [],
    outOfAreaFee: 0,
    invoiceDueDays: 14,
  },
  staff: [],
  teams: [],
  clients: [],
  pets: [],
  services: [],
  appointments: [],
  reminders: [],
  communications: [],
  tasks: [],
  invoices: [],
  waitlist: [],
  templates: [],
  checklists: [],
});

export const snapshotOf = (s: DataState): DataSnapshot => {
  const { ready: _r, backendLabel: _b, ...snap } = s;
  return snap;
};

export const useData = create<DataState>(() => ({ ...empty(), ready: false, backendLabel: '' }));

const repo: Repository = new LocalRepository(() => snapshotOf(useData.getState()));

export const initData = async () => {
  let snap = await repo.load();
  if (!snap || snap.version !== DATA_VERSION) {
    snap = generateDemoData(todayStr(), nowMinutes());
    await repo.saveAll(snap);
  }
  useData.setState({ ...snap, ready: true, backendLabel: repo.label });
  repo.subscribe(async () => {
    const next = await repo.load();
    if (next) useData.setState({ ...next });
  });
};

export const resetDemoData = async () => {
  const snap = generateDemoData(todayStr(), nowMinutes());
  useData.setState({ ...snap });
  await repo.saveAll(snap);
};

export const importSnapshot = async (snap: DataSnapshot) => {
  useData.setState({ ...snap });
  await repo.saveAll(snap);
};

// ---- generic CRUD -------------------------------------------------------------------------------

export function upsert<K extends CollectionKey>(key: K, item: EntityOf<K>) {
  useData.setState((s) => {
    const list = s[key] as EntityOf<K>[];
    const i = list.findIndex((x) => x.id === item.id);
    const next = i === -1 ? [...list, item] : list.map((x, j) => (j === i ? item : x));
    return { [key]: next } as Partial<DataState>;
  });
  void repo.upsert(key, item);
}

export function upsertMany<K extends CollectionKey>(key: K, items: EntityOf<K>[]) {
  if (!items.length) return;
  useData.setState((s) => {
    const byId = new Map(items.map((x) => [x.id, x]));
    const list = s[key] as EntityOf<K>[];
    const next = list.map((x) => byId.get(x.id) ?? x);
    const existing = new Set(list.map((x) => x.id));
    items.forEach((x) => !existing.has(x.id) && next.push(x));
    return { [key]: next } as Partial<DataState>;
  });
  items.forEach((x) => void repo.upsert(key, x));
}

export function patch<K extends CollectionKey>(key: K, id: ID, changes: Partial<EntityOf<K>>) {
  const cur = (useData.getState()[key] as EntityOf<K>[]).find((x) => x.id === id);
  if (!cur) return;
  upsert(key, { ...cur, ...changes });
}

export function remove(key: CollectionKey, id: ID) {
  useData.setState((s) => ({ [key]: (s[key] as { id: ID }[]).filter((x) => x.id !== id) }) as Partial<DataState>);
  void repo.remove(key, id);
}

export function updateSettings(changes: Partial<Settings>) {
  const settings = { ...useData.getState().settings, ...changes };
  useData.setState({ settings });
  void repo.saveSettings(settings);
}
