export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          started_on: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          started_on?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          started_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          department: string
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          organization_id: string
        }
        Insert: {
          created_at?: string
          department: string
          email?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          organization_id: string
        }
        Update: {
          created_at?: string
          department?: string
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_participants: {
        Row: {
          id: string
          interview_id: string
          joined_at: string | null
          left_at: string | null
          role: Database["public"]["Enums"]["participant_role"]
          user_id: string | null
        }
        Insert: {
          id?: string
          interview_id: string
          joined_at?: string | null
          left_at?: string | null
          role: Database["public"]["Enums"]["participant_role"]
          user_id?: string | null
        }
        Update: {
          id?: string
          interview_id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: Database["public"]["Enums"]["participant_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_participants_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          assessment_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          department: string
          duration_seconds: number | null
          elevenlabs_conversation_id: string | null
          end_reason: Database["public"]["Enums"]["end_reason"] | null
          ended_at: string | null
          id: string
          livekit_room: string | null
          organization_id: string
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          template_id: string | null
          title: string
        }
        Insert: {
          assessment_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          department: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          ended_at?: string | null
          id?: string
          livekit_room?: string | null
          organization_id: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          template_id?: string | null
          title: string
        }
        Update: {
          assessment_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          duration_seconds?: number | null
          elevenlabs_conversation_id?: string | null
          end_reason?: Database["public"]["Enums"]["end_reason"] | null
          ended_at?: string | null
          id?: string
          livekit_room?: string | null
          organization_id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          first_used_at: string | null
          id: string
          interview_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          first_used_at?: string | null
          id?: string
          interview_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          first_used_at?: string | null
          id?: string
          interview_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          kind: string
          organization_id: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          kind: string
          organization_id?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          slug: string
          state: string | null
          type: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          slug: string
          state?: string | null
          type?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          slug?: string
          state?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          interview_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          interview_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          interview_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      steward_notes: {
        Row: {
          applied_at: string | null
          at_ms: number | null
          content: string
          created_at: string
          id: string
          interview_id: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          at_ms?: number | null
          content: string
          created_at?: string
          id?: string
          interview_id: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          at_ms?: number | null
          content?: string
          created_at?: string
          id?: string
          interview_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "steward_notes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "steward_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          department: string
          description: string | null
          id: string
          is_published: boolean
          name: string
          questions: Json
          updated_at: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          department: string
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          questions?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          questions?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          interview_id: string
          is_final: boolean
          seq: number
          speaker: Database["public"]["Enums"]["speaker_role"]
          started_at_ms: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interview_id: string
          is_final?: boolean
          seq: number
          speaker: Database["public"]["Enums"]["speaker_role"]
          started_at_ms?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interview_id?: string
          is_final?: boolean
          seq?: number
          speaker?: Database["public"]["Enums"]["speaker_role"]
          started_at_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transcript_entries_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          last_sign_in_at: string | null
          microsoft_oid: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          microsoft_oid?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          last_sign_in_at?: string | null
          microsoft_oid?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_transcript_entry: {
        Args: {
          p_content: string
          p_interview_id: string
          p_is_final?: boolean
          p_speaker: Database["public"]["Enums"]["speaker_role"]
        }
        Returns: string
      }
      audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      create_interview: {
        Args: {
          p_assessment_id: string
          p_contact_id?: string
          p_department: string
          p_scheduled_at: string
          p_team?: Json
          p_template_id?: string
        }
        Returns: string
      }
      finalize_interview: {
        Args: {
          p_actor?: string
          p_failed?: boolean
          p_interview_id: string
          p_reason: Database["public"]["Enums"]["end_reason"]
        }
        Returns: Database["public"]["Enums"]["interview_status"]
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_assigned: { Args: { target_interview: string }; Returns: boolean }
      is_steward: { Args: { target_interview: string }; Returns: boolean }
      issue_invitation: {
        Args: {
          p_expires_at: string
          p_interview_id: string
          p_token_hash: string
        }
        Returns: string
      }
      record_participant_presence: {
        Args: {
          p_actor?: string
          p_interview_id: string
          p_present: boolean
          p_role: Database["public"]["Enums"]["participant_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      revoke_invitation: {
        Args: { p_interview_id: string }
        Returns: undefined
      }
      set_interview_team: {
        Args: { p_interview_id: string; p_team: Json }
        Returns: undefined
      }
      update_transcript_entry: {
        Args: { p_content: string; p_entry_id: string; p_is_final?: boolean }
        Returns: undefined
      }
    }
    Enums: {
      end_reason:
        | "completed"
        | "time_cap"
        | "steward_stopped"
        | "interviewee_left"
        | "inactivity"
        | "error"
      interview_status:
        | "scheduled"
        | "ready"
        | "live"
        | "completed"
        | "cancelled"
        | "failed"
      participant_role: "interviewee" | "steward" | "observer" | "agent"
      speaker_role: "agent" | "interviewee" | "system"
      user_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      end_reason: [
        "completed",
        "time_cap",
        "steward_stopped",
        "interviewee_left",
        "inactivity",
        "error",
      ],
      interview_status: [
        "scheduled",
        "ready",
        "live",
        "completed",
        "cancelled",
        "failed",
      ],
      participant_role: ["interviewee", "steward", "observer", "agent"],
      speaker_role: ["agent", "interviewee", "system"],
      user_role: ["admin", "member"],
    },
  },
} as const
