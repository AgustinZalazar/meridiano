import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { processVideoReport } from './process-video';
import { supabase } from './supabase';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error('[startup] WEBHOOK_SECRET is not set — webhook endpoint is unprotected. Set it before deploying.');
}

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? false,
  methods: ['GET', 'POST'],
}));

app.use(express.json());

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const POLL_INTERVAL_MS = 15_000;

// Track reports currently being processed to avoid duplicates
const processing = new Set<string>();

// ── Polling loop ────────────────────────────────────────────────────────────
async function pollPendingReports() {
  const { data: reports, error } = await supabase
    .from('reports')
    .select('id')
    .eq('status', 'processing')
    .eq('mode', 'video')
    .not('video_path', 'is', null)
    .limit(5);

  if (error) { console.error('[poll] Supabase error:', error.message); return; }
  if (!reports?.length) return;
  console.log(`[poll] Found ${reports.length} report(s) to process`);

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
app.post('/webhook/report', webhookLimiter, (req, res) => {
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
  setInterval(pollPendingReports, POLL_INTERVAL_MS);
  pollPendingReports();
});
