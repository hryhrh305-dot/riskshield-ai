CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_user_created_at
  ON feedback_messages (user_id, created_at DESC);

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_messages'
      AND policyname = 'Users insert own feedback messages'
  ) THEN
    CREATE POLICY "Users insert own feedback messages"
      ON feedback_messages
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'feedback_messages'
      AND policyname = 'Users read own feedback messages'
  ) THEN
    CREATE POLICY "Users read own feedback messages"
      ON feedback_messages
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
