-- Add trigger_tracked_link_id to conversion_points for link-click-based CV auto-fire
ALTER TABLE conversion_points ADD COLUMN trigger_tracked_link_id TEXT REFERENCES tracked_links (id) ON DELETE SET NULL;
