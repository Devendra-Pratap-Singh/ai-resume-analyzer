BEGIN;

-- Create a table for storing resume analysis history
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own resumes
CREATE POLICY "Users can view their own resumes." ON public.resumes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own resumes
CREATE POLICY "Users can insert their own resumes." ON public.resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own resumes
CREATE POLICY "Users can delete their own resumes." ON public.resumes
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
