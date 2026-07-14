// Сгенерировано Supabase (mcp generate_typescript_types, project joaxeoavjvlqmtlepkrr).
// Источник истины для формы таблиц/RPC. Не редактировать вручную — перегенерировать при изменении схемы.
// Ручные доменные типы (Character, Note, …) выводятся из этих Row через Omit&override, чтобы миграционный
// drift ломал сборку, а union-сужения (role/type/kind/style) сохранялись.
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
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string
          admin_id: string
          created_at: string
          id: string
          payload: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_email: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          cover: string | null
          created_at: string
          daily_goal: number
          genre: string | null
          genres: string[] | null
          goal: number
          id: string
          map_bg_url: string | null
          map_template: string | null
          series_id: string | null
          series_order: number | null
          share_token: string | null
          title: string
          updated_at: string
          user_id: string
          words: number
        }
        Insert: {
          author?: string | null
          cover?: string | null
          created_at?: string
          daily_goal?: number
          genre?: string | null
          genres?: string[] | null
          goal?: number
          id?: string
          map_bg_url?: string | null
          map_template?: string | null
          series_id?: string | null
          series_order?: number | null
          share_token?: string | null
          title: string
          updated_at?: string
          user_id: string
          words?: number
        }
        Update: {
          author?: string | null
          cover?: string | null
          created_at?: string
          daily_goal?: number
          genre?: string | null
          genres?: string[] | null
          goal?: number
          id?: string
          map_bg_url?: string | null
          map_template?: string | null
          series_id?: string | null
          series_order?: number | null
          share_token?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "books_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_characters: {
        Row: {
          auto_detected: boolean
          book_id: string
          chapter_id: string
          character_id: string
          created_at: string
          id: string
          is_pov: boolean
          user_id: string
        }
        Insert: {
          auto_detected?: boolean
          book_id: string
          chapter_id: string
          character_id: string
          created_at?: string
          id?: string
          is_pov?: boolean
          user_id: string
        }
        Update: {
          auto_detected?: boolean
          book_id?: string
          chapter_id?: string
          character_id?: string
          created_at?: string
          id?: string
          is_pov?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_characters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_characters_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_versions: {
        Row: {
          chapter_id: string
          content: string
          created_at: string
          id: string
          label: string | null
          trigger: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          chapter_id: string
          content: string
          created_at?: string
          id?: string
          label?: string | null
          trigger: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          chapter_id?: string
          content?: string
          created_at?: string
          id?: string
          label?: string | null
          trigger?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_versions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          position: number
          status: string
          synopsis: string
          title: string
          updated_at: string
          user_id: string
          words: number
        }
        Insert: {
          book_id: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          status?: string
          synopsis?: string
          title?: string
          updated_at?: string
          user_id: string
          words?: number
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          status?: string
          synopsis?: string
          title?: string
          updated_at?: string
          user_id?: string
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      character_relations: {
        Row: {
          book_id: string
          created_at: string
          from_character_id: string
          id: string
          label: string
          to_character_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          from_character_id: string
          id?: string
          label?: string
          to_character_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          from_character_id?: string
          id?: string
          label?: string
          to_character_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_relations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relations_from_character_id_fkey"
            columns: ["from_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relations_to_character_id_fkey"
            columns: ["to_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_relationships: {
        Row: {
          book_id: string
          char_a_id: string
          char_b_id: string
          created_at: string
          id: string
          label_a: string
          label_b: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          char_a_id: string
          char_b_id: string
          created_at?: string
          id?: string
          label_a?: string
          label_b?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          char_a_id?: string
          char_b_id?: string
          created_at?: string
          id?: string
          label_a?: string
          label_b?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_relationships_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relationships_char_a_id_fkey"
            columns: ["char_a_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relationships_char_b_id_fkey"
            columns: ["char_b_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          age: number | null
          aliases: string[]
          appearance: string
          avatar_url: string | null
          backstory: string
          book_id: string
          created_at: string
          exterior_life: string
          gap: string
          id: string
          interior_life: string
          name: string
          notes: string
          personality: string
          position: number
          quote: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          aliases?: string[]
          appearance?: string
          avatar_url?: string | null
          backstory?: string
          book_id: string
          created_at?: string
          exterior_life?: string
          gap?: string
          id?: string
          interior_life?: string
          name?: string
          notes?: string
          personality?: string
          position?: number
          quote?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          aliases?: string[]
          appearance?: string
          avatar_url?: string | null
          backstory?: string
          book_id?: string
          created_at?: string
          exterior_life?: string
          gap?: string
          id?: string
          interior_life?: string
          name?: string
          notes?: string
          personality?: string
          position?: number
          quote?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      location_connections: {
        Row: {
          book_id: string
          created_at: string
          from_id: string
          id: string
          label: string
          style: string
          to_id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          from_id: string
          id?: string
          label?: string
          style?: string
          to_id: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          from_id?: string
          id?: string
          label?: string
          style?: string
          to_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_connections_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_connections_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_connections_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          book_id: string
          created_at: string
          description: string
          id: string
          name: string
          position: number
          role: string
          size: number
          type: string
          updated_at: string
          user_id: string
          x: number | null
          y: number | null
        }
        Insert: {
          book_id: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          role?: string
          size?: number
          type?: string
          updated_at?: string
          user_id: string
          x?: number | null
          y?: number | null
        }
        Update: {
          book_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          position?: number
          role?: string
          size?: number
          type?: string
          updated_at?: string
          user_id?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      map_stamps: {
        Row: {
          book_id: string
          created_at: string | null
          id: string
          size: number
          type: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          book_id: string
          created_at?: string | null
          id?: string
          size?: number
          type: string
          user_id: string
          x: number
          y: number
        }
        Update: {
          book_id?: string
          created_at?: string | null
          id?: string
          size?: number
          type?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_stamps_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          book_id: string
          chapter_id: string | null
          created_at: string
          custom_color: string | null
          custom_label: string | null
          id: string
          kind: string
          position: number
          text: string
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          created_at?: string
          custom_color?: string | null
          custom_label?: string | null
          id?: string
          kind?: string
          position?: number
          text?: string
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          custom_color?: string | null
          custom_label?: string | null
          id?: string
          kind?: string
          position?: number
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          id: string
          inv_id: string
          op_key: string | null
          paid_at: string
          plan: string
          refund_request_id: string | null
          refunded_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          id?: string
          inv_id: string
          op_key?: string | null
          paid_at?: string
          plan?: string
          refund_request_id?: string | null
          refunded_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          id?: string
          inv_id?: string
          op_key?: string | null
          paid_at?: string
          plan?: string
          refund_request_id?: string | null
          refunded_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          display_name: string | null
          grandfathered: boolean
          is_test: boolean
          last_billed_expiry: string | null
          onboarded_at: string | null
          plan: string
          plan_expires_at: string | null
          plan_interval: string
          recurring_inv_id: string | null
          retention_email_sent_at: string | null
          updated_at: string
          user_dictionary: string[] | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          display_name?: string | null
          grandfathered?: boolean
          is_test?: boolean
          last_billed_expiry?: string | null
          onboarded_at?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_interval?: string
          recurring_inv_id?: string | null
          retention_email_sent_at?: string | null
          updated_at?: string
          user_dictionary?: string[] | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          display_name?: string | null
          grandfathered?: boolean
          is_test?: boolean
          last_billed_expiry?: string | null
          onboarded_at?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_interval?: string
          recurring_inv_id?: string | null
          retention_email_sent_at?: string | null
          updated_at?: string
          user_dictionary?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_consents: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          plan: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          plan: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          plan?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          book_id: string
          chapter_id: string | null
          created_at: string
          description: string
          era: string
          id: string
          position: number
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          created_at?: string
          description?: string
          era?: string
          id?: string
          position?: number
          title?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          description?: string
          era?: string
          id?: string
          position?: number
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      writing_snapshots: {
        Row: {
          book_id: string
          created_at: string
          date: string
          id: string
          user_id: string
          words: number
        }
        Insert: {
          book_id: string
          created_at?: string
          date: string
          id?: string
          user_id: string
          words: number
        }
        Update: {
          book_id?: string
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "writing_snapshots_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_user_dictionary_word: {
        Args: { p_user_id: string; p_word: string }
        Returns: undefined
      }
      compute_synopsis: { Args: { html: string }; Returns: string }
      decrement_lifetime_slot: { Args: never; Returns: boolean }
      duplicate_book_content: {
        Args: {
          p_characters: boolean
          p_locations_map: boolean
          p_notes: boolean
          p_source: string
          p_target: string
          p_timeline: boolean
        }
        Returns: undefined
      }
      extend_plan: {
        Args: { days: number; target_user_id: string }
        Returns: undefined
      }
      get_admin_anomalies: { Args: never; Returns: Json }
      get_admin_audit_log: {
        Args: never
        Returns: {
          action: string
          created_at: string
          id: string
          is_test: boolean
          payload: Json
          target_email: string
          target_user_id: string
        }[]
      }
      get_admin_dau_trend: {
        Args: never
        Returns: {
          dau: number
          day: string
        }[]
      }
      get_admin_retention: { Args: never; Returns: Json }
      get_admin_revenue: { Args: never; Returns: Json }
      get_admin_stats: { Args: never; Returns: Json }
      get_admin_user_detail: { Args: { target_user_id: string }; Returns: Json }
      get_admin_users: {
        Args: never
        Returns: {
          books_count: number
          created_at: string
          email: string
          id: string
          is_test: boolean
          last_active: string
          plan: string
          suspended: boolean
          words_total: number
        }[]
      }
      get_feature_flags: {
        Args: never
        Returns: {
          enabled: boolean
          key: string
        }[]
      }
      get_inactive_users_for_retention: {
        Args: never
        Returns: {
          book_title: string
          display_name: string
          email: string
          user_id: string
        }[]
      }
      get_public_stats: { Args: never; Returns: Json }
      get_shared_book: { Args: { p_token: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      remove_user_dictionary_word: {
        Args: { p_user_id: string; p_word: string }
        Returns: undefined
      }
      reorder_chapters: { Args: { updates: Json }; Returns: undefined }
      reorder_timeline_events: { Args: { updates: Json }; Returns: undefined }
      set_feature_flag: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: undefined
      }
      set_lifetime_slots: { Args: { new_value: number }; Returns: undefined }
      set_user_plan: {
        Args: { new_plan: string; target_user_id: string }
        Returns: undefined
      }
      set_user_test: {
        Args: { is_test_value: boolean; target_user_id: string }
        Returns: undefined
      }
      strip_html: { Args: { html: string }; Returns: string }
      suspend_user: {
        Args: { suspend: boolean; target_user_id: string }
        Returns: undefined
      }
      sync_character_chapters: {
        Args: { p_aliases: string[]; p_book_id: string; p_character_id: string }
        Returns: undefined
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
    Enums: {},
  },
} as const
