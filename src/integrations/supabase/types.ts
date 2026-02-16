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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_trade_notes: {
        Row: {
          admin_id: string
          created_at: string
          execution_id: string
          id: string
          is_valid: boolean | null
          note: string | null
          updated_at: string
          verification_request_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          execution_id: string
          id?: string
          is_valid?: boolean | null
          note?: string | null
          updated_at?: string
          verification_request_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          execution_id?: string
          id?: string
          is_valid?: boolean | null
          note?: string | null
          updated_at?: string
          verification_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_trade_notes_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "user_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_trade_notes_verification_request_id_fkey"
            columns: ["verification_request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          created_at: string
          cycle_number: number
          description: string | null
          id: string
          name: string
          phase: number
          total_trades: number
          trade_end: number
          trade_start: number
        }
        Insert: {
          created_at?: string
          cycle_number: number
          description?: string | null
          id?: string
          name: string
          phase: number
          total_trades: number
          trade_end: number
          trade_start: number
        }
        Update: {
          created_at?: string
          cycle_number?: number
          description?: string | null
          id?: string
          name?: string
          phase?: number
          total_trades?: number
          trade_end?: number
          trade_start?: number
        }
        Relationships: []
      }
      early_access_settings: {
        Row: {
          button_key: string
          button_label: string
          button_url: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          button_key: string
          button_label?: string
          button_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          button_key?: string
          button_label?: string
          button_url?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          frozen_at: string | null
          frozen_by: string | null
          id: string
          status: Database["public"]["Enums"]["user_status"]
          status_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          status_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          status_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_path: string
          result_type: string | null
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path: string
          result_type?: string | null
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string
          result_type?: string | null
          sort_order?: number
          title?: string | null
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          device_info: string | null
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          device_info?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          device_info?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          comment: string | null
          created_at: string
          day_of_week: string
          direction: string
          direction_structure: string | null
          entry_model: string | null
          entry_time: string | null
          entry_timing: string | null
          exit_time: string | null
          id: string
          news_day: boolean | null
          news_label: string | null
          rr: number | null
          screenshot_m1: string | null
          screenshot_m15_m5: string | null
          setup_type: string | null
          speculation_hl_valid: boolean | null
          stop_loss_points: string | null
          stop_loss_size: string | null
          target_hl_valid: boolean | null
          target_timing: string | null
          trade_date: string
          trade_duration: string | null
          trade_number: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          day_of_week: string
          direction: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_time?: string | null
          entry_timing?: string | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          rr?: number | null
          screenshot_m1?: string | null
          screenshot_m15_m5?: string | null
          setup_type?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss_points?: string | null
          stop_loss_size?: string | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          trade_date: string
          trade_duration?: string | null
          trade_number: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          day_of_week?: string
          direction?: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_time?: string | null
          entry_timing?: string | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          rr?: number | null
          screenshot_m1?: string | null
          screenshot_m15_m5?: string | null
          setup_type?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss_points?: string | null
          stop_loss_size?: string | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          trade_date?: string
          trade_duration?: string | null
          trade_number?: number
          user_id?: string
        }
        Relationships: []
      }
      user_custom_variables: {
        Row: {
          created_at: string
          id: string
          user_id: string
          variable_type: string
          variable_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          variable_type: string
          variable_value: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          variable_type?: string
          variable_value?: string
        }
        Relationships: []
      }
      user_cycles: {
        Row: {
          admin_feedback: string | null
          completed_at: string | null
          completed_trades: number | null
          created_at: string
          cycle_id: string
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["cycle_status"] | null
          total_rr: number | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_feedback?: string | null
          completed_at?: string | null
          completed_trades?: number | null
          created_at?: string
          cycle_id: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["cycle_status"] | null
          total_rr?: number | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_feedback?: string | null
          completed_at?: string | null
          completed_trades?: number | null
          created_at?: string
          cycle_id?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["cycle_status"] | null
          total_rr?: number | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_cycles_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_executions: {
        Row: {
          created_at: string
          direction: string
          direction_structure: string | null
          entry_model: string | null
          entry_price: number | null
          entry_time: string | null
          entry_timeframe: string | null
          entry_timing: string | null
          exit_date: string | null
          exit_price: number | null
          exit_time: string | null
          id: string
          notes: string | null
          result: string | null
          rr: number | null
          screenshot_entry_url: string | null
          screenshot_url: string | null
          setup_type: string | null
          stop_loss: number | null
          take_profit: number | null
          trade_date: string
          trade_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_price?: number | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          rr?: number | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date: string
          trade_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_price?: number | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          rr?: number | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_date?: string
          trade_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_followups: {
        Row: {
          call_done: boolean | null
          contact_date: string
          contacted_by: string | null
          correct_actions: boolean | null
          created_at: string
          day_number: number
          id: string
          is_blocked: boolean | null
          message_sent: boolean | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_done?: boolean | null
          contact_date: string
          contacted_by?: string | null
          correct_actions?: boolean | null
          created_at?: string
          day_number: number
          id?: string
          is_blocked?: boolean | null
          message_sent?: boolean | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_done?: boolean | null
          contact_date?: string
          contacted_by?: string | null
          correct_actions?: boolean | null
          created_at?: string
          day_number?: number
          id?: string
          is_blocked?: boolean | null
          message_sent?: boolean | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          sender_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          sender_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_personal_trades: {
        Row: {
          chart_link: string | null
          comment: string | null
          created_at: string
          day_of_week: string
          direction: string
          direction_structure: string | null
          entry_model: string | null
          entry_price: number | null
          entry_time: string | null
          entry_timeframe: string | null
          entry_timing: string | null
          exit_date: string | null
          exit_price: number | null
          exit_time: string | null
          id: string
          news_day: boolean | null
          news_label: string | null
          result: string | null
          rr: number | null
          screenshot_context_url: string | null
          screenshot_entry_url: string | null
          screenshot_url: string | null
          setup_type: string | null
          speculation_hl_valid: boolean | null
          stop_loss: number | null
          stop_loss_size: string | null
          take_profit: number | null
          target_hl_valid: boolean | null
          target_timing: string | null
          trade_date: string
          trade_duration: string | null
          trade_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chart_link?: string | null
          comment?: string | null
          created_at?: string
          day_of_week: string
          direction: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_price?: number | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          result?: string | null
          rr?: number | null
          screenshot_context_url?: string | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          trade_date: string
          trade_duration?: string | null
          trade_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chart_link?: string | null
          comment?: string | null
          created_at?: string
          day_of_week?: string
          direction?: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_price?: number | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          result?: string | null
          rr?: number | null
          screenshot_context_url?: string | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          trade_date?: string
          trade_duration?: string | null
          trade_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_quest_flags: {
        Row: {
          completed_at: string
          flag_key: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          flag_key: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          flag_key?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          device_info: string | null
          id: string
          session_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          device_info?: string | null
          id?: string
          session_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          device_info?: string | null
          id?: string
          session_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_successes: {
        Row: {
          created_at: string
          id: string
          image_path: string
          linked_trade_id: string | null
          message: string | null
          success_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          linked_trade_id?: string | null
          message?: string | null
          success_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          linked_trade_id?: string | null
          message?: string | null
          success_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_successes_linked_trade_id_fkey"
            columns: ["linked_trade_id"]
            isOneToOne: false
            referencedRelation: "user_personal_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trade_analyses: {
        Row: {
          analyzed_at: string
          id: string
          trade_number: number
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          id?: string
          trade_number: number
          user_id: string
        }
        Update: {
          analyzed_at?: string
          id?: string
          trade_number?: number
          user_id?: string
        }
        Relationships: []
      }
      user_variable_types: {
        Row: {
          created_at: string
          id: string
          type_key: string
          type_label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          type_key: string
          type_label: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          type_key?: string
          type_label?: string
          user_id?: string
        }
        Relationships: []
      }
      user_video_views: {
        Row: {
          id: string
          user_id: string
          video_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          admin_comments: string | null
          created_at: string
          cycle_id: string
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_cycle_id: string
          user_id: string
        }
        Insert: {
          admin_comments?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_cycle_id: string
          user_id: string
        }
        Update: {
          admin_comments?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_cycle_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_cycle_id_fkey"
            columns: ["user_cycle_id"]
            isOneToOne: false
            referencedRelation: "user_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          embed_url: string
          id: string
          open_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_url: string
          id?: string
          open_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_url?: string
          id?: string
          open_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_access: { Args: never; Returns: boolean }
      check_cycle_accuracy_and_auto_validate: {
        Args: { p_cycle_id: string; p_user_cycle_id: string; p_user_id: string }
        Returns: number
      }
      get_leaderboard_data: {
        Args: never
        Returns: {
          data_count: number
          display_name: string
          success_count: number
          user_id: string
        }[]
      }
      get_user_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_user_cycles: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      initialize_user_followups: {
        Args: { p_start_date?: string; p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_early_access: { Args: never; Returns: boolean }
      is_institute: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      unlock_next_cycle: {
        Args: { p_current_cycle_number: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "member"
        | "early_access"
        | "institute"
      cycle_status:
        | "locked"
        | "in_progress"
        | "pending_review"
        | "validated"
        | "rejected"
      user_status: "active" | "frozen" | "banned" | "pending"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["super_admin", "admin", "member", "early_access", "institute"],
      cycle_status: [
        "locked",
        "in_progress",
        "pending_review",
        "validated",
        "rejected",
      ],
      user_status: ["active", "frozen", "banned", "pending"],
    },
  },
} as const
