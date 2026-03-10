-- Migration: 0006_add_knowledge_points
-- Add knowledge_points field to chapters table
ALTER TABLE chapters ADD COLUMN knowledge_points TEXT;
