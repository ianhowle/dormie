import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchCourseImage,
  getGradientForCourse,
  isUnsplashConfigured,
} from '../services/courseImages.service';

// ─── Shimmer placeholder ─────────────────────────────────────────────
function ShimmerPlaceholder() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: 'rgba(255,255,255,0.08)',
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

// ─── Attribution badge ───────────────────────────────────────────────
function UnsplashAttribution() {
  return (
    <Text style={attrStyles.text}>Photo: Unsplash</Text>
  );
}

const attrStyles = StyleSheet.create({
  text: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontWeight: '500',
  },
});

// ─── CourseImage component ───────────────────────────────────────────
type CourseImageProps = {
  courseName: string;
  location?: string;
  gradient?: [string, string];
  imageUrl?: string | null;
  style?: any;
  children?: React.ReactNode;
  showAttribution?: boolean;
  height?: number;
};

export function CourseImage({
  courseName,
  location,
  gradient,
  imageUrl: providedUrl,
  style,
  children,
  showAttribution = true,
  height,
}: CourseImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(providedUrl ?? null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const fallbackGradient = gradient ?? getGradientForCourse(courseName);

  useEffect(() => {
    if (providedUrl) {
      setImageUrl(providedUrl);
      setImageError(false);
      return;
    }

    if (!isUnsplashConfigured()) return;

    let cancelled = false;
    setLoading(true);
    fetchCourseImage(courseName, location).then((url) => {
      if (!cancelled) {
        if (url) setImageUrl(url);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [courseName, location, providedUrl]);

  const showImage = imageUrl && !imageError;

  return (
    <View style={[styles.container, height != null && { height }, style]}>
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
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
      {loading && !showImage && <ShimmerPlaceholder />}
      {children}
      {showImage && showAttribution && <UnsplashAttribution />}
    </View>
  );
}

// ─── DestinationImage component ──────────────────────────────────────
type DestinationImageProps = {
  name: string;
  imageUrl?: string | null;
  gradient: [string, string];
  style?: any;
  children?: React.ReactNode;
  showAttribution?: boolean;
};

export function DestinationImage({
  name,
  imageUrl,
  gradient,
  style,
  children,
  showAttribution = true,
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
      {showImage && showAttribution && <UnsplashAttribution />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
