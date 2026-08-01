import express from 'express';
import { processVideoReport } from './process-video';
import { supabase } from './supabase';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const POLL_INTERVAL_MS = 15_000;

// Track reports currently being processed to avoid duplicates
const processing = new Set<string>();

// ── Polling loop ────────────────────────────────────────────────────────────
async function pollPendingReports() {
  const { data: reports } = await supabase
    .from('reports')
    .select('id')
    .eq('status', 'processing')
    .eq('mode', 'video')
    .not('video_path', 'is', null)
    .limit(5);

  if (!reports?.length) return;

  for (const { id } of reports) {
    if (processing.has(id)) continue;
    processing.add(id);
    processVideoReport(id)
      .catch((err) => console.error(`[${id}] Unhandled error:`, err))
      .finally(() => processing.delete(id));
  }
}

// ── HTTP endpoints ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', processing: processing.size, ts: new Date().toISOString() });
});

// Optional: Supabase Database Webhook for instant processing
app.post('/webhook/report', (req, res) => {
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { type, record } = req.body as { type: string; record?: { id?: string } };

  if (type !== 'INSERT' || !record?.id) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  res.status(200).json({ ok: true, reportId: record.id });

  if (!processing.has(record.id)) {
    processing.add(record.id);
    processVideoReport(record.id)
      .catch((err) => console.error(`[${record.id}] Unhandled error:`, err))
      .finally(() => processing.delete(record.id!));
  }
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`Meridiano server running on port ${PORT}`);
  // Start polling loop
  setInterval(pollPendingReports, POLL_INTERVAL_MS);
  pollPendingReports(); // run immediately on startup
});
