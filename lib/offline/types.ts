export type QueuedOp = {
  opId: string;
  type: 'create_project' | 'create_informe' | 'create_rubro' | 'edit_pendiente';
  payload: Record<string, any>;
  localId: string;
  dependsOn?: string;
  status: 'pending' | 'failed';
  retryCount: number;
  createdAt: number;
};

export type CacheMeta = {
  savedAt: number;
};
