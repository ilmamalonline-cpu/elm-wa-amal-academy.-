export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type Guardian = { id: string; display_name: string; locale: 'ar' | 'en'; consent_version: string; consented_at: string }
type Child = { id: string; guardian_id: string; display_name: string; birth_year: number; created_at: string }
type LearningPlan = { child_id: string; guardian_id: string; goal: string; weekly_target_minutes: number; updated_at: string }
type LearningPlanInsert = Omit<LearningPlan, 'updated_at'> & { updated_at?: string }
type PracticeEntry = { id: string; child_id: string; guardian_id: string; activity: string; minutes: number; practiced_on: string; note: string; created_at: string }
type Teacher = { id: string; display_name: string; time_zone: string; status: 'active' | 'suspended'; created_at: string }
type TeacherAssignment = { teacher_id: string; child_id: string; status: 'active' | 'inactive'; created_at: string }
type IndividualLesson = { id: string; teacher_id: string; child_id: string; subject: 'quran' | 'nur_al_bayan' | 'tajweed'; starts_at: string; ends_at: string; time_zone: string; status: 'scheduled' | 'cancelled'; created_at: string; outcome: 'attended_completed' | 'attended_incomplete' | 'absent' | null; follow_up_note: string }
type Admin = { id: string; created_at: string }
type AdminInsert = { id: string; created_at?: string }
type PlatformSettings = { id: boolean; signup_mode: 'owner_only' | 'open' | 'closed'; owner_email: string; updated_at: string }
type TeacherInvite = { id: string; invited_email: string; display_name: string; token_hash: string; created_by: string; created_at: string; expires_at: string; accepted_at: string | null; accepted_user_id: string | null }

export type Database = {
  public: {
    Tables: {
      academy_guardians: Table<Guardian, Guardian, Partial<Guardian>>
      academy_children: Table<Child, Omit<Child, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<Child>>
      academy_learning_plans: Table<LearningPlan, LearningPlanInsert, Partial<LearningPlan>>
      academy_practice_entries: Table<PracticeEntry, Omit<PracticeEntry, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<PracticeEntry>>
      academy_teachers: Table<Teacher, Omit<Teacher, 'created_at'> & { created_at?: string }, Partial<Teacher>>
      academy_teacher_assignments: Table<TeacherAssignment, Omit<TeacherAssignment, 'created_at'> & { created_at?: string }, Partial<TeacherAssignment>>
      academy_individual_lessons: Table<IndividualLesson, Omit<IndividualLesson, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<IndividualLesson>>
      academy_admins: Table<Admin, AdminInsert, Partial<Admin>>
      academy_platform_settings: Table<PlatformSettings, PlatformSettings, Partial<PlatformSettings>>
      academy_teacher_invites: Table<TeacherInvite, Omit<TeacherInvite, 'id' | 'created_at' | 'accepted_at' | 'accepted_user_id'> & { id?: string; created_at?: string; accepted_at?: string | null; accepted_user_id?: string | null }, Partial<TeacherInvite>>
    }
    Views: Record<string, never>
    Functions: {
      academy_is_admin: { Args: Record<string, never>; Returns: boolean }
      academy_is_owner_account: { Args: Record<string, never>; Returns: boolean }
      academy_guardian_session_summaries: { Args: { p_child_id: string; p_offset?: number }; Returns: Pick<IndividualLesson, 'id' | 'child_id' | 'subject' | 'starts_at' | 'ends_at' | 'time_zone' | 'status' | 'outcome' | 'follow_up_note'>[] }
      academy_teacher_roster: { Args: Record<string, never>; Returns: { child_id: string; child_name: string; scheduled_lessons: number }[] }
      academy_accept_teacher_invite: { Args: { p_token: string; p_time_zone?: string }; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type AcademyGuardian = Database['public']['Tables']['academy_guardians']['Row']
export type AcademyChild = Database['public']['Tables']['academy_children']['Row']
export type AcademyTeacher = Database['public']['Tables']['academy_teachers']['Row']
export type AcademyLesson = Database['public']['Tables']['academy_individual_lessons']['Row']
