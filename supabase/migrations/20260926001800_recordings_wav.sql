-- Allow WAV recordings: read-along clips are saved as 16 kHz WAV. Safe to re-run.
-- Only adds a type; the size limit and existing types are unchanged. A bucket with
-- no type list (NULL) already accepts everything and is left alone.
update storage.buckets
set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['audio/wav']))
where id = 'recordings' and allowed_mime_types is not null and not ('audio/wav' = any(allowed_mime_types));
