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
          supplementary_note: string | null
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
          supplementary_note?: string | null
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
          supplementary_note?: string | null
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
      bonus_videos: {
        Row: {
          accessible_roles: string[]
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          embed_code: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          accessible_roles?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_code: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          accessible_roles?: string[]
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          embed_code?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_setups: {
        Row: {
          asset: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          asset?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          asset?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      ea_activity_tracking: {
        Row: {
          active_tab: string | null
          button_clicks: Json | null
          created_at: string
          id: string
          last_heartbeat: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_tab?: string | null
          button_clicks?: Json | null
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_tab?: string | null
          button_clicks?: Json | null
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ea_featured_trade: {
        Row: {
          content_type: string
          created_at: string
          created_by: string | null
          direction: string | null
          entry_time: string | null
          id: string
          image_path: string | null
          rr: number | null
          trade_date: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          entry_time?: string | null
          id?: string
          image_path?: string | null
          rr?: number | null
          trade_date?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          entry_time?: string | null
          id?: string
          image_path?: string | null
          rr?: number | null
          trade_date?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      ea_global_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ea_lead_notes: {
        Row: {
          author_id: string
          created_at: string
          id: string
          note: string
          request_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          note: string
          request_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          note?: string
          request_id?: string
        }
        Relationships: []
      }
      early_access_requests: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          booking_event_id: string | null
          brief_closer: string | null
          budget_amount: number | null
          call_booked: boolean
          call_debrief: string | null
          call_done: boolean
          call_done_at: string | null
          call_meeting_url: string | null
          call_no_show: boolean | null
          call_outcome: string | null
          call_rescheduled_at: string | null
          call_scheduled_at: string | null
          call_scheduled_duration: number | null
          checkout_unlocked: boolean | null
          closer_name: string | null
          contact_method: string | null
          contacte_aujourdhui: boolean | null
          contacted: boolean
          contacted_at: string | null
          created_at: string
          date_activation_trial: string | null
          derniere_interaction: string | null
          difficulte_principale: string | null
          email: string
          first_name: string
          form_answers: Json | null
          form_submitted: boolean
          id: string
          importance_trading: number | null
          offer_amount: string | null
          paid_amount: number | null
          paid_at: string | null
          phone: string
          precall_question: string | null
          priorite: string | null
          quick_win: boolean | null
          raison_non_closing: string | null
          raison_perdu: string | null
          rappel_date: string | null
          rappel_note: string | null
          recolte_demarree: boolean | null
          recolte_terminee: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          setter_name: string | null
          status: string
          statut_trial: string | null
          trade_execute: boolean | null
          user_id: string | null
          videos_en_cours: boolean | null
          videos_terminees: boolean | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          booking_event_id?: string | null
          brief_closer?: string | null
          budget_amount?: number | null
          call_booked?: boolean
          call_debrief?: string | null
          call_done?: boolean
          call_done_at?: string | null
          call_meeting_url?: string | null
          call_no_show?: boolean | null
          call_outcome?: string | null
          call_rescheduled_at?: string | null
          call_scheduled_at?: string | null
          call_scheduled_duration?: number | null
          checkout_unlocked?: boolean | null
          closer_name?: string | null
          contact_method?: string | null
          contacte_aujourdhui?: boolean | null
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          date_activation_trial?: string | null
          derniere_interaction?: string | null
          difficulte_principale?: string | null
          email: string
          first_name: string
          form_answers?: Json | null
          form_submitted?: boolean
          id?: string
          importance_trading?: number | null
          offer_amount?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          phone: string
          precall_question?: string | null
          priorite?: string | null
          quick_win?: boolean | null
          raison_non_closing?: string | null
          raison_perdu?: string | null
          rappel_date?: string | null
          rappel_note?: string | null
          recolte_demarree?: boolean | null
          recolte_terminee?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          setter_name?: string | null
          status?: string
          statut_trial?: string | null
          trade_execute?: boolean | null
          user_id?: string | null
          videos_en_cours?: boolean | null
          videos_terminees?: boolean | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          booking_event_id?: string | null
          brief_closer?: string | null
          budget_amount?: number | null
          call_booked?: boolean
          call_debrief?: string | null
          call_done?: boolean
          call_done_at?: string | null
          call_meeting_url?: string | null
          call_no_show?: boolean | null
          call_outcome?: string | null
          call_rescheduled_at?: string | null
          call_scheduled_at?: string | null
          call_scheduled_duration?: number | null
          checkout_unlocked?: boolean | null
          closer_name?: string | null
          contact_method?: string | null
          contacte_aujourdhui?: boolean | null
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          date_activation_trial?: string | null
          derniere_interaction?: string | null
          difficulte_principale?: string | null
          email?: string
          first_name?: string
          form_answers?: Json | null
          form_submitted?: boolean
          id?: string
          importance_trading?: number | null
          offer_amount?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          phone?: string
          precall_question?: string | null
          priorite?: string | null
          quick_win?: boolean | null
          raison_non_closing?: string | null
          raison_perdu?: string | null
          rappel_date?: string | null
          rappel_note?: string | null
          recolte_demarree?: boolean | null
          recolte_terminee?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          setter_name?: string | null
          status?: string
          statut_trial?: string | null
          trade_execute?: boolean | null
          user_id?: string | null
          videos_en_cours?: boolean | null
          videos_terminees?: boolean | null
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
      funnel_config: {
        Row: {
          apply_blocks: Json | null
          apply_form_email_label: string | null
          apply_form_name_label: string | null
          apply_form_phone_label: string | null
          apply_form_questions: Json | null
          apply_headline: string | null
          apply_social_proof_enabled: boolean | null
          apply_social_proof_text: string | null
          apply_subtitle: string | null
          brand_footer_text: string | null
          brand_name: string | null
          created_at: string | null
          discovery_badge_text: string | null
          discovery_blocks: Json | null
          discovery_cal_link: string | null
          discovery_cta_button: string | null
          discovery_cta_subtitle: string | null
          discovery_cta_title: string | null
          discovery_headline: string | null
          discovery_headline_personalized: string | null
          discovery_subtitle: string | null
          final_badge_text: string | null
          final_blocks: Json | null
          final_headline_accent: string | null
          final_headline_confirmation: string | null
          final_headline_personalized: string | null
          final_step1_congrats: string | null
          final_step1_details: string | null
          final_step1_instructions: string | null
          final_step1_title: string | null
          final_step1_warning_consequence: string | null
          final_step1_warning_text: string | null
          final_step1_warning_title: string | null
          final_step2_placeholder: string | null
          final_step2_subtext: string | null
          final_step2_title: string | null
          funnel_id: string | null
          id: string
          landing_blocks: Json | null
          landing_cta_subtext: string | null
          landing_cta_text: string | null
          landing_footer_text: string | null
          landing_headline: string | null
          landing_headline_accent: string | null
          landing_subtitle: string | null
          updated_at: string | null
          vsl_cta_delay_seconds: number | null
          vsl_embed_code: string | null
          vsl_enabled: boolean | null
          vsl_page: string | null
          vsl_provider: string | null
        }
        Insert: {
          apply_blocks?: Json | null
          apply_form_email_label?: string | null
          apply_form_name_label?: string | null
          apply_form_phone_label?: string | null
          apply_form_questions?: Json | null
          apply_headline?: string | null
          apply_social_proof_enabled?: boolean | null
          apply_social_proof_text?: string | null
          apply_subtitle?: string | null
          brand_footer_text?: string | null
          brand_name?: string | null
          created_at?: string | null
          discovery_badge_text?: string | null
          discovery_blocks?: Json | null
          discovery_cal_link?: string | null
          discovery_cta_button?: string | null
          discovery_cta_subtitle?: string | null
          discovery_cta_title?: string | null
          discovery_headline?: string | null
          discovery_headline_personalized?: string | null
          discovery_subtitle?: string | null
          final_badge_text?: string | null
          final_blocks?: Json | null
          final_headline_accent?: string | null
          final_headline_confirmation?: string | null
          final_headline_personalized?: string | null
          final_step1_congrats?: string | null
          final_step1_details?: string | null
          final_step1_instructions?: string | null
          final_step1_title?: string | null
          final_step1_warning_consequence?: string | null
          final_step1_warning_text?: string | null
          final_step1_warning_title?: string | null
          final_step2_placeholder?: string | null
          final_step2_subtext?: string | null
          final_step2_title?: string | null
          funnel_id?: string | null
          id?: string
          landing_blocks?: Json | null
          landing_cta_subtext?: string | null
          landing_cta_text?: string | null
          landing_footer_text?: string | null
          landing_headline?: string | null
          landing_headline_accent?: string | null
          landing_subtitle?: string | null
          updated_at?: string | null
          vsl_cta_delay_seconds?: number | null
          vsl_embed_code?: string | null
          vsl_enabled?: boolean | null
          vsl_page?: string | null
          vsl_provider?: string | null
        }
        Update: {
          apply_blocks?: Json | null
          apply_form_email_label?: string | null
          apply_form_name_label?: string | null
          apply_form_phone_label?: string | null
          apply_form_questions?: Json | null
          apply_headline?: string | null
          apply_social_proof_enabled?: boolean | null
          apply_social_proof_text?: string | null
          apply_subtitle?: string | null
          brand_footer_text?: string | null
          brand_name?: string | null
          created_at?: string | null
          discovery_badge_text?: string | null
          discovery_blocks?: Json | null
          discovery_cal_link?: string | null
          discovery_cta_button?: string | null
          discovery_cta_subtitle?: string | null
          discovery_cta_title?: string | null
          discovery_headline?: string | null
          discovery_headline_personalized?: string | null
          discovery_subtitle?: string | null
          final_badge_text?: string | null
          final_blocks?: Json | null
          final_headline_accent?: string | null
          final_headline_confirmation?: string | null
          final_headline_personalized?: string | null
          final_step1_congrats?: string | null
          final_step1_details?: string | null
          final_step1_instructions?: string | null
          final_step1_title?: string | null
          final_step1_warning_consequence?: string | null
          final_step1_warning_text?: string | null
          final_step1_warning_title?: string | null
          final_step2_placeholder?: string | null
          final_step2_subtext?: string | null
          final_step2_title?: string | null
          funnel_id?: string | null
          id?: string
          landing_blocks?: Json | null
          landing_cta_subtext?: string | null
          landing_cta_text?: string | null
          landing_footer_text?: string | null
          landing_headline?: string | null
          landing_headline_accent?: string | null
          landing_subtitle?: string | null
          updated_at?: string | null
          vsl_cta_delay_seconds?: number | null
          vsl_embed_code?: string | null
          vsl_enabled?: boolean | null
          vsl_page?: string | null
          vsl_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_config_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_comments: {
        Row: {
          author_id: string
          author_name: string
          author_role: string
          comment_type: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_role?: string
          comment_type?: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_role?: string
          comment_type?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "early_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_by: string | null
          event_type: string
          id: string
          metadata: Json | null
          request_id: string
          source: string
          timestamp: string
        }
        Insert: {
          created_by?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          request_id: string
          source?: string
          timestamp?: string
        }
        Update: {
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          request_id?: string
          source?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "early_access_requests"
            referencedColumns: ["id"]
          },
        ]
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
          imported_at: string | null
          imported_from_prod: boolean
          is_client: boolean
          last_login_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          status_reason: string | null
          timezone: string | null
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
          imported_at?: string | null
          imported_from_prod?: boolean
          is_client?: boolean
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_reason?: string | null
          timezone?: string | null
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
          imported_at?: string | null
          imported_from_prod?: boolean
          is_client?: boolean
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          status_reason?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quest_step_configs: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          created_by: string | null
          id: string
          step_description: string | null
          step_label: string
          step_order: number
          target_phase: string
          target_role: string
          updated_at: string
          video_embed: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          step_description?: string | null
          step_label?: string
          step_order?: number
          target_phase?: string
          target_role: string
          updated_at?: string
          video_embed?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          step_description?: string | null
          step_label?: string
          step_order?: number
          target_phase?: string
          target_role?: string
          updated_at?: string
          video_embed?: string | null
        }
        Relationships: []
      }
      results: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_path: string
          result_date: string | null
          result_type: string | null
          sort_order: number
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path: string
          result_date?: string | null
          result_type?: string | null
          sort_order?: number
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_path?: string
          result_date?: string | null
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
          context_timeframe: string | null
          created_at: string
          day_of_week: string
          direction: string
          direction_structure: string | null
          entry_model: string | null
          entry_time: string | null
          entry_timeframe: string | null
          entry_timing: string | null
          exit_time: string | null
          id: string
          news_day: boolean | null
          news_label: string | null
          rr: number | null
          screenshot_m1: string | null
          screenshot_m15_m5: string | null
          setup_type: string | null
          sl_placement: string | null
          speculation_hl_valid: boolean | null
          stop_loss_points: string | null
          stop_loss_size: string | null
          target_hl_valid: boolean | null
          target_timing: string | null
          tp_placement: string | null
          trade_date: string
          trade_duration: string | null
          trade_number: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          context_timeframe?: string | null
          created_at?: string
          day_of_week: string
          direction: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          rr?: number | null
          screenshot_m1?: string | null
          screenshot_m15_m5?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss_points?: string | null
          stop_loss_size?: string | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          tp_placement?: string | null
          trade_date: string
          trade_duration?: string | null
          trade_number: number
          user_id: string
        }
        Update: {
          comment?: string | null
          context_timeframe?: string | null
          created_at?: string
          day_of_week?: string
          direction?: string
          direction_structure?: string | null
          entry_model?: string | null
          entry_time?: string | null
          entry_timeframe?: string | null
          entry_timing?: string | null
          exit_time?: string | null
          id?: string
          news_day?: boolean | null
          news_label?: string | null
          rr?: number | null
          screenshot_m1?: string | null
          screenshot_m15_m5?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss_points?: string | null
          stop_loss_size?: string | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          tp_placement?: string | null
          trade_date?: string
          trade_duration?: string | null
          trade_number?: number
          user_id?: string
        }
        Relationships: []
      }
      trading_sessions: {
        Row: {
          archived: boolean
          asset: string | null
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          asset?: string | null
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          asset?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
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
          context_timeframe: string | null
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
          news_day: boolean | null
          news_label: string | null
          notes: string | null
          result: string | null
          rr: number | null
          screenshot_entry_url: string | null
          screenshot_url: string | null
          setup_type: string | null
          sl_placement: string | null
          stop_loss: number | null
          stop_loss_size: string | null
          take_profit: number | null
          tp_placement: string | null
          trade_date: string
          trade_duration: string | null
          trade_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          context_timeframe?: string | null
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
          news_day?: boolean | null
          news_label?: string | null
          notes?: string | null
          result?: string | null
          rr?: number | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          tp_placement?: string | null
          trade_date: string
          trade_duration?: string | null
          trade_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          context_timeframe?: string | null
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
          news_day?: boolean | null
          news_label?: string | null
          notes?: string | null
          result?: string | null
          rr?: number | null
          screenshot_entry_url?: string | null
          screenshot_url?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          tp_placement?: string | null
          trade_date?: string
          trade_duration?: string | null
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
      user_login_history: {
        Row: {
          id: string
          logged_in_at: string
          user_id: string
        }
        Insert: {
          id?: string
          logged_in_at?: string
          user_id: string
        }
        Update: {
          id?: string
          logged_in_at?: string
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
          asset: string | null
          chart_link: string | null
          comment: string | null
          context_timeframe: string | null
          created_at: string
          custom_setup_id: string | null
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
          session_id: string | null
          setup_type: string | null
          sl_placement: string | null
          speculation_hl_valid: boolean | null
          stop_loss: number | null
          stop_loss_size: string | null
          take_profit: number | null
          target_hl_valid: boolean | null
          target_timing: string | null
          tp_placement: string | null
          trade_date: string
          trade_duration: string | null
          trade_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset?: string | null
          chart_link?: string | null
          comment?: string | null
          context_timeframe?: string | null
          created_at?: string
          custom_setup_id?: string | null
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
          session_id?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          tp_placement?: string | null
          trade_date: string
          trade_duration?: string | null
          trade_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string | null
          chart_link?: string | null
          comment?: string | null
          context_timeframe?: string | null
          created_at?: string
          custom_setup_id?: string | null
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
          session_id?: string | null
          setup_type?: string | null
          sl_placement?: string | null
          speculation_hl_valid?: boolean | null
          stop_loss?: number | null
          stop_loss_size?: string | null
          take_profit?: number | null
          target_hl_valid?: boolean | null
          target_timing?: string | null
          tp_placement?: string | null
          trade_date?: string
          trade_duration?: string | null
          trade_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personal_trades_custom_setup_id_fkey"
            columns: ["custom_setup_id"]
            isOneToOne: false
            referencedRelation: "custom_setups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_personal_trades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trading_sessions"
            referencedColumns: ["id"]
          },
        ]
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
          ea_timer_duration_minutes: number | null
          early_access_type: string | null
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          ea_timer_duration_minutes?: number | null
          early_access_type?: string | null
          expires_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          ea_timer_duration_minutes?: number | null
          early_access_type?: string | null
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
          assigned_to: string | null
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
          assigned_to?: string | null
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
          assigned_to?: string | null
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
          accessible_roles: string[]
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
          accessible_roles?: string[]
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
          accessible_roles?: string[]
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
      activate_ea_timer: { Args: never; Returns: undefined }
      add_complementary_trades_from_cycle: {
        Args: { p_cycle_id: string; p_member_user_id: string }
        Returns: number
      }
      can_user_access: { Args: never; Returns: boolean }
      check_cycle_accuracy_and_auto_validate: {
        Args: { p_cycle_id: string; p_user_cycle_id: string; p_user_id: string }
        Returns: number
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      disable_import_triggers: { Args: never; Returns: undefined }
      enable_import_triggers: { Args: never; Returns: undefined }
      get_auth_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
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
      get_team_emails: {
        Args: never
        Returns: {
          email: string
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
      is_setter: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      record_login: { Args: never; Returns: undefined }
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
        | "setter"
        | "closer"
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
      app_role: [
        "super_admin",
        "admin",
        "member",
        "early_access",
        "institute",
        "setter",
        "closer",
      ],
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
