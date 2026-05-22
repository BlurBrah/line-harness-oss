-- Add trigger_tag_id to conversion_points for tag-based CV auto-fire
ALTER TABLE conversion_points ADD COLUMN trigger_tag_id TEXT REFERENCES tags (id) ON DELETE SET NULL;
