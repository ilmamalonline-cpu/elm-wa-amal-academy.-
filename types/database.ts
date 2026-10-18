// types/database.ts
//
// Hand-written to mirror supabase/schema.sql. If you change the SQL schema,
// update this file to match — or regenerate it once your project is linked:
//   npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
// (review the diff first; the generated file won't include the convenience
// aliases at the bottom).
//
// NOTE: `Database` must be a `type` alias (not an `interface`) and each table
// needs `Relationships`, plus the schema needs `Views`/`Enums`/
// `CompositeTypes` — current supabase-js uses those to type queries.
// Interfaces have no implicit index signature, which makes supabase-js
// resolve every query result to `never`.

export type UserRole = 'admin' | 'teacher' | 'student'
export type SessionType = 'individual' | 'group'
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type RecurrencePattern = 'none' | 'weekly' | 'biweekly'

export type TajweedError = {
  letter: string
  error_type: string
  correction: string
}

type ProfileRow = {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  bio: string | null
  price_per_session: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type StudentPreferencesRow = {
  id: string
  student_id: string
  preferred_days: number[]
  preferred_hour_slots: string[]
  notes: string | null
  updated_at: string
}

type TeacherAvailabilityRow = {
  id: string
  teacher_id: string
  week_start_date: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  session_type: SessionType
  max_students_group: number
  is_booked: boolean
  /** Soft-closed by the teacher (kept, not deleted, because past bookings reference it). */
  is_closed: boolean
  created_at: string
}

// NOTE: there is deliberately no `zoom_start_url` here. The host link is
// fetched on demand by /api/bookings/start (see lib/zoom/client.ts).
type BookingRow = {
  id: string
  student_id: string
  teacher_id: string
  availability_slot_id: string
  session_type: SessionType
  scheduled_date: string
  day_of_week: number
  time_slot: string
  duration_minutes: number
  status: BookingStatus
  zoom_meeting_id: string | null
  zoom_join_url: string | null
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern
  recurrence_end_date: string | null
  parent_booking_id: string | null
  created_at: string
  updated_at: string
}

type SessionFeedbackRow = {
  id: string
  booking_id: string
  /** Which occurrence this feedback is for (a recurring booking has many). */
  session_date: string
  teacher_id: string
  student_id: string
  articulation_notes: string | null
  tajweed_errors: TajweedError[]
  homework: string | null
  rating: number | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: {
          id: string
          email: string
          full_name: string
          role?: UserRole
          phone?: string | null
          avatar_url?: string | null
          bio?: string | null
          price_per_session?: number | null
          is_active?: boolean
        }
        Update: {
          email?: string
          full_name?: string
          role?: UserRole
          phone?: string | null
          avatar_url?: string | null
          bio?: string | null
          price_per_session?: number | null
          is_active?: boolean
        }
        Relationships: []
      }
      student_preferences: {
        Row: StudentPreferencesRow
        Insert: {
          id?: string
          student_id: string
          preferred_days?: number[]
          preferred_hour_slots?: string[]
          notes?: string | null
        }
        Update: {
          preferred_days?: number[]
          preferred_hour_slots?: string[]
          notes?: string | null
        }
        Relationships: []
      }
      teacher_availability: {
        Row: TeacherAvailabilityRow
        Insert: {
          id?: string
          teacher_id: string
          week_start_date: string
          day_of_week: number
          start_time: string
          end_time: string
          slot_duration_minutes?: number
          session_type?: SessionType
          max_students_group?: number
          is_booked?: boolean
          is_closed?: boolean
        }
        Update: {
          start_time?: string
          end_time?: string
          slot_duration_minutes?: number
          session_type?: SessionType
          max_students_group?: number
          is_booked?: boolean
          is_closed?: boolean
        }
        Relationships: []
      }
      bookings: {
        Row: BookingRow
        // Bookings have no direct insert policy — created exclusively via
        // the book_slot() RPC. See supabase/schema.sql.
        Insert: never
        Update: {
          zoom_meeting_id?: string | null
          zoom_join_url?: string | null
          status?: BookingStatus
        }
        Relationships: []
      }
      session_feedback: {
        Row: SessionFeedbackRow
        // Feedback is written only through submit_session_feedback().
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      book_slot: {
        Args: {
          p_slot_id: string
          p_recurring?: boolean
          p_recurrence_pattern?: RecurrencePattern
          p_recurrence_end_date?: string | null
        }
        Returns: BookingRow
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: BookingRow
      }
      submit_session_feedback: {
        Args: {
          p_booking_id: string
          p_session_date: string
          p_articulation_notes?: string | null
          p_tajweed_errors?: TajweedError[]
          p_homework?: string | null
          p_rating?: number | null
        }
        Returns: SessionFeedbackRow
      }
      get_admin_stats: {
        Args: Record<string, never>
        Returns: {
          active_teachers: number
          active_students: number
          sessions_today: number
          upcoming_confirmed: number
        }[]
      }
    }
    Enums: {
      user_role: UserRole
      session_type: SessionType
      booking_status: BookingStatus
      recurrence_pattern: RecurrencePattern
    }
    CompositeTypes: { [_ in never]: never }
  }
}

// ---- Convenience row aliases used throughout the app ----
export type Profile = Database['public']['Tables']['profiles']['Row']
export type StudentPreferences = Database['public']['Tables']['student_preferences']['Row']
export type TeacherAvailability = Database['public']['Tables']['teacher_availability']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type SessionFeedback = Database['public']['Tables']['session_feedback']['Row']
export type AdminStats = Database['public']['Functions']['get_admin_stats']['Returns'][number]
