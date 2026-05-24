-- migrate:up
-- Ensure the demovti tenant exists for UAT / staging public portal testing.
-- The public application form at /apply/demovti requires this slug to resolve.
-- Uses ON CONFLICT DO NOTHING so this is safe to run on any environment.

INSERT INTO platform.tenants (id, slug, name, is_active)
VALUES (
  'de000000-0000-0000-0000-000000000003',
  'demovti',
  'Demo Vocational Training Institute',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- migrate:down
DELETE FROM platform.tenants WHERE slug = 'demovti';
