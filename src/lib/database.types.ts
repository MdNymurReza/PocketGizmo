// Generated from Supabase project xbqmvxffjpzmtrjzeidr. Regenerate after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type E = Database["public"]["Enums"];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      deals: {
        Row: { id: string; name: string; kind: E["deal_kind"]; buy_qty: number | null; get_qty: number | null; bundle_qty: number | null; bundle_price: number | null; category_id: string | null; product_ids: string[]; starts_at: string | null; ends_at: string | null; active: boolean; created_at: string };
        Insert: { id?: string; name: string; kind: E["deal_kind"]; buy_qty?: number | null; get_qty?: number | null; bundle_qty?: number | null; bundle_price?: number | null; category_id?: string | null; product_ids?: string[]; starts_at?: string | null; ends_at?: string | null; active?: boolean; created_at?: string };
        Update: { id?: string; name?: string; kind?: E["deal_kind"]; buy_qty?: number | null; get_qty?: number | null; bundle_qty?: number | null; bundle_price?: number | null; category_id?: string | null; product_ids?: string[]; starts_at?: string | null; ends_at?: string | null; active?: boolean; created_at?: string };
        Relationships: [];
      };
      collections: {
        Row: { id: string; slug: string; title: string; subtitle: string | null; banner_image: string | null; coupon_code: string | null; starts_at: string | null; ends_at: string | null; is_active: boolean; sort_order: number; created_at: string };
        Insert: { id?: string; slug: string; title: string; subtitle?: string | null; banner_image?: string | null; coupon_code?: string | null; starts_at?: string | null; ends_at?: string | null; is_active?: boolean; sort_order?: number; created_at?: string };
        Update: { id?: string; slug?: string; title?: string; subtitle?: string | null; banner_image?: string | null; coupon_code?: string | null; starts_at?: string | null; ends_at?: string | null; is_active?: boolean; sort_order?: number; created_at?: string };
        Relationships: [];
      };
      collection_products: {
        Row: { collection_id: string; product_id: string; sort_order: number };
        Insert: { collection_id: string; product_id: string; sort_order?: number };
        Update: { collection_id?: string; product_id?: string; sort_order?: number };
        Relationships: [{ foreignKeyName: "collection_products_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }, { foreignKeyName: "collection_products_collection_id_fkey"; columns: ["collection_id"]; isOneToOne: false; referencedRelation: "collections"; referencedColumns: ["id"] }];
      };
      stock_alerts: {
        Row: { id: string; variant_id: string; phone: string; user_id: string | null; created_at: string; notified_at: string | null };
        Insert: { id?: string; variant_id: string; phone: string; user_id?: string | null; created_at?: string; notified_at?: string | null };
        Update: { id?: string; variant_id?: string; phone?: string; user_id?: string | null; created_at?: string; notified_at?: string | null };
        Relationships: [{ foreignKeyName: "stock_alerts_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id"] }];
      };
      points_ledger: {
        Row: { id: string; user_id: string; delta: number; reason: "earn" | "earn_reversed" | "redeem" | "redeem_refund" | "review" | "adjust"; order_id: string | null; review_id: string | null; note: string | null; created_at: string };
        Insert: { id?: string; user_id: string; delta: number; reason: "earn" | "earn_reversed" | "redeem" | "redeem_refund" | "review" | "adjust"; order_id?: string | null; review_id?: string | null; note?: string | null; created_at?: string };
        Update: { id?: string; user_id?: string; delta?: number; reason?: "earn" | "earn_reversed" | "redeem" | "redeem_refund" | "review" | "adjust"; order_id?: string | null; review_id?: string | null; note?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "points_ledger_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }];
      };
      sms_log: {
        Row: { id: string; phone: string; event: string; order_id: string | null; message: string; ok: boolean; error: string | null; created_at: string };
        Insert: { id?: string; phone: string; event: string; order_id?: string | null; message: string; ok: boolean; error?: string | null; created_at?: string };
        Update: { id?: string; phone?: string; event?: string; order_id?: string | null; message?: string; ok?: boolean; error?: string | null; created_at?: string };
        Relationships: [];
      };
      reviews: {
        Row: { id: string; product_id: string; user_id: string; author_name: string; rating: number; comment: string; status: E["review_status"]; created_at: string; updated_at: string; photos: string[] };
        Insert: { id?: string; product_id: string; user_id: string; author_name: string; rating: number; comment?: string; status?: E["review_status"]; created_at?: string; updated_at?: string; photos?: string[] };
        Update: { id?: string; product_id?: string; user_id?: string; author_name?: string; rating?: number; comment?: string; status?: E["review_status"]; created_at?: string; updated_at?: string; photos?: string[] };
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
        Row: { details: string | null; id: string; image: string | null; line_total: number; order_id: string; product_id: string | null; product_name: string; quantity: number; unit_price: number; variant_id: string | null; variant_options: Json; preorder_qty: number };
        Insert: { details?: string | null; id?: string; image?: string | null; line_total: number; order_id: string; product_id?: string | null; product_name: string; quantity: number; unit_price: number; variant_id?: string | null; variant_options?: Json; preorder_qty?: number };
        Update: { details?: string | null; id?: string; image?: string | null; line_total?: number; order_id?: string; product_id?: string | null; product_name?: string; quantity?: number; unit_price?: number; variant_id?: string | null; variant_options?: Json; preorder_qty?: number };
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
        Row: { advance_amount: number; advance_method: E["payment_method"] | null; advance_status: "none" | "pending" | "verified" | "rejected"; coupon_code: string | null; coupon_id: string | null; courier: string | null; created_at: string; customer_email: string | null; customer_name: string; customer_phone: string; discount: number; id: string; note: string | null; order_number: string; payment_method: E["payment_method"]; payment_status: E["payment_status"]; sender_number: string | null; ship_area: string; ship_district: string; ship_line: string; ship_zone: E["shipping_zone"]; shipping_fee: number; status: E["order_status"]; subtotal: number; total: number; tracking_code: string | null; tracking_token: string; trx_id: string | null; updated_at: string; user_id: string | null; print_queued_at: string | null; deal_id: string | null; deal_name: string | null; deal_discount: number; gift_wrap: boolean; gift_message: string | null; gift_hide_prices: boolean; gift_fee: number; points_used: number; points_discount: number; consignment_id: string | null };
        Insert: { advance_amount?: number; advance_method?: E["payment_method"] | null; advance_status?: "none" | "pending" | "verified" | "rejected"; coupon_code?: string | null; coupon_id?: string | null; courier?: string | null; created_at?: string; customer_email?: string | null; customer_name: string; customer_phone: string; discount?: number; id?: string; note?: string | null; order_number?: string; payment_method: E["payment_method"]; payment_status: E["payment_status"]; sender_number?: string | null; ship_area: string; ship_district: string; ship_line: string; ship_zone: E["shipping_zone"]; shipping_fee: number; status?: E["order_status"]; subtotal: number; total: number; tracking_code?: string | null; tracking_token?: string; trx_id?: string | null; updated_at?: string; user_id?: string | null; print_queued_at?: string | null; deal_id?: string | null; deal_name?: string | null; deal_discount?: number; gift_wrap?: boolean; gift_message?: string | null; gift_hide_prices?: boolean; gift_fee?: number; points_used?: number; points_discount?: number; consignment_id?: string | null };
        Update: { advance_amount?: number; advance_method?: E["payment_method"] | null; advance_status?: "none" | "pending" | "verified" | "rejected"; coupon_code?: string | null; coupon_id?: string | null; courier?: string | null; created_at?: string; customer_email?: string | null; customer_name?: string; customer_phone?: string; discount?: number; id?: string; note?: string | null; order_number?: string; payment_method?: E["payment_method"]; payment_status?: E["payment_status"]; sender_number?: string | null; ship_area?: string; ship_district?: string; ship_line?: string; ship_zone?: E["shipping_zone"]; shipping_fee?: number; status?: E["order_status"]; subtotal?: number; total?: number; tracking_code?: string | null; tracking_token?: string; trx_id?: string | null; updated_at?: string; user_id?: string | null; print_queued_at?: string | null; deal_id?: string | null; deal_name?: string | null; deal_discount?: number; gift_wrap?: boolean; gift_message?: string | null; gift_hide_prices?: boolean; gift_fee?: number; points_used?: number; points_discount?: number; consignment_id?: string | null };
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
        Row: { base_price: number; category_id: string | null; compare_at_price: number | null; created_at: string; description: string; featured: boolean; id: string; images: string[]; is_active: boolean; name: string; slug: string; updated_at: string; preorder_enabled: boolean; preorder_note: string | null };
        Insert: { base_price: number; category_id?: string | null; compare_at_price?: number | null; created_at?: string; description?: string; featured?: boolean; id?: string; images?: string[]; is_active?: boolean; name: string; slug: string; updated_at?: string; preorder_enabled?: boolean; preorder_note?: string | null };
        Update: { base_price?: number; category_id?: string | null; compare_at_price?: number | null; created_at?: string; description?: string; featured?: boolean; id?: string; images?: string[]; is_active?: boolean; name?: string; slug?: string; updated_at?: string; preorder_enabled?: boolean; preorder_note?: string | null };
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
      supplier_payments: {
        Row: { id: string; amount: number; job_count: number; method: string | null; reference: string | null; paid_at: string; created_by: string | null };
        Insert: { id?: string; amount: number; job_count: number; method?: string | null; reference?: string | null; paid_at?: string; created_by?: string | null };
        Update: { id?: string; amount?: number; job_count?: number; method?: string | null; reference?: string | null; paid_at?: string; created_by?: string | null };
        Relationships: [];
      };
      wishlist_items: {
        Row: { user_id: string; product_id: string; created_at: string };
        Insert: { user_id: string; product_id: string; created_at?: string };
        Update: { user_id?: string; product_id?: string; created_at?: string };
        Relationships: [];
      };
      stall_products: {
        Row: { id: string; name: string; price: number; image: string | null; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; price: number; image?: string | null; is_active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; price?: number; image?: string | null; is_active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      stall_orders: {
        Row: { id: string; order_number: string; event_date: string; stall_location: string; customer_name: string; customer_phone: string; fulfilment: "pickup" | "delivery"; delivery_address: string | null; delivery_charge: number; subtotal: number; discount: number; total: number; paid_amount: number; payment_method: string | null; status: E["stall_order_status"]; due_date: string | null; note: string | null; delivered_at: string | null; created_by: string | null; created_at: string; updated_at: string; client_id: string | null };
        Insert: { id?: string; order_number?: string; event_date?: string; stall_location?: string; customer_name?: string; customer_phone?: string; fulfilment?: "pickup" | "delivery"; delivery_address?: string | null; delivery_charge?: number; subtotal?: number; discount?: number; total?: number; paid_amount?: number; payment_method?: string | null; status?: E["stall_order_status"]; due_date?: string | null; note?: string | null; delivered_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string; client_id?: string | null };
        Update: { id?: string; order_number?: string; event_date?: string; stall_location?: string; customer_name?: string; customer_phone?: string; fulfilment?: "pickup" | "delivery"; delivery_address?: string | null; delivery_charge?: number; subtotal?: number; discount?: number; total?: number; paid_amount?: number; payment_method?: string | null; status?: E["stall_order_status"]; due_date?: string | null; note?: string | null; delivered_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string; client_id?: string | null };
        Relationships: [];
      };
      stall_order_items: {
        Row: { id: string; order_id: string; name: string; details: string | null; quantity: number; unit_price: number; line_total: number };
        Insert: { id?: string; order_id?: string; name?: string; details?: string | null; quantity?: number; unit_price?: number; line_total?: number };
        Update: { id?: string; order_id?: string; name?: string; details?: string | null; quantity?: number; unit_price?: number; line_total?: number };
        Relationships: [{ foreignKeyName: "stall_order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "stall_orders"; referencedColumns: ["id"] }];
      };
      print_jobs: {
        Row: { created_at: string; details: string | null; id: string; image: string | null; order_id: string | null; order_item_id: string | null; order_number: string | null; paid: boolean; paid_at: string | null; printed_at: string | null; quantity: number; status: E["print_job_status"]; supplier_note: string | null; title: string; unit_cost: number | null; updated_at: string; variant: string | null; payment_id: string | null; stall_order_id: string | null };
        Insert: { created_at?: string; details?: string | null; id?: string; image?: string | null; order_id?: string | null; order_item_id?: string | null; order_number?: string | null; paid?: boolean; paid_at?: string | null; printed_at?: string | null; quantity: number; status?: E["print_job_status"]; supplier_note?: string | null; title: string; unit_cost?: number | null; updated_at?: string; variant?: string | null; payment_id?: string | null; stall_order_id?: string | null };
        Update: { created_at?: string; details?: string | null; id?: string; image?: string | null; order_id?: string | null; order_item_id?: string | null; order_number?: string | null; paid?: boolean; paid_at?: string | null; printed_at?: string | null; quantity?: number; status?: E["print_job_status"]; supplier_note?: string | null; title?: string; unit_cost?: number | null; updated_at?: string; variant?: string | null; payment_id?: string | null; stall_order_id?: string | null };
        Relationships: [];
      };
      settings: {
        Row: { cod_advance: "off" | "outside_dhaka" | "all"; max_print_colors: number; bkash_number: string | null; contact_email: string | null; contact_phone: string | null; facebook_url: string | null; free_shipping_over: number | null; id: number; nagad_number: string | null; payment_instructions: string; rocket_number: string | null; shipping_inside_dhaka: number; shipping_outside_dhaka: number; store_name: string; updated_at: string; gift_enabled: boolean; gift_wrap_fee: number; sms_enabled: boolean; sms_events: string[]; whatsapp_number: string | null; messenger_url: string | null; points_enabled: boolean; points_spend_per_point: number; points_review: number; points_max_pct: number };
        Insert: { cod_advance?: "off" | "outside_dhaka" | "all"; max_print_colors?: number; bkash_number?: string | null; contact_email?: string | null; contact_phone?: string | null; facebook_url?: string | null; free_shipping_over?: number | null; id?: number; nagad_number?: string | null; payment_instructions?: string; rocket_number?: string | null; shipping_inside_dhaka?: number; shipping_outside_dhaka?: number; store_name?: string; updated_at?: string; gift_enabled?: boolean; gift_wrap_fee?: number; sms_enabled?: boolean; sms_events?: string[]; whatsapp_number?: string | null; messenger_url?: string | null; points_enabled?: boolean; points_spend_per_point?: number; points_review?: number; points_max_pct?: number };
        Update: { cod_advance?: "off" | "outside_dhaka" | "all"; max_print_colors?: number; bkash_number?: string | null; contact_email?: string | null; contact_phone?: string | null; facebook_url?: string | null; free_shipping_over?: number | null; id?: number; nagad_number?: string | null; payment_instructions?: string; rocket_number?: string | null; shipping_inside_dhaka?: number; shipping_outside_dhaka?: number; store_name?: string; updated_at?: string; gift_enabled?: boolean; gift_wrap_fee?: number; sms_enabled?: boolean; sms_events?: string[]; whatsapp_number?: string | null; messenger_url?: string | null; points_enabled?: boolean; points_spend_per_point?: number; points_review?: number; points_max_pct?: number };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_phone_stats: { Args: { p_phones: string[] }; Returns: { phone: string; total: number; delivered: number; cancelled: number; blocked: boolean; block_reason: string | null }[] };
      admin_adjust_stock: { Args: { p_delta: number; p_note: string; p_reason: E["inventory_reason"]; p_variant: string }; Returns: number };
      admin_set_order_status: { Args: { p_note: string; p_order: string; p_status: E["order_status"] }; Returns: undefined };
      admin_list_suppliers: { Args: never; Returns: { id: string; email: string; full_name: string | null }[] };
      admin_send_order_to_print: { Args: { p_order: string }; Returns: number };
      admin_set_supplier: { Args: { p_email: string; p_on: boolean }; Returns: undefined };
      supplier_update_job: { Args: { p_job: string; p_status: E["print_job_status"] | null; p_unit_cost: number | null; p_note: string | null; p_clear_cost?: boolean }; Returns: undefined };
      admin_pay_jobs: { Args: { p_ids: string[] | null; p_expected_total: number | null; p_method?: string | null; p_reference?: string | null }; Returns: number };
      stall_create_order: { Args: { p: Json; p_send_to_print?: boolean }; Returns: { id: string; order_number: string } };
      stall_set_status: { Args: { p_order: string; p_status: E["stall_order_status"] }; Returns: undefined };
      stall_record_payment: { Args: { p_order: string; p_amount: number; p_method?: string | null }; Returns: number };
      stall_summary: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: {
          totals: { orders: number; revenue: number; collected: number; due: number; open: number; delivered: number; cancelled: number };
          print_cost: number;
          by_status: Partial<Record<E["stall_order_status"], number>>;
          by_date: { date: string; location: string; orders: number; revenue: number; collected: number }[];
          top_items: { name: string; quantity: number; revenue: number }[];
        };
      };
      track_stall_order: {
        Args: { p_order_number: string; p_phone: string };
        Returns: {
          order_number: string; status: E["stall_order_status"]; customer_name: string; fulfilment: "pickup" | "delivery";
          subtotal: number; discount: number; delivery_charge: number; total: number; paid_amount: number;
          due_date: string | null; created_at: string; delivered_at: string | null;
          items: { name: string; details: string | null; quantity: number; line_total: number }[];
        } | null;
      };
      admin_unpay_job: { Args: { p_job: string }; Returns: undefined };
      admin_profit_summary: { Args: { p_from: string; p_to: string }; Returns: { sales: number; cost: number; profit: number; counted_orders: number; uncounted_orders: number } };
      print_job_summary: { Args: never; Returns: { to_print: number; printing: number; printed: number; earned: number; paid: number; due: number; payable_count: number; missing_cost: number; count_todo: number; count_done: number; count_unpaid: number; count_paid: number; count_all: number } };
      is_supplier: { Args: never; Returns: boolean };
      can_review: { Args: { p_product: string }; Returns: boolean };
      submit_review: { Args: { p_product: string; p_rating: number; p_comment: string; p_photos?: string[] }; Returns: E["review_status"] };
      compute_coupon_discount: { Args: { p_code: string; p_subtotal: number; p_user: string }; Returns: { coupon_id: string; discount: number; error: string }[] };
      is_admin: { Args: never; Returns: boolean };
      quote_order: { Args: { p_items: Json; p_coupon_code: string; p_zone: E["shipping_zone"]; p_points: number; p_gift: boolean }; Returns: OrderQuote };
      request_stock_alert: { Args: { p_variant: string; p_phone: string }; Returns: undefined };
      log_order_sms: { Args: { p_token: string; p_phone: string; p_message: string; p_ok: boolean; p_error: string }; Returns: undefined };
      points_balance: { Args: { p_user: string }; Returns: number };
      compute_deal_discount: { Args: { p_items: Json }; Returns: { deal_id: string | null; deal_name: string | null; discount: number }[] };
      place_order: {
        Args: { p_area: string; p_coupon_code: string; p_customer_email: string; p_customer_name: string; p_customer_phone: string; p_district: string; p_items: Json; p_line: string; p_note: string; p_payment_method: E["payment_method"]; p_sender_number: string; p_trx_id: string; p_zone: E["shipping_zone"]; p_advance_method?: E["payment_method"]; p_points?: number; p_gift_wrap?: boolean; p_gift_message?: string; p_gift_hide_prices?: boolean };
        Returns: { order_number: string; tracking_token: string }[];
      };
      respond_to_quote: { Args: { p_id: string; p_accept: boolean }; Returns: undefined };
      sales_summary: { Args: { p_from: string; p_to: string }; Returns: Json };
      track_order: { Args: { p_order_number: string; p_phone: string; p_token: string }; Returns: Json };
      validate_coupon: { Args: { p_code: string; p_subtotal: number }; Returns: { discount: number; error: string }[] };
    };
    Enums: {
      deal_kind: "buy_x_get_y" | "n_for_price";
      stall_order_status: "new" | "printing" | "ready" | "delivered" | "cancelled";
      coupon_type: "percent" | "fixed";
      custom_request_status: "new" | "quoted" | "accepted" | "rejected" | "done";
      inventory_reason: "order" | "restock" | "adjust" | "cancel";
      order_status: "pending" | "confirmed" | "printing" | "shipped" | "delivered" | "cancelled";
      payment_method: "cod" | "bkash" | "nagad" | "rocket";
      print_job_status: "to_print" | "printing" | "printed" | "received" | "cancelled";
      payment_status: "unpaid" | "pending_verification" | "paid" | "rejected" | "refunded";
      review_status: "pending" | "approved" | "rejected";
      shipping_zone: "inside_dhaka" | "outside_dhaka";
      user_role: "customer" | "admin" | "supplier";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export type OrderQuote = {
  subtotal: number; deal_name: string | null; deal_discount: number; coupon_discount: number; coupon_error: string | null;
  shipping: number; gift_fee: number; points_balance: number; points_max: number; points_used: number; total: number; earn_points: number;
};
