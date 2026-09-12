// Shared Supabase client. This project is reused from Kid Number
// Adventure (per chat) rather than a new one - see PLAN.md §8.6 and
// update.md Milestone 25 for why, and why every WordSwoop table is
// wordswoop_-prefixed.
//
// URL and publishable key are not secrets (they're meant to ship in
// client code - RLS on wordswoop_profiles is what actually protects
// the data, not hiding these values). Hardcoded here rather than an
// env var since this is a static Vite site with no build-time secret
// injection set up yet; revisit if that changes.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kaeiaiesavwsebyhkgig.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x1XBQ0oiuceE2GBPwxXDzg_jmIfTPvY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
