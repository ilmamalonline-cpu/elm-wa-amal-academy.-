// types/database.ts
// Hand-written to mirror supabase/schema.sql exactly.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          created_at?: string
          updated_at?: string
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
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Update: {
          preferred_days?: number[]
          preferred_hour_slots?: string[]
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
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
          created_at?: string
        }
        Update: {
          start_time?: string
          end_time?: string
          slot_duration_minutes?: number
          session_type?: SessionType
          max_students_group?: number
          is_booked?: boolean
        }
        Relationships: []
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
        Insert: never
        Update: {
          zoom_meeting_id?: string | null
          zoom_join_url?: string | null
          zoom_start_url?: string | null
          status?: BookingStatus
        }
        Relationships: []
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
          created_at?: string
        }
        Update: {
          articulation_notes?: string | null
          tajweed_errors?: TajweedError[]
          homework?: string | null
          rating?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ---- Convenience row aliases ----
export type Profile = Database['public']['Tables']['profiles']['Row']
export type StudentPreferences = Database['public']['Tables']['student_preferences']['Row']
export type TeacherAvailability = Database['public']['Tables']['teacher_availability']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type SessionFeedback = Database['public']['Tables']['session_feedback']['Row']
export type AdminStats = Database['public']['Functions']['get_admin_stats']['Returns'][number]
