export type QueuedOp = {
  opId: string;
  type:
    | 'create_project'
    | 'create_report'
    | 'create_rubro'
    | 'update_pendiente_status';
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
