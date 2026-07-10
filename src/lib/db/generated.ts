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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_confirmation_codes: {
        Row: {
          booking_id: string
          code: string
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          id: string
          stage: number
        }
        Insert: {
          booking_id: string
          code?: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          id?: string
          stage: number
        }
        Update: {
          booking_id?: string
          code?: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          id?: string
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_confirmation_codes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_confirmation_codes_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_at: string | null
          address: string | null
          address_lat: number | null
          address_lng: number | null
          agreed_price_kobo: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          caution_fee_kobo: number
          commission_percent: number
          completed_at: string | null
          created_at: string
          customer_id: string
          delivery_fee_kobo: number
          event_project_id: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          late_minutes: number
          late_penalty_percent_per_30min: number
          listing_id: string
          notes: string | null
          provider_arrived_at: string | null
          provider_id: string
          reference: string
          rejected_at: string | null
          scheduled_end: string | null
          scheduled_start: string
          stage_1_at: string | null
          stage_1_release_percent: number
          stage_2_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          agreed_price_kobo: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          caution_fee_kobo?: number
          commission_percent: number
          completed_at?: string | null
          created_at?: string
          customer_id: string
          delivery_fee_kobo?: number
          event_project_id?: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          late_minutes?: number
          late_penalty_percent_per_30min?: number
          listing_id: string
          notes?: string | null
          provider_arrived_at?: string | null
          provider_id: string
          reference: string
          rejected_at?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          stage_1_at?: string | null
          stage_1_release_percent: number
          stage_2_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          agreed_price_kobo?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          caution_fee_kobo?: number
          commission_percent?: number
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_fee_kobo?: number
          event_project_id?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          late_minutes?: number
          late_penalty_percent_per_30min?: number
          listing_id?: string
          notes?: string | null
          provider_arrived_at?: string | null
          provider_id?: string
          reference?: string
          rejected_at?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          stage_1_at?: string | null
          stage_1_release_percent?: number
          stage_2_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_project_id_fkey"
            columns: ["event_project_id"]
            isOneToOne: false
            referencedRelation: "event_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          conversation_id: string
          created_at: string
          customer_proxy_number: string | null
          duration_seconds: number | null
          ended_at: string | null
          expires_at: string | null
          failure_reason: string | null
          id: string
          initiator_id: string
          provider_proxy_number: string | null
          provider_ref: string | null
          session_ref: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          telephony_provider: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          customer_proxy_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          initiator_id: string
          provider_proxy_number?: string | null
          provider_ref?: string | null
          session_ref?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          telephony_provider?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          customer_proxy_number?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          initiator_id?: string
          provider_proxy_number?: string | null
          provider_ref?: string | null
          session_ref?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          telephony_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          description: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          requires_video_proof: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          description?: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          requires_video_proof?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          description?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          requires_video_proof?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          last_message_at: string | null
          listing_id: string | null
          provider_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          provider_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          note: string | null
          storage_path: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          note?: string | null
          storage_path?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          note?: string | null
          storage_path?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          booking_id: string
          caution_claim_kobo: number | null
          created_at: string
          description: string | null
          id: string
          is_damage_claim: boolean
          raised_by: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          caution_claim_kobo?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_damage_claim?: boolean
          raised_by: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          caution_claim_kobo?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_damage_claim?: boolean
          raised_by?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_project_checklist_items: {
        Row: {
          booking_id: string | null
          created_at: string
          event_project_id: string
          id: string
          is_done: boolean
          label: string
          sort_order: number
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          event_project_id: string
          id?: string
          is_done?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          event_project_id?: string
          id?: string
          is_done?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_project_checklist_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_project_checklist_items_event_project_id_fkey"
            columns: ["event_project_id"]
            isOneToOne: false
            referencedRelation: "event_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_projects: {
        Row: {
          budget_kobo: number | null
          city_id: string | null
          created_at: string
          customer_id: string
          event_date: string | null
          event_type_id: string | null
          guest_count: number | null
          id: string
          status: Database["public"]["Enums"]["event_project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          budget_kobo?: number | null
          city_id?: string | null
          created_at?: string
          customer_id: string
          event_date?: string | null
          event_type_id?: string | null
          guest_count?: number | null
          id?: string
          status?: Database["public"]["Enums"]["event_project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          budget_kobo?: number | null
          city_id?: string | null
          created_at?: string
          customer_id?: string
          event_date?: string | null
          event_type_id?: string | null
          guest_count?: number | null
          id?: string
          status?: Database["public"]["Enums"]["event_project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_projects_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_projects_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      favourites: {
        Row: {
          created_at: string
          listing_id: string | null
          provider_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id?: string | null
          provider_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string | null
          provider_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          enabled_for_roles: Database["public"]["Enums"]["user_role"][] | null
          is_locked: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          enabled_for_roles?: Database["public"]["Enums"]["user_role"][] | null
          is_locked?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          enabled_for_roles?: Database["public"]["Enums"]["user_role"][] | null
          is_locked?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_available: boolean
          listing_id: string
          note: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_available?: boolean
          listing_id: string
          note?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_available?: boolean
          listing_id?: string
          note?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_availability_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          kind: string
          listing_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          status: Database["public"]["Enums"]["listing_status"]
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          kind: string
          listing_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["listing_status"]
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          kind?: string
          listing_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["listing_status"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_media_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancellation_policy: Json
          category_id: string
          caution_fee_kobo: number
          created_at: string
          description: string | null
          id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          price_kobo: number | null
          price_max_kobo: number | null
          price_min_kobo: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          provider_id: string
          rejection_reason: string | null
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_policy?: Json
          category_id: string
          caution_fee_kobo?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price_kobo?: number | null
          price_max_kobo?: number | null
          price_min_kobo?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          provider_id: string
          rejection_reason?: string | null
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_policy?: Json
          category_id?: string
          caution_fee_kobo?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          price_kobo?: number | null
          price_max_kobo?: number | null
          price_min_kobo?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          provider_id?: string
          rejection_reason?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          flag_reason:
            | Database["public"]["Enums"]["moderation_flag_reason"]
            | null
          flag_reasons: Database["public"]["Enums"]["moderation_flag_reason"][]
          id: string
          is_flagged: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          flag_reason?:
            | Database["public"]["Enums"]["moderation_flag_reason"]
            | null
          flag_reasons?: Database["public"]["Enums"]["moderation_flag_reason"][]
          id?: string
          is_flagged?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          flag_reason?:
            | Database["public"]["Enums"]["moderation_flag_reason"]
            | null
          flag_reasons?: Database["public"]["Enums"]["moderation_flag_reason"][]
          id?: string
          is_flagged?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          conversation_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          message_id: string | null
          reason: Database["public"]["Enums"]["moderation_flag_reason"]
          resolved_at: string | null
          resolved_by: string | null
          resulted_in_strike: boolean
          status: Database["public"]["Enums"]["moderation_flag_status"]
          strike_id: string | null
          subject_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          message_id?: string | null
          reason: Database["public"]["Enums"]["moderation_flag_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          resulted_in_strike?: boolean
          status?: Database["public"]["Enums"]["moderation_flag_status"]
          strike_id?: string | null
          subject_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          conversation_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          message_id?: string | null
          reason?: Database["public"]["Enums"]["moderation_flag_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          resulted_in_strike?: boolean
          status?: Database["public"]["Enums"]["moderation_flag_status"]
          strike_id?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_flags_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_strike_id_fkey"
            columns: ["strike_id"]
            isOneToOne: false
            referencedRelation: "provider_strikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_ledger_entries: {
        Row: {
          amount_kobo: number
          booking_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          gateway_reference: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_ledger_kind"]
          note: string | null
          payment_id: string
          provider_id: string | null
          rider_id: string | null
          stage: number | null
        }
        Insert: {
          amount_kobo: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gateway_reference?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_ledger_kind"]
          note?: string | null
          payment_id: string
          provider_id?: string | null
          rider_id?: string | null
          stage?: number | null
        }
        Update: {
          amount_kobo?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          gateway_reference?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_ledger_kind"]
          note?: string | null
          payment_id?: string
          provider_id?: string | null
          rider_id?: string | null
          stage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_entries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_ledger_entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string | null
          gateway: string
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type?: string | null
          gateway: string
          id?: string
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string | null
          gateway?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kobo: number
          booking_id: string
          caution_claimed_kobo: number
          caution_fee_kobo: number
          caution_held_kobo: number
          caution_refunded_kobo: number
          commission_kobo: number
          created_at: string
          delivery_fee_kobo: number
          gateway: string | null
          gateway_metadata: Json
          gateway_reference: string | null
          held_kobo: number
          id: string
          penalty_kobo: number
          refunded_kobo: number
          released_kobo: number
          stage_1_released_at: string | null
          stage_2_released_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          booking_id: string
          caution_claimed_kobo?: number
          caution_fee_kobo?: number
          caution_held_kobo?: number
          caution_refunded_kobo?: number
          commission_kobo?: number
          created_at?: string
          delivery_fee_kobo?: number
          gateway?: string | null
          gateway_metadata?: Json
          gateway_reference?: string | null
          held_kobo?: number
          id?: string
          penalty_kobo?: number
          refunded_kobo?: number
          released_kobo?: number
          stage_1_released_at?: string | null
          stage_2_released_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          booking_id?: string
          caution_claimed_kobo?: number
          caution_fee_kobo?: number
          caution_held_kobo?: number
          caution_refunded_kobo?: number
          commission_kobo?: number
          created_at?: string
          delivery_fee_kobo?: number
          gateway?: string | null
          gateway_metadata?: Json
          gateway_reference?: string | null
          held_kobo?: number
          id?: string
          penalty_kobo?: number
          refunded_kobo?: number
          released_kobo?: number
          stage_1_released_at?: string | null
          stage_2_released_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_kobo: number
          created_at: string
          failure_reason: string | null
          gateway: string | null
          gateway_reference: string | null
          id: string
          paid_at: string | null
          provider_id: string | null
          rider_id: string | null
          scheduled_for: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          failure_reason?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          paid_at?: string | null
          provider_id?: string | null
          rider_id?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          failure_reason?: string | null
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          paid_at?: string | null
          provider_id?: string | null
          rider_id?: string | null
          scheduled_for?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      penalty_applications: {
        Row: {
          applied_by: string | null
          booking_id: string
          created_at: string
          customer_share_kobo: number
          id: string
          late_minutes: number
          payment_id: string
          penalty_kobo: number
          platform_share_kobo: number
          reason: string
        }
        Insert: {
          applied_by?: string | null
          booking_id: string
          created_at?: string
          customer_share_kobo: number
          id?: string
          late_minutes?: number
          payment_id: string
          penalty_kobo: number
          platform_share_kobo: number
          reason: string
        }
        Update: {
          applied_by?: string | null
          booking_id?: string
          created_at?: string
          customer_share_kobo?: number
          id?: string
          late_minutes?: number
          payment_id?: string
          penalty_kobo?: number
          platform_share_kobo?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalty_applications_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_applications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalty_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          label: string
          max_value: number | null
          min_value: number | null
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
        }
        Insert: {
          description?: string | null
          key: string
          label: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type: string
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          confirmed_solicitation_count: number
          created_at: string
          full_name: string | null
          id: string
          is_suspended: boolean
          phone: string | null
          phone_verified_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city_id?: string | null
          confirmed_solicitation_count?: number
          created_at?: string
          full_name?: string | null
          id: string
          is_suspended?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city_id?: string | null
          confirmed_solicitation_count?: number
          created_at?: string
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_agreements: {
        Row: {
          commission_percent_override: number | null
          created_at: string
          deposit_percent: number
          id: string
          is_active: boolean
          late_penalty_percent_per_30min_override: number | null
          provider_id: string
          recorded_by: string | null
          signed_at: string | null
          stage_1_release_percent_override: number | null
        }
        Insert: {
          commission_percent_override?: number | null
          created_at?: string
          deposit_percent: number
          id?: string
          is_active?: boolean
          late_penalty_percent_per_30min_override?: number | null
          provider_id: string
          recorded_by?: string | null
          signed_at?: string | null
          stage_1_release_percent_override?: number | null
        }
        Update: {
          commission_percent_override?: number | null
          created_at?: string
          deposit_percent?: number
          id?: string
          is_active?: boolean
          late_penalty_percent_per_30min_override?: number | null
          provider_id?: string
          recorded_by?: string | null
          signed_at?: string | null
          stage_1_release_percent_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_agreements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_agreements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_categories: {
        Row: {
          category_id: string
          provider_id: string
        }
        Insert: {
          category_id: string
          provider_id: string
        }
        Update: {
          category_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_categories_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_contacts: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          phone_verified_at: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          phone_verified_at?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          phone_verified_at?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_contacts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_documents: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          notes: string | null
          provider_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          notes?: string | null
          provider_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          notes?: string | null
          provider_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_reliability: {
        Row: {
          avg_communication: number
          avg_punctuality: number
          avg_quality: number
          avg_value: number
          cancellation_rate: number
          completed_bookings: number
          computed_at: string | null
          is_publicly_visible: boolean
          on_time_rate: number
          provider_id: string
          reliability_score: number | null
          repeat_client_rate: number
        }
        Insert: {
          avg_communication?: number
          avg_punctuality?: number
          avg_quality?: number
          avg_value?: number
          cancellation_rate?: number
          completed_bookings?: number
          computed_at?: string | null
          is_publicly_visible?: boolean
          on_time_rate?: number
          provider_id: string
          reliability_score?: number | null
          repeat_client_rate?: number
        }
        Update: {
          avg_communication?: number
          avg_punctuality?: number
          avg_quality?: number
          avg_value?: number
          cancellation_rate?: number
          completed_bookings?: number
          computed_at?: string | null
          is_publicly_visible?: boolean
          on_time_rate?: number
          provider_id?: string
          reliability_score?: number | null
          repeat_client_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_reliability_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_strikes: {
        Row: {
          appeal_upheld: boolean | null
          appealed_at: string | null
          booking_id: string | null
          created_at: string
          id: string
          issued_by: string | null
          notes: string | null
          provider_id: string
          reason: string
        }
        Insert: {
          appeal_upheld?: boolean | null
          appealed_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          provider_id: string
          reason: string
        }
        Update: {
          appeal_upheld?: boolean | null
          appealed_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          notes?: string | null
          provider_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_strikes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_strikes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_strikes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_wallets: {
        Row: {
          available_kobo: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_code: string | null
          pending_kobo: number
          provider_id: string
          updated_at: string
          withdrawn_kobo: number
        }
        Insert: {
          available_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          pending_kobo?: number
          provider_id: string
          updated_at?: string
          withdrawn_kobo?: number
        }
        Update: {
          available_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          pending_kobo?: number
          provider_id?: string
          updated_at?: string
          withdrawn_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_wallets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          address: string | null
          address_lat: number | null
          address_lng: number | null
          approved_at: string | null
          approved_by: string | null
          business_hours: Json
          business_name: string
          city_id: string | null
          confirmed_solicitation_count: number
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_on_probation: boolean
          logo_url: string | null
          rejection_reason: string | null
          slug: string
          social_links: Json
          status: Database["public"]["Enums"]["verification_status"]
          strike_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          approved_at?: string | null
          approved_by?: string | null
          business_hours?: Json
          business_name: string
          city_id?: string | null
          confirmed_solicitation_count?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_on_probation?: boolean
          logo_url?: string | null
          rejection_reason?: string | null
          slug: string
          social_links?: Json
          status?: Database["public"]["Enums"]["verification_status"]
          strike_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          approved_at?: string | null
          approved_by?: string | null
          business_hours?: Json
          business_name?: string
          city_id?: string | null
          confirmed_solicitation_count?: number
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_on_probation?: boolean
          logo_url?: string | null
          rejection_reason?: string | null
          slug?: string
          social_links?: Json
          status?: Database["public"]["Enums"]["verification_status"]
          strike_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          communication: number
          created_at: string
          customer_id: string
          id: string
          provider_id: string
          provider_replied_at: string | null
          provider_reply: string | null
          punctuality: number
          quality: number
          value: number
        }
        Insert: {
          booking_id: string
          comment?: string | null
          communication: number
          created_at?: string
          customer_id: string
          id?: string
          provider_id: string
          provider_replied_at?: string | null
          provider_reply?: string | null
          punctuality: number
          quality: number
          value: number
        }
        Update: {
          booking_id?: string
          comment?: string | null
          communication?: number
          created_at?: string
          customer_id?: string
          id?: string
          provider_id?: string
          provider_replied_at?: string | null
          provider_reply?: string | null
          punctuality?: number
          quality?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_assignments: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          assigned_by: string | null
          booking_id: string
          condition_notes: string | null
          created_at: string
          delivered_at: string | null
          fee_share_kobo: number
          id: string
          leg: number
          picked_up_at: string | null
          rider_id: string
          status: Database["public"]["Enums"]["rider_assignment_status"]
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          booking_id: string
          condition_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          fee_share_kobo?: number
          id?: string
          leg?: number
          picked_up_at?: string | null
          rider_id: string
          status?: Database["public"]["Enums"]["rider_assignment_status"]
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          booking_id?: string
          condition_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          fee_share_kobo?: number
          id?: string
          leg?: number
          picked_up_at?: string | null
          rider_id?: string
          status?: Database["public"]["Enums"]["rider_assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rider_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_assignments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_documents: {
        Row: {
          created_at: string
          id: string
          kind: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rider_id: string
          status: Database["public"]["Enums"]["verification_status"]
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id: string
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_documents_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_reliability: {
        Row: {
          cancellation_rate: number
          completed_deliveries: number
          computed_at: string | null
          is_publicly_visible: boolean
          on_time_rate: number
          reliability_score: number | null
          rider_id: string
        }
        Insert: {
          cancellation_rate?: number
          completed_deliveries?: number
          computed_at?: string | null
          is_publicly_visible?: boolean
          on_time_rate?: number
          reliability_score?: number | null
          rider_id: string
        }
        Update: {
          cancellation_rate?: number
          completed_deliveries?: number
          computed_at?: string | null
          is_publicly_visible?: boolean
          on_time_rate?: number
          reliability_score?: number | null
          rider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_reliability_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_wallets: {
        Row: {
          available_kobo: number
          bank_account_name: string | null
          bank_account_number: string | null
          bank_code: string | null
          pending_kobo: number
          rider_id: string
          updated_at: string
          withdrawn_kobo: number
        }
        Insert: {
          available_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          pending_kobo?: number
          rider_id: string
          updated_at?: string
          withdrawn_kobo?: number
        }
        Update: {
          available_kobo?: number
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_code?: string | null
          pending_kobo?: number
          rider_id?: string
          updated_at?: string
          withdrawn_kobo?: number
        }
        Relationships: [
          {
            foreignKeyName: "rider_wallets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      riders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city_id: string | null
          created_at: string
          full_name: string
          id: string
          phone: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "riders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riders_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assigned_to_booking_as_rider: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      compact_digit_runs: { Args: { body: string }; Returns: string }
      compact_letter_runs: { Args: { body: string }; Returns: string }
      current_role_name: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      fulfillment_uses_rider: {
        Args: { ft: Database["public"]["Enums"]["fulfillment_type"] }
        Returns: boolean
      }
      generate_confirmation_code: { Args: never; Returns: string }
      get_setting_numeric: {
        Args: { fallback: number; setting_key: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_feature_enabled: { Args: { flag_key: string }; Returns: boolean }
      my_provider_id: { Args: never; Returns: string }
      my_rider_id: { Args: never; Returns: string }
      owns_booking_as_customer: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      owns_booking_as_provider: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      resolve_booking_terms: {
        Args: { p_provider_id: string }
        Returns: {
          commission_percent: number
          deposit_percent: number
          late_penalty_percent_per_30min: number
          stage_1_release_percent: number
        }[]
      }
      scan_message_body: {
        Args: { body: string }
        Returns: Database["public"]["Enums"]["moderation_flag_reason"][]
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "paid_held"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
      call_status:
        | "requested"
        | "ringing"
        | "in_progress"
        | "completed"
        | "failed"
        | "no_answer"
        | "cancelled"
      delivery_mode: "rider" | "provider"
      dispute_status: "open" | "under_review" | "resolved" | "rejected"
      event_project_status: "draft" | "active" | "completed" | "cancelled"
      fulfillment_type:
        | "delivery"
        | "delivery_return"
        | "onsite_service"
        | "vendor_location_service"
      listing_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "changes_requested"
        | "paused"
        | "hidden"
      moderation_flag_reason:
        | "phone_number"
        | "bank_account"
        | "off_platform_solicitation"
      moderation_flag_status: "pending" | "confirmed" | "dismissed"
      payment_ledger_kind:
        | "hold"
        | "stage_release"
        | "commission"
        | "penalty"
        | "refund"
        | "caution_hold"
        | "caution_refund"
        | "caution_claim"
        | "rider_payout"
      payment_status:
        | "pending"
        | "held"
        | "partially_released"
        | "released"
        | "refunded"
        | "partially_refunded"
        | "failed"
      payment_type: "full" | "deposit"
      price_type: "fixed" | "negotiable"
      rider_assignment_status:
        | "assigned"
        | "accepted"
        | "declined"
        | "picked_up"
        | "en_route"
        | "delivered"
        | "returned"
        | "cancelled"
      user_role: "admin" | "provider" | "customer" | "rider"
      vehicle_type: "bike" | "car" | "van"
      verification_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
        | "suspended"
        | "removed"
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
      booking_status: [
        "pending",
        "accepted",
        "rejected",
        "paid_held",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
      ],
      call_status: [
        "requested",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "no_answer",
        "cancelled",
      ],
      delivery_mode: ["rider", "provider"],
      dispute_status: ["open", "under_review", "resolved", "rejected"],
      event_project_status: ["draft", "active", "completed", "cancelled"],
      fulfillment_type: [
        "delivery",
        "delivery_return",
        "onsite_service",
        "vendor_location_service",
      ],
      listing_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "changes_requested",
        "paused",
        "hidden",
      ],
      moderation_flag_reason: [
        "phone_number",
        "bank_account",
        "off_platform_solicitation",
      ],
      moderation_flag_status: ["pending", "confirmed", "dismissed"],
      payment_ledger_kind: [
        "hold",
        "stage_release",
        "commission",
        "penalty",
        "refund",
        "caution_hold",
        "caution_refund",
        "caution_claim",
        "rider_payout",
      ],
      payment_status: [
        "pending",
        "held",
        "partially_released",
        "released",
        "refunded",
        "partially_refunded",
        "failed",
      ],
      payment_type: ["full", "deposit"],
      price_type: ["fixed", "negotiable"],
      rider_assignment_status: [
        "assigned",
        "accepted",
        "declined",
        "picked_up",
        "en_route",
        "delivered",
        "returned",
        "cancelled",
      ],
      user_role: ["admin", "provider", "customer", "rider"],
      vehicle_type: ["bike", "car", "van"],
      verification_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
        "suspended",
        "removed",
      ],
    },
  },
} as const
