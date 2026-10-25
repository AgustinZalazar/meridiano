export type QueuedOp = {
  opId: string;
  type:
    | 'create_project'
    | 'create_report'
    | 'create_rubro'
    | 'update_pendiente_status'
    | 'add_report_media_foto'
    | 'add_report_media_video';
  payload: Record<string, any>;
  localId: string;
  dependsOn?: string;
  status: 'pending' | 'failed';
  retryCount: number;
  createdAt: number;
};

export const OFFLINE_MEDIA_DIR = 'offline-media/';

export type CacheMeta = {
  savedAt: number;
};
