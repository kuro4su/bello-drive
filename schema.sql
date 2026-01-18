-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- 1. Users Table (Custom Auth)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- bcrypt hashed
    is_admin BOOLEAN DEFAULT false,
    avatar_url TEXT,
    bio TEXT,
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 1073741824, -- 1GB Default
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. Files Table
-- =============================================
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    size BIGINT NOT NULL,
    type TEXT,
    folder_id TEXT,
    iv TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false
);

-- =============================================
-- 3. Chunks Table
-- =============================================
CREATE TABLE IF NOT EXISTS chunks (
    id BIGSERIAL PRIMARY KEY,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    url TEXT NOT NULL,
    iv TEXT,
    size BIGINT NOT NULL
);

-- =============================================
-- 4. Atomic Save RPC Function
-- =============================================
CREATE OR REPLACE FUNCTION save_file_with_chunks(
    p_file_id UUID,
    p_name TEXT,
    p_size BIGINT,
    p_type TEXT,
    p_folder_id TEXT,
    p_iv TEXT,
    p_date TIMESTAMPTZ,
    p_chunks JSONB,
    p_user_id UUID DEFAULT NULL,
    p_is_public BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
    INSERT INTO files (id, name, size, type, folder_id, iv, date, user_id, is_public)
    VALUES (p_file_id, p_name, p_size, p_type, p_folder_id, p_iv, COALESCE(p_date, NOW()), p_user_id, p_is_public)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        size = EXCLUDED.size,
        type = EXCLUDED.type,
        folder_id = EXCLUDED.folder_id,
        iv = EXCLUDED.iv,
        date = EXCLUDED.date,
        user_id = EXCLUDED.user_id,
        is_public = EXCLUDED.is_public;

    DELETE FROM chunks WHERE file_id = p_file_id;
    
    INSERT INTO chunks (file_id, chunk_index, message_id, url, iv, size)
    SELECT 
        p_file_id, 
        (value->>'index')::INT, 
        value->>'messageId', 
        value->>'url', 
        value->>'iv', 
        (value->>'size')::BIGINT
    FROM jsonb_array_elements(p_chunks);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_public ON files(is_public);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================
-- MIGRATION: Run if tables already exist
-- =============================================
-- ALTER TABLE files ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE files ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

