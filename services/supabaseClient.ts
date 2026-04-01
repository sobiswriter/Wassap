import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://apujwfeeyrruqnaktdsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwdWp3ZmVleXJydXFuYWt0ZHNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODAwNDEsImV4cCI6MjA5MDU1NjA0MX0._xBUyfl4WPn_7X1KfMpO6fjgu61zuMRnf5mX9Nc2b74';

export const supabase = createClient(supabaseUrl, supabaseKey);
