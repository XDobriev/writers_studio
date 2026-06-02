import { createRepository } from './repository';

export type ConnectionStyle = 'road' | 'river' | 'path' | 'border';

export interface LocationConnection {
  id: string;
  book_id: string;
  user_id: string;
  from_id: string;
  to_id: string;
  label: string;
  style: ConnectionStyle;
  created_at: string;
}

export type ConnectionPatch = Partial<Pick<LocationConnection, 'label' | 'style'>>;

export const CONNECTION_STYLES: Record<ConnectionStyle, {
  label: string;
  stroke: string;
  width: number;
  dash: string;
}> = {
  road:   { label: 'Дорога',  stroke: 'var(--accent-2)', width: 2,   dash: '6 4' },
  river:  { label: 'Река',    stroke: 'oklch(0.65 0.10 200)', width: 2.5, dash: '' },
  path:   { label: 'Тропа',   stroke: 'var(--ink-4)',    width: 1.5, dash: '4 5' },
  border: { label: 'Граница', stroke: 'var(--ink-3)',    width: 2,   dash: '8 3' },
};

const repo = createRepository<LocationConnection>(
  'location_connections',
  {},
  [{ column: 'created_at', ascending: true }],
);

export function listConnections(bookId: string): Promise<LocationConnection[]> {
  return repo.list(bookId);
}

export function createConnection(
  bookId: string,
  userId: string,
  fromId: string,
  toId: string,
): Promise<LocationConnection> {
  return repo.create(bookId, userId, { from_id: fromId, to_id: toId });
}

export function updateConnection(id: string, patch: ConnectionPatch): Promise<LocationConnection> {
  return repo.update(id, patch as Record<string, unknown>);
}

export function deleteConnection(id: string): Promise<void> {
  return repo.delete(id);
}
