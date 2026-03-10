-- Migration: 0005_add_chapter_content
-- Add content (markdown body) field to chapters table
ALTER TABLE chapters ADD COLUMN content TEXT;
