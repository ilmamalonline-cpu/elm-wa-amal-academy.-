// types/database.ts
// Hand-written to mirror supabase/schema.sql exactly. If you change the SQL
// schema, update this file to match. Once your project is linked to the
// Supabase CLI you can also regenerate this with:
//   npx supabase gen types typescript --project-id fotjpqvwxcygakvnirtz > types/database.ts
// (review the diff before committing — the generated file won't include the
// hand-written convenience aliases at the bottom).

export type UserRole = 'admin' | 'teacher' | 'student'
export type SessionType = 'individual' | 'group'
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type RecurrencePattern = 'none' | 'weekly' | 'biweekly'

export interface TajweedError {
  letter: string
  error_type: string
  correction: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
      }
      student_preferences: {
        Row: {
          id: string
          student_id: string
          preferred_days: number[]
          preferred_hour_slots: string[]
          notes: string | null
          updated_at: string
        }
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
      }
      teacher_availability: {
        Row: {
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
          created_at: string
        }
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
        }
        Update: {
          start_time?: string
          end_time?: string
          slot_duration_minutes?: number
          session_type?: SessionType
          max_students_group?: number
          is_booked?: boolean
        }
      }
      bookings: {
        Row: {
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
          zoom_start_url: string | null
          is_recurring: boolean
          recurrence_pattern: RecurrencePattern
          recurrence_end_date: string | null
          parent_booking_id: string | null
          created_at: string
          updated_at: string
        }
        // Bookings have no direct insert policy — created exclusively via
        // the book_slot() RPC. See supabase/schema.sql.
        Insert: never
        Update: {
          zoom_meeting_id?: string | null
          zoom_join_url?: string | null
          zoom_start_url?: string | null
          status?: BookingStatus
        }
      }
      session_feedback: {
        Row: {
          id: string
          booking_id: string
          teacher_id: string
          student_id: string
          articulation_notes: string | null
          tajweed_errors: TajweedError[]
          homework: string | null
          rating: number | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          teacher_id: string
          student_id: string
          articulation_notes?: string | null
          tajweed_errors?: TajweedError[]
          homework?: string | null
          rating?: number | null
        }
        Update: {
          articulation_notes?: string | null
          tajweed_errors?: TajweedError[]
          homework?: string | null
          rating?: number | null
        }
      }
    }
    Functions: {
      book_slot: {
        Args: {
          p_slot_id: string
          p_recurring?: boolean
          p_recurrence_pattern?: RecurrencePattern
          p_recurrence_end_date?: string | null
        }
        Returns: Database['public']['Tables']['bookings']['Row']
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: Database['public']['Tables']['bookings']['Row']
      }
      mark_booking_completed: {
        Args: { p_booking_id: string }
        Returns: Database['public']['Tables']['bookings']['Row']
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
  }
}

// ---- Convenience row aliases used throughout the app ----
export type Profile = Database['public']['Tables']['profiles']['Row']
export type StudentPreferences = Database['public']['Tables']['student_preferences']['Row']
export type TeacherAvailability = Database['public']['Tables']['teacher_availability']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type SessionFeedback = Database['public']['Tables']['session_feedback']['Row']
export type AdminStats = Database['public']['Functions']['get_admin_stats']['Returns'][number]
