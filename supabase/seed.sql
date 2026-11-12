-- Sample catalog for development
insert into categories (name, slug, sort_order) values
  ('Phone Stands', 'phone-stands', 1),
  ('Desk Organizers', 'desk-organizers', 2),
  ('Keychains', 'keychains', 3),
  ('Cable Clips', 'cable-clips', 4);

with p as (
  insert into products (name, slug, description, category_id, base_price, featured)
  values
    ('Wobble Phone Stand', 'wobble-phone-stand', 'A bouncy, adjustable phone stand printed in tough PETG. Fits phones 4"–7".',
      (select id from categories where slug = 'phone-stands'), 450, true),
    ('Hex Pen Pod', 'hex-pen-pod', 'Honeycomb desk organizer for pens, brushes and tiny tools.',
      (select id from categories where slug = 'desk-organizers'), 380, true),
    ('Mini Gizmo Keychain', 'mini-gizmo-keychain', 'Pocket-sized robot keychain. Snap-fit, no glue.',
      (select id from categories where slug = 'keychains'), 150, true),
    ('Cable Critters (6 pack)', 'cable-critters', 'Cute clips that keep your cables tidy on any desk edge.',
      (select id from categories where slug = 'cable-clips'), 250, false)
  returning id, slug, base_price
)
insert into product_variants (product_id, sku, options, price, stock)
select p.id, upper(replace(p.slug, '-', '')) || '-' || c.code, jsonb_build_object('color', c.color), p.base_price, c.stock
from p cross join (values ('RED', 'Coral Red', 8), ('YEL', 'Sunny Yellow', 5), ('MNT', 'Mint', 2)) as c(code, color, stock);

insert into coupons (code, type, value, min_order, max_discount, usage_limit)
values ('WELCOME10', 'percent', 10, 300, 200, 100);

update settings set bkash_number = '01XXXXXXXXX', nagad_number = '01XXXXXXXXX', rocket_number = '01XXXXXXXXX-X';
