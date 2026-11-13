// Generated from Supabase project xbqmvxffjpzmtrjzeidr. Regenerate after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      reviews: {
        Row: { id: string; product_id: string; user_id: string; author_name: string; rating: number; comment: string; status: E["review_status"]; created_at: string; updated_at: string };
        Insert: { id?: string; product_id: string; user_id: string; author_name: string; rating: number; comment?: string; status?: E["review_status"]; created_at?: string; updated_at?: string };
        Update: { id?: string; product_id?: string; user_id?: string; author_name?: string; rating?: number; comment?: string; status?: E["review_status"]; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "reviews_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
      filaments: {
        Row: { id: string; material: string; color: string; hex: string | null; in_stock: boolean; created_at: string };
        Insert: { id?: string; material: string; color: string; hex?: string | null; in_stock?: boolean; created_at?: string };
        Update: { id?: string; material?: string; color?: string; hex?: string | null; in_stock?: boolean; created_at?: string };
        Relationships: [];
      };
      blocked_phones: {
        Row: { phone: string; reason: string | null; created_at: string; created_by: string | null };
        Insert: { phone: string; reason?: string | null; created_at?: string; created_by?: string | null };
        Update: { phone?: string; reason?: string | null; created_at?: string; created_by?: string | null };
        Relationships: [];
      };
      addresses: {
        Row: { area: string; created_at: string; district: string; id: string; is_default: boolean; line: string; name: string; phone: string; user_id: string; zone: E["shipping_zone"] };
        Insert: { area: string; created_at?: string; district: string; id?: string; is_default?: boolean; line: string; name: string; phone: string; user_id: string; zone?: E["shipping_zone"] };
        Update: { area?: string; created_at?: string; district?: string; id?: string; is_default?: boolean; line?: string; name?: string; phone?: string; user_id?: string; zone?: E["shipping_zone"] };
        Relationships: [];
      };
      categories: {
        Row: { created_at: string; id: string; image: string | null; name: string; slug: string; sort_order: number };
        Insert: { created_at?: string; id?: string; image?: string | null; name: string; slug: string; sort_order?: number };
        Update: { created_at?: string; id?: string; image?: string | null; name?: string; slug?: string; sort_order?: number };
        Relationships: [];
      };
      coupons: {
        Row: { active: boolean; code: string; created_at: string; ends_at: string | null; id: string; max_discount: number | null; min_order: number; per_user_limit: number | null; starts_at: string | null; type: E["coupon_type"]; usage_limit: number | null; used_count: number; value: number };
        Insert: { active?: boolean; code: string; created_at?: string; ends_at?: string | null; id?: string; max_discount?: number | null; min_order?: number; per_user_limit?: number | null; starts_at?: string | null; type: E["coupon_type"]; usage_limit?: number | null; used_count?: number; value: number };
        Update: { active?: boolean; code?: string; created_at?: string; ends_at?: string | null; id?: string; max_discount?: number | null; min_order?: number; per_user_limit?: number | null; starts_at?: string | null; type?: E["coupon_type"]; usage_limit?: number | null; used_count?: number; value?: number };
        Relationships: [];
      };
      custom_requests: {
        Row: { admin_note: string | null; color: string | null; created_at: string; description: string; email: string | null; files: string[]; id: string; material: string | null; name: string; phone: string; quantity: number; quoted_price: number | null; status: E["custom_request_status"]; updated_at: string; user_id: string | null };
        Insert: { admin_note?: string | null; color?: string | null; created_at?: string; description: string; email?: string | null; files?: string[]; id?: string; material?: string | null; name: string; phone: string; quantity?: number; quoted_price?: number | null; status?: E["custom_request_status"]; updated_at?: string; user_id?: string | null };
        Update: { admin_note?: string | null; color?: string | null; created_at?: string; description?: string; email?: string | null; files?: string[]; id?: string; material?: string | null; name?: string; phone?: string; quantity?: number; quoted_price?: number | null; status?: E["custom_request_status"]; updated_at?: string; user_id?: string | null };
        Relationships: [];
      };
      inventory_movements: {
        Row: { created_at: string; created_by: string | null; delta: number; id: string; note: string | null; order_id: string | null; reason: E["inventory_reason"]; variant_id: string };
        Insert: { created_at?: string; created_by?: string | null; delta: number; id?: string; note?: string | null; order_id?: string | null; reason: E["inventory_reason"]; variant_id: string };
        Update: { created_at?: string; created_by?: string | null; delta?: number; id?: string; note?: string | null; order_id?: string | null; reason?: E["inventory_reason"]; variant_id?: string };
        Relationships: [
          { foreignKeyName: "inventory_movements_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_movements_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id"] },
        ];
      };
      order_items: {
        Row: { id: string; image: string | null; line_total: number; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; variant_id: string | null; variant_options: Json };
        Insert: { id?: string; image?: string | null; line_total: number; order_id: string; product_id?: string | null; product_name: string; quantity: number; unit_price: number; variant_id?: string | null; variant_options?: Json };
        Update: { id?: string; image?: string | null; line_total?: number; order_id?: string; product_id?: string | null; product_name?: string; quantity?: number; unit_price?: number; variant_id?: string | null; variant_options?: Json };
        Relationships: [
          { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id"] },
        ];
      };
      order_status_history: {
        Row: { created_at: string; id: string; note: string | null; order_id: string; status: E["order_status"] };
        Insert: { created_at?: string; id?: string; note?: string | null; order_id: string; status: E["order_status"] };
        Update: { created_at?: string; id?: string; note?: string | null; order_id?: string; status?: E["order_status"] };
        Relationships: [
          { foreignKeyName: "order_status_history_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
        ];
      };
      orders: {
        Row: { advance_amount: number; advance_method: E["payment_method"] | null; advance_status: "none" | "pending" | "verified" | "rejected"; coupon_code: string | null; coupon_id: string | null; courier: string | null; created_at: string; customer_email: string | null; customer_name: string; customer_phone: string; discount: number; id: string; note: string | null; order_number: string; payment_method: E["payment_method"]; payment_status: E["payment_status"]; sender_number: string | null; ship_area: string; ship_district: string; ship_line: string; ship_zone: E["shipping_zone"]; shipping_fee: number; status: E["order_status"]; subtotal: number; total: number; tracking_code: string | null; tracking_token: string; trx_id: string | null; updated_at: string; user_id: string | null };
        Insert: { advance_amount?: number; advance_method?: E["payment_method"] | null; advance_status?: "none" | "pending" | "verified" | "rejected"; coupon_code?: string | null; coupon_id?: string | null; courier?: string | null; created_at?: string; customer_email?: string | null; customer_name: string; customer_phone: string; discount?: number; id?: string; note?: string | null; order_number?: string; payment_method: E["payment_method"]; payment_status: E["payment_status"]; sender_number?: string | null; ship_area: string; ship_district: string; ship_line: string; ship_zone: E["shipping_zone"]; shipping_fee: number; status?: E["order_status"]; subtotal: number; total: number; tracking_code?: string | null; tracking_token?: string; trx_id?: string | null; updated_at?: string; user_id?: string | null };
        Update: { advance_amount?: number; advance_method?: E["payment_method"] | null; advance_status?: "none" | "pending" | "verified" | "rejected"; coupon_code?: string | null; coupon_id?: string | null; courier?: string | null; created_at?: string; customer_email?: string | null; customer_name?: string; customer_phone?: string; discount?: number; id?: string; note?: string | null; order_number?: string; payment_method?: E["payment_method"]; payment_status?: E["payment_status"]; sender_number?: string | null; ship_area?: string; ship_district?: string; ship_line?: string; ship_zone?: E["shipping_zone"]; shipping_fee?: number; status?: E["order_status"]; subtotal?: number; total?: number; tracking_code?: string | null; tracking_token?: string; trx_id?: string | null; updated_at?: string; user_id?: string | null };
        Relationships: [
          { foreignKeyName: "orders_coupon_id_fkey"; columns: ["coupon_id"]; isOneToOne: false; referencedRelation: "coupons"; referencedColumns: ["id"] },
        ];
      };
      product_variants: {
        Row: { created_at: string; id: string; is_active: boolean; low_stock_threshold: number; options: Json; price: number; product_id: string; sku: string | null; sort_order: number; stock: number };
        Insert: { created_at?: string; id?: string; is_active?: boolean; low_stock_threshold?: number; options?: Json; price: number; product_id: string; sku?: string | null; sort_order?: number; stock?: number };
        Update: { created_at?: string; id?: string; is_active?: boolean; low_stock_threshold?: number; options?: Json; price?: number; product_id?: string; sku?: string | null; sort_order?: number; stock?: number };
        Relationships: [
          { foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      products: {
        Row: { base_price: number; category_id: string | null; compare_at_price: number | null; created_at: string; description: string; featured: boolean; id: string; images: string[]; is_active: boolean; name: string; slug: string; updated_at: string };
        Insert: { base_price: number; category_id?: string | null; compare_at_price?: number | null; created_at?: string; description?: string; featured?: boolean; id?: string; images?: string[]; is_active?: boolean; name: string; slug: string; updated_at?: string };
        Update: { base_price?: number; category_id?: string | null; compare_at_price?: number | null; created_at?: string; description?: string; featured?: boolean; id?: string; images?: string[]; is_active?: boolean; name?: string; slug?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: { created_at: string; full_name: string | null; id: string; phone: string | null; role: E["user_role"] };
        Insert: { created_at?: string; full_name?: string | null; id: string; phone?: string | null; role?: E["user_role"] };
        Update: { created_at?: string; full_name?: string | null; id?: string; phone?: string | null; role?: E["user_role"] };
        Relationships: [];
      };
      settings: {
        Row: { cod_advance: "off" | "outside_dhaka" | "all"; max_print_colors: number; bkash_number: string | null; contact_email: string | null; contact_phone: string | null; facebook_url: string | null; free_shipping_over: number | null; id: number; nagad_number: string | null; payment_instructions: string; rocket_number: string | null; shipping_inside_dhaka: number; shipping_outside_dhaka: number; store_name: string; updated_at: string };
        Insert: { cod_advance?: "off" | "outside_dhaka" | "all"; max_print_colors?: number; bkash_number?: string | null; contact_email?: string | null; contact_phone?: string | null; facebook_url?: string | null; free_shipping_over?: number | null; id?: number; nagad_number?: string | null; payment_instructions?: string; rocket_number?: string | null; shipping_inside_dhaka?: number; shipping_outside_dhaka?: number; store_name?: string; updated_at?: string };
        Update: { cod_advance?: "off" | "outside_dhaka" | "all"; max_print_colors?: number; bkash_number?: string | null; contact_email?: string | null; contact_phone?: string | null; facebook_url?: string | null; free_shipping_over?: number | null; id?: number; nagad_number?: string | null; payment_instructions?: string; rocket_number?: string | null; shipping_inside_dhaka?: number; shipping_outside_dhaka?: number; store_name?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_phone_stats: { Args: { p_phones: string[] }; Returns: { phone: string; total: number; delivered: number; cancelled: number; blocked: boolean; block_reason: string | null }[] };
      admin_adjust_stock: { Args: { p_delta: number; p_note: string; p_reason: E["inventory_reason"]; p_variant: string }; Returns: number };
      admin_set_order_status: { Args: { p_note: string; p_order: string; p_status: E["order_status"] }; Returns: undefined };
      can_review: { Args: { p_product: string }; Returns: boolean };
      submit_review: { Args: { p_product: string; p_rating: number; p_comment: string }; Returns: E["review_status"] };
      compute_coupon_discount: { Args: { p_code: string; p_subtotal: number; p_user: string }; Returns: { coupon_id: string; discount: number; error: string }[] };
      is_admin: { Args: never; Returns: boolean };
      place_order: {
        Args: { p_area: string; p_coupon_code: string; p_customer_email: string; p_customer_name: string; p_customer_phone: string; p_district: string; p_items: Json; p_line: string; p_note: string; p_payment_method: E["payment_method"]; p_sender_number: string; p_trx_id: string; p_zone: E["shipping_zone"]; p_advance_method?: E["payment_method"] };
        Returns: { order_number: string; tracking_token: string }[];
      };
      respond_to_quote: { Args: { p_id: string; p_accept: boolean }; Returns: undefined };
      sales_summary: { Args: { p_from: string; p_to: string }; Returns: Json };
      track_order: { Args: { p_order_number: string; p_phone: string; p_token: string }; Returns: Json };
      validate_coupon: { Args: { p_code: string; p_subtotal: number }; Returns: { discount: number; error: string }[] };
    };
    Enums: {
      coupon_type: "percent" | "fixed";
      custom_request_status: "new" | "quoted" | "accepted" | "rejected" | "done";
      inventory_reason: "order" | "restock" | "adjust" | "cancel";
      order_status: "pending" | "confirmed" | "printing" | "shipped" | "delivered" | "cancelled";
      payment_method: "cod" | "bkash" | "nagad" | "rocket";
      payment_status: "unpaid" | "pending_verification" | "paid" | "rejected" | "refunded";
      review_status: "pending" | "approved" | "rejected";
      shipping_zone: "inside_dhaka" | "outside_dhaka";
      user_role: "customer" | "admin";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
