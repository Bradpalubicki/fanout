-- Fanout Execution Engine tables
-- Turns outputs from other engines into published, distributed, tracked content

CREATE TABLE IF NOT EXISTS fanout_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text DEFAULT 'queued',
  agency_id text,
  client_id text NOT NULL,
  client_name text,
  website text,
  vertical text,
  city text,
  audit_score integer,
  compliance_risk text,
  source_engine text,
  source_id text,
  platforms jsonb DEFAULT '[]',
  posts jsonb DEFAULT '[]',
  retry_count integer DEFAULT 0,
  scheduled_at timestamptz,
  published_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fanout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES fanout_jobs(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  event_type text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_fanout_jobs_client ON fanout_jobs(client_id, status);
CREATE INDEX IF NOT EXISTS idx_fanout_jobs_source ON fanout_jobs(source_engine, source_id);
CREATE INDEX IF NOT EXISTS idx_fanout_events_client ON fanout_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fanout_events_job ON fanout_events(job_id);

-- RLS policies (service role bypass for API routes)
ALTER TABLE fanout_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fanout_events ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_fanout_jobs" ON fanout_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_fanout_events" ON fanout_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
