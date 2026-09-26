import type { CollectionKey, DataSnapshot, EntityOf, ID, Settings } from './types';

/**
 * Storage boundary. The UI only talks to the zustand store, and the store persists through this
 * interface — so moving from on-device demo data to Supabase means adding a SupabaseRepository
 * (see supabase/schema.sql and README) and changing one line in store.ts.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase';
  readonly label: string;
  load(): Promise<DataSnapshot | null>;
  saveAll(snapshot: DataSnapshot): Promise<void>;
  upsert<K extends CollectionKey>(key: K, item: EntityOf<K>): Promise<void>;
  remove(key: CollectionKey, id: ID): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  /** Fires when data changed elsewhere (another tab, device or user). */
  subscribe(onExternalChange: () => void): () => void;
}
