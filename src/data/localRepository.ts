import type { Repository } from './repository';
import type { DataSnapshot } from './types';

const KEY = 'vetset:data:v1';

/** On-device persistence (localStorage). Writes the whole snapshot, debounced; syncs across tabs. */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  readonly label = 'This device (demo)';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private getSnapshot: () => DataSnapshot;

  constructor(getSnapshot: () => DataSnapshot) {
    this.getSnapshot = getSnapshot;
  }

  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as DataSnapshot) : null;
    } catch {
      return null;
    }
  }

  async saveAll(snapshot: DataSnapshot) {
    clearTimeout(this.timer);
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('VetSet: could not save data locally', e);
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.saveAll(this.getSnapshot()), 150);
  }

  async upsert() {
    this.schedule();
  }
  async remove() {
    this.schedule();
  }
  async saveSettings() {
    this.schedule();
  }

  subscribe(onExternalChange: () => void) {
    const h = (e: StorageEvent) => {
      if (e.key === KEY) onExternalChange();
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }
}
