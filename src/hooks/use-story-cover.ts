import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

type Pending = {
  key: string;
  /** undefined: no change since the last save. '': cover removed. Otherwise the uploaded path. */
  path: string | undefined;
  /** The picked image on this device, shown until a signed link replaces it. */
  localUri: string | null;
};

const extensions: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/**
 * The current story's cover. A picked image uploads right away to
 * recordings/<user>/<story id>/ and is sent with the next Save or Publish.
 */
export function useStoryCover(userId: string | null, authLoading: boolean, projectId: string | null, savedPath?: string | null) {
  const key = `tedtime.story-cover.v1.${userId ?? 'guest'}${projectId ? `.${projectId}` : ''}`;
  const [pending, setPending] = useState<Pending | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);

  // Restore a cover picked earlier but not yet saved to the account.
  useEffect(() => {
    if (authLoading) return;
    let live = true;
    void AsyncStorage.getItem(key).then(path => {
      if (live) setPending(current => current?.key === key ? current : { key, path: path ?? undefined, localUri: null });
    }).catch(() => {
      if (live) setPending({ key, path: undefined, localUri: null });
    });
    return () => { live = false; };
  }, [authLoading, key]);

  const current = pending?.key === key ? pending : null;
  const path = current?.path !== undefined ? current.path || null : savedPath ?? null;

  // Covers are private files, so show them through a short-lived link.
  useEffect(() => {
    if (!path || !supabase || signed?.path === path) return;
    let live = true;
    void supabase.storage.from('recordings').createSignedUrl(path, 3600).then(({ data }) => {
      if (live && data?.signedUrl) setSigned({ path, url: data.signedUrl });
    });
    return () => { live = false; };
  }, [path, signed?.path]);

  const remember = useCallback((next: string) => {
    void AsyncStorage.setItem(key, next).catch(() => { /* The cover still saves with this session. */ });
  }, [key]);

  const pick = useCallback(async () => {
    if (!userId || !supabase) throw new Error('Sign in to add a cover image.');
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, exif: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const image = result.assets[0];
    setUploading(true);
    try {
      const type = image.mimeType ?? 'image/jpeg';
      // all_stories requires covers inside <author>/<story id>/; the legacy draft's id is the author's.
      const uploadPath = `${userId}/${projectId ?? userId}/cover_${Date.now()}.${extensions[type] ?? 'jpg'}`;
      const bytes = Platform.OS === 'web'
        ? await (await fetch(image.uri)).blob()
        : await new File(image.uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage.from('recordings')
        .upload(uploadPath, bytes, { contentType: type, upsert: false });
      if (uploadError) throw uploadError;
      setPending({ key, path: uploadPath, localUri: image.uri });
      remember(uploadPath);
    } catch {
      setError('The cover could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [key, projectId, remember, userId]);

  const remove = useCallback(() => {
    setError('');
    setPending({ key, path: '', localUri: null });
    remember('');
  }, [key, remember]);

  return {
    /** What to show: the just-picked image, or the saved cover's signed link. */
    previewUri: path ? current?.localUri ?? (signed?.path === path ? signed.url : null) : null,
    hasCover: Boolean(path),
    /** Send with Save/Publish: undefined leaves the saved cover unchanged. */
    pathForSave: current?.path,
    unsaved: current?.path !== undefined && current.path !== (savedPath ?? ''),
    uploading,
    error,
    pick: () => pick().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not open your photos.')),
    remove,
  };
}
