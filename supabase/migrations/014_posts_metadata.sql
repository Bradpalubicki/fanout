-- Migration 014: Add metadata and platform_config JSONB columns to posts
-- Supports Marketing Engine integration and other external API consumers
-- metadata: caller-defined fields (location_id, source_id, etc.)
-- platform_config: platform-specific params (GBP post_type, etc.) passed through to distributors

ALTER TABLE posts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_config JSONB DEFAULT '{}';

-- GIN index on location_id for Marketing Engine queries
CREATE INDEX idx_posts_metadata_location ON posts USING GIN ((metadata->'location_id'));
