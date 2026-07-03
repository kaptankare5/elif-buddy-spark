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
      answer_events: {
        Row: {
          correct: boolean
          created_at: string
          game_id: string | null
          id: string
          letter_id: string
          mode: string | null
          response_ms: number | null
          topic_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          game_id?: string | null
          id?: string
          letter_id: string
          mode?: string | null
          response_ms?: number | null
          topic_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          game_id?: string | null
          id?: string
          letter_id?: string
          mode?: string | null
          response_ms?: number | null
          topic_id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          age_band: string | null
          completed: boolean
          correct: number
          duration_ms: number | null
          ended_at: string | null
          game_id: string
          gender: string | null
          id: string
          mode: string | null
          platform: string | null
          score: number
          started_at: string
          topic_id: string | null
          user_id: string
          wrong: number
        }
        Insert: {
          age_band?: string | null
          completed?: boolean
          correct?: number
          duration_ms?: number | null
          ended_at?: string | null
          game_id: string
          gender?: string | null
          id?: string
          mode?: string | null
          platform?: string | null
          score?: number
          started_at?: string
          topic_id?: string | null
          user_id: string
          wrong?: number
        }
        Update: {
          age_band?: string | null
          completed?: boolean
          correct?: number
          duration_ms?: number | null
          ended_at?: string | null
          game_id?: string
          gender?: string | null
          id?: string
          mode?: string | null
          platform?: string | null
          score?: number
          started_at?: string
          topic_id?: string | null
          user_id?: string
          wrong?: number
        }
        Relationships: []
      }
      learning_milestones: {
        Row: {
          age_band: string | null
          id: string
          letter_id: string
          level: number
          reached_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          age_band?: string | null
          id?: string
          letter_id: string
          level: number
          reached_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          age_band?: string | null
          id?: string
          letter_id?: string
          level?: number
          reached_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: []
      }
      letter_stats: {
        Row: {
          correct_count: number
          first_seen_at: string
          id: string
          knew_before: boolean | null
          last_seen_at: string
          learned_at: string | null
          letter_id: string
          level: number
          shown_count: number
          time_to_learn_ms: number | null
          topic_id: string
          total_response_ms: number
          user_id: string
          wrong_count: number
        }
        Insert: {
          correct_count?: number
          first_seen_at?: string
          id?: string
          knew_before?: boolean | null
          last_seen_at?: string
          learned_at?: string | null
          letter_id: string
          level?: number
          shown_count?: number
          time_to_learn_ms?: number | null
          topic_id: string
          total_response_ms?: number
          user_id: string
          wrong_count?: number
        }
        Update: {
          correct_count?: number
          first_seen_at?: string
          id?: string
          knew_before?: boolean | null
          last_seen_at?: string
          learned_at?: string | null
          letter_id?: string
          level?: number
          shown_count?: number
          time_to_learn_ms?: number | null
          topic_id?: string
          total_response_ms?: number
          user_id?: string
          wrong_count?: number
        }
        Relationships: []
      }
      paywall_events: {
        Row: {
          age_band: string | null
          created_at: string
          id: string
          plan_id: string | null
          platform: string | null
          step: string
          user_id: string
        }
        Insert: {
          age_band?: string | null
          created_at?: string
          id?: string
          plan_id?: string | null
          platform?: string | null
          step: string
          user_id: string
        }
        Update: {
          age_band?: string | null
          created_at?: string
          id?: string
          plan_id?: string | null
          platform?: string | null
          step?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_band: string | null
          analytics_consent: boolean
          consent_at: string | null
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          platform: string | null
          pseudonym: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_band?: string | null
          analytics_consent?: boolean
          consent_at?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          platform?: string | null
          pseudonym?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_band?: string | null
          analytics_consent?: boolean
          consent_at?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          platform?: string | null
          pseudonym?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      screen_views: {
        Row: {
          age_band: string | null
          duration_ms: number | null
          id: string
          opened_at: string
          path: string
          platform: string | null
          user_id: string
        }
        Insert: {
          age_band?: string | null
          duration_ms?: number | null
          id?: string
          opened_at?: string
          path: string
          platform?: string | null
          user_id: string
        }
        Update: {
          age_band?: string | null
          duration_ms?: number | null
          id?: string
          opened_at?: string
          path?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          original_transaction_id: string | null
          platform: string
          product_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          original_transaction_id?: string | null
          platform?: string
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          original_transaction_id?: string | null
          platform?: string
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      analytics_age_breakdown: {
        Row: {
          accuracy_pct: number | null
          age_band: string | null
          gender: string | null
          sessions: number | null
          users: number | null
        }
        Relationships: []
      }
      analytics_daily_active: {
        Row: {
          dau: number | null
          day: string | null
          sessions: number | null
        }
        Relationships: []
      }
      analytics_game_engagement: {
        Row: {
          accuracy_pct: number | null
          avg_seconds: number | null
          completion_pct: number | null
          game_id: string | null
          mode: string | null
          sessions: number | null
          total_minutes: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      analytics_game_popularity: {
        Row: {
          accuracy_pct: number | null
          avg_seconds: number | null
          completion_pct: number | null
          game_id: string | null
          session_count: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      analytics_learning_power: {
        Row: {
          avg_minutes_per_item: number | null
          avg_seconds_per_item: number | null
          learned_items: number | null
          learners: number | null
        }
        Relationships: []
      }
      analytics_learning_rate: {
        Row: {
          active_minutes: number | null
          items_per_hour: number | null
          items_per_minute: number | null
          learned_items: number | null
          learners: number | null
          mode: string | null
        }
        Relationships: []
      }
      analytics_letter_learn_time: {
        Row: {
          avg_minutes: number | null
          learners: number | null
          letter_id: string | null
          topic_id: string | null
        }
        Relationships: []
      }
      analytics_letter_power: {
        Row: {
          avg_seconds: number | null
          knew_before_count: number | null
          learners: number | null
          letter_id: string | null
          topic_id: string | null
        }
        Relationships: []
      }
      analytics_paywall_funnel: {
        Row: {
          events: number | null
          step: string | null
          users: number | null
        }
        Relationships: []
      }
      analytics_retention: {
        Row: {
          cohort_size: number | null
          cohort_week: string | null
          d1_pct: number | null
          d30_pct: number | null
          d7_pct: number | null
        }
        Relationships: []
      }
      analytics_super_vs_normal: {
        Row: {
          accuracy_pct: number | null
          avg_seconds: number | null
          completion_pct: number | null
          mode: string | null
          sessions: number | null
          users: number | null
        }
        Relationships: []
      }
      analytics_super_vs_normal_per_user: {
        Row: {
          accuracy_pct: number | null
          avg_seconds: number | null
          correct: number | null
          events: number | null
          mode: string | null
          pseudonym: string | null
          user_id: string | null
        }
        Relationships: []
      }
      analytics_user_letter_breakdown: {
        Row: {
          correct_count: number | null
          knew_before: boolean | null
          last_seen_at: string | null
          learned_at: string | null
          letter_id: string | null
          level: number | null
          seconds_to_learn: number | null
          shown_count: number | null
          topic_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      analytics_user_progress: {
        Row: {
          accuracy_pct: number | null
          age_band: string | null
          avg_seconds_per_learned_item: number | null
          gender: string | null
          items_per_active_hour: number | null
          known_items: number | null
          last_active: string | null
          learned_items: number | null
          primary_mode: string | null
          pseudonym: string | null
          total_items_seen: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      honor_list: {
        Args: never
        Returns: {
          display_name: string
          since: string
        }[]
      }
      record_letter_answer: {
        Args: {
          _correct: boolean
          _game_id?: string
          _letter_id: string
          _mode?: string
          _response_ms?: number
          _topic_id: string
        }
        Returns: {
          correct_count: number
          first_seen_at: string
          id: string
          knew_before: boolean | null
          last_seen_at: string
          learned_at: string | null
          letter_id: string
          level: number
          shown_count: number
          time_to_learn_ms: number | null
          topic_id: string
          total_response_ms: number
          user_id: string
          wrong_count: number
        }
        SetofOptions: {
          from: "*"
          to: "letter_stats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user" | "parent" | "teacher"
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
      app_role: ["admin", "user", "parent", "teacher"],
    },
  },
} as const
