CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,
  pin TEXT NOT NULL,
  name TEXT NOT NULL,
  profile TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_updated ON devices (updated_at);
