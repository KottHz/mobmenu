import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qipdgnizrolzwxnotgqh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcGRnbml6cm9send4bm90Z3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTM0MzEsImV4cCI6MjA3OTQyOTQzMX0.6gPLUg9N9IpLpJWq_nKno9Y2xkpTk1HKHfJhl6jtcQI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

