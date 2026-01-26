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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
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
          entry_timing: string | null
          exit_date: string | null
          exit_price: number | null
          exit_time: string | null
          id: string
          notes: string | null
          result: string | null
          rr: number | null
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
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          rr?: number | null
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
          entry_timing?: string | null
          exit_date?: string | null
          exit_price?: number | null
          exit_time?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          rr?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      initialize_user_cycles: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      unlock_next_cycle: {
        Args: { p_current_cycle_number: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      cycle_status:
        | "locked"
        | "in_progress"
        | "pending_review"
        | "validated"
        | "rejected"
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
      cycle_status: [
        "locked",
        "in_progress",
        "pending_review",
        "validated",
        "rejected",
      ],
    },
  },
} as const
