import 'dotenv/config';
import express from 'express';
import { processVideoReport } from './process-video';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Supabase Database Webhook — fires on INSERT into reports
app.post('/webhook/report', (req, res) => {
  // Validate secret header if configured
  if (WEBHOOK_SECRET) {
    const sig = req.headers['x-webhook-secret'];
    if (sig !== WEBHOOK_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const { type, record } = req.body as { type: string; record?: { id?: string } };

  if (type !== 'INSERT' || !record?.id) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  // Respond immediately so Supabase doesn't retry
  res.status(200).json({ ok: true, reportId: record.id });

  // Process asynchronously
  processVideoReport(record.id).catch((err) =>
    console.error('Unhandled error in processVideoReport:', err)
  );
});

const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`Meridiano server running on port ${PORT}`);
});
