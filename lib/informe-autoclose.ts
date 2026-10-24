import { supabase } from './supabase';
import { todayIso } from '../utils/dates';

interface StaleReport {
  id: string;
  date: string;
  rubro_id: string;
  rubros: { name: string } | null;
}

interface RawMedia {
  type: 'foto' | 'video';
  uri: string | null;
  video_path: string | null;
  note: string | null;
}

export interface AutoCloseResult {
  processed: { rubroName: string; date: string }[];
  failed: number;
}

export async function autoCloseStaleReports(): Promise<AutoCloseResult> {
  const { data: stale } = await supabase
    .from('reports')
    .select('id, date, rubro_id, rubros(name)')
    .eq('status', 'abierto')
    .lt('date', todayIso());

  if (!stale?.length) return { processed: [], failed: 0 };

  const processed: AutoCloseResult['processed'] = [];
  let failed = 0;

  for (const report of stale as unknown as StaleReport[]) {
    const { data: mediaData } = await supabase
      .from('report_media')
      .select('type, uri, video_path, note')
      .eq('report_id', report.id);

    const media = (mediaData ?? []) as RawMedia[];
    const mediaItems = media
      .filter((m) => m.uri)
      .map((m) => ({
        type: m.type,
        url: m.uri!,
        video_path: m.video_path ?? undefined,
        note: m.note,
      }));

    if (!mediaItems.length) {
      // Empty open report from a previous day → delete it silently
      await supabase.from('reports').delete().eq('id', report.id);
      continue;
    }

    const { error } = await supabase.functions.invoke('process-daily-report', {
      body: { daily_report_id: report.id, media_items: mediaItems },
    });

    if (error) {
      failed++;
    } else {
      const rubroName = report.rubros?.name ?? 'Rubro';
      processed.push({ rubroName, date: report.date });
    }
  }

  return { processed, failed };
}
