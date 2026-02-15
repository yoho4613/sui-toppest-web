import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for browser (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Types for database tables
export interface UserProfile {
  id: string;
  wallet_address: string;
  nickname: string | null;
  avatar_url: string | null;
  email: string | null; // For wallet users (manual input)
  google_email: string | null;
  google_name: string | null;
  google_picture: string | null;
  google_sub: string | null;
  auth_method: 'wallet' | 'zklogin';
  created_at: string;
  updated_at: string;
}

export interface ZkLoginSalt {
  id: string;
  google_sub: string;
  salt: string;
  email: string | null;
  created_at: string;
}

export interface GameRecord {
  id: string;
  user_id: string;
  wallet_address: string;
  game_type: string;
  score: number;
  distance: number;
  time_ms: number;
  luck_earned: number;
  club_earned: number;
  season_id: number | null;
  played_at: string;

  // Game metadata for analytics & anti-cheat
  fever_count: number | null;
  perfect_count: number | null;
  coin_count: number | null;
  potion_count: number | null;
  difficulty: string | null;

  // Session & anti-cheat tracking
  session_token: string | null;
  session_start_time: string | null;
  session_duration_ms: number | null;
  validation_warnings: string[] | null;

  // Client info for abuse detection
  client_info: {
    user_agent?: string;
    platform?: string;
    screen_width?: number;
    screen_height?: number;
    device_pixel_ratio?: number;
    timezone?: string;
  } | null;
}

export interface DailyTicket {
  id: string;
  wallet_address: string;
  game_type: string;
  date: string; // YYYY-MM-DD format
  tickets_used: number;
  max_tickets: number;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  game_type: string;
  season_id: number | null;
  wallet_address: string;
  display_name: string;
  avatar_url: string | null;
  high_score: number;
  total_luck: number;
  total_club: number;
  games_played: number;
}
