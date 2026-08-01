-- Add video usage counter to studios
ALTER TABLE studios ADD COLUMN IF NOT EXISTS videos_used_this_period INTEGER NOT NULL DEFAULT 0;

-- Function to increment usage (called when a video report is enqueued)
CREATE OR REPLACE FUNCTION increment_video_usage(p_studio_id uuid)
RETURNS void AS $$
  UPDATE studios
  SET videos_used_this_period = videos_used_this_period + 1
  WHERE id = p_studio_id;
$$ LANGUAGE sql SECURITY DEFINER;
