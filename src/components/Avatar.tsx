import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { View, Alert, Image, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";

interface Props {
  size?: number;
  url: string | null;
  onUpload: (filePath: string) => void;
}

export default function Avatar({ url, size = 150, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarSize = { height: size, width: size };

  useEffect(() => {
    let live = true;
    let reader: FileReader | null = null;
    async function downloadImage() {
      if (!supabase || !url) {
        setAvatarUrl(null);
        return;
      }
      try {
        const { data, error } = await supabase.storage
          .from("avatars")
          .download(url);
        if (error) throw error;
        if (!live) return;
        reader = new FileReader();
        reader.onload = () => {
          if (live) setAvatarUrl(reader?.result as string);
        };
        reader.readAsDataURL(data);
      } catch (error) {
        if (live) setAvatarUrl(null);
        console.warn(
          "Error downloading avatar:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
    void downloadImage();
    return () => {
      live = false;
      if (reader?.readyState === 1) reader.abort();
    };
  }, [url]);

  async function uploadAvatar() {
    if (!supabase) return;
    try {
      setUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], // Restrict to only images
        allowsMultipleSelection: false, // Can only select one image
        allowsEditing: true, // Allows the user to crop / rotate their photo before uploading it
        quality: 1,
        exif: false, // We don't want nor need that data.
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("User cancelled image picker.");
        return;
      }

      const image = result.assets[0];

      if (!image.uri) {
        throw new Error("No image uri!"); // Realistically, this should never happen, but just in case...
      }

      const arraybuffer = await fetch(image.uri).then((res) =>
        res.arrayBuffer(),
      );

      const fileExt = image.uri?.split(".").pop()?.toLowerCase() ?? "jpeg";
      const path = `${Date.now()}.${fileExt}`;
      const { data, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, arraybuffer, {
          contentType: image.mimeType ?? "image/jpeg",
        });

      if (uploadError) {
        throw uploadError;
      }

      onUpload(data.path);
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="mt-5 items-center justify-center">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          accessibilityLabel="Avatar"
          style={avatarSize}
          className="mb-5 max-w-full overflow-hidden rounded-[5px] object-cover"
        />
      ) : (
        <View
          style={avatarSize}
          className="mb-5 max-w-full overflow-hidden rounded-[5px] border border-line bg-cream"
        />
      )}
      <View>
        <TouchableOpacity
          accessibilityRole="button"
          className={`min-h-[50px] items-center justify-center rounded-[10px] bg-cocoa px-[22px] ${uploading || !supabase ? "opacity-50" : ""}`}
          onPress={uploadAvatar}
          disabled={uploading || !supabase}
        >
          <Text className="text-[14px] font-medium text-paper">
            {uploading ? "Uploading ..." : "Upload"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
