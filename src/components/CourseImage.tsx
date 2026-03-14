import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchCourseImage,
  getGradientForCourse,
} from '../services/courseImages.service';

type CourseImageProps = {
  courseName: string;
  location?: string;
  gradient?: [string, string];
  imageUrl?: string | null;
  style?: any;
  children?: React.ReactNode;
};

export function CourseImage({
  courseName,
  location,
  gradient,
  imageUrl: providedUrl,
  style,
  children,
}: CourseImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(providedUrl ?? null);
  const [imageError, setImageError] = useState(false);
  const fallbackGradient = gradient ?? getGradientForCourse(courseName);

  useEffect(() => {
    if (providedUrl) {
      setImageUrl(providedUrl);
      setImageError(false);
      return;
    }

    let cancelled = false;
    fetchCourseImage(courseName, location).then((url) => {
      if (!cancelled && url) {
        setImageUrl(url);
      }
    });
    return () => { cancelled = true; };
  }, [courseName, location, providedUrl]);

  const showImage = imageUrl && !imageError;

  return (
    <View style={[styles.container, style]}>
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          placeholder={{ thumbhash: undefined }}
          transition={300}
          onError={() => setImageError(true)}
        />
      ) : (
        <LinearGradient
          colors={fallbackGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {children}
    </View>
  );
}

type DestinationImageProps = {
  name: string;
  imageUrl?: string | null;
  gradient: [string, string];
  style?: any;
  children?: React.ReactNode;
};

export function DestinationImage({
  name,
  imageUrl,
  gradient,
  style,
  children,
}: DestinationImageProps) {
  const [error, setError] = useState(false);
  const showImage = imageUrl && !error;

  return (
    <View style={[styles.container, style]}>
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={300}
          onError={() => setError(true)}
        />
      ) : (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
