-- Private archive storage; original files must not be publicly accessible.
INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES ('archive-originals','archive-originals',false,52428800) ON CONFLICT(id) DO UPDATE SET public=false;
