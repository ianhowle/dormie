import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchCourseImage,
  fetchDreamImage,
  getGradientForCourse,
  isGooglePlacesConfigured,
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
function GoogleAttribution() {
  return (
    <Text style={attrStyles.text}>Google</Text>
  );
}

const attrStyles = StyleSheet.create({
  text: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    color: 'rgba(255,255,255,0.25)',
    fontSize: 7,
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
  isHero?: boolean;
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
  isHero = false,
}: CourseImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(providedUrl ?? null);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Always fall back to Augusta green gradient when photo fails
  const AUGUSTA_GREEN_FALLBACK: [string, string] = ['#1E4D2B', '#0D2818'];
  const fallbackGradient = gradient ?? AUGUSTA_GREEN_FALLBACK;
  const maxWidth = isHero ? 1200 : 800;

  useEffect(() => {
    if (providedUrl) {
      setImageUrl(providedUrl);
      setImageError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    console.warn('[COURSE_IMAGE] Rendering for:', courseName, 'photoRef:', providedUrl);
    fetchCourseImage(courseName, location, maxWidth).then((url) => {
      if (cancelled) return;
      if (url) {
        setImageUrl(url);
        setLoading(false);
      } else {
        // Retry once after 2s
        setTimeout(() => {
          if (cancelled) return;
          fetchCourseImage(courseName, location, maxWidth).then((retryUrl) => {
            if (!cancelled) {
              if (retryUrl) setImageUrl(retryUrl);
              setLoading(false);
            }
          }).catch((err) => {
            console.error('[COURSE_IMAGE] Retry fetch error:', err?.message);
            if (!cancelled) setLoading(false);
          });
        }, 2000);
      }
    }).catch((err) => {
      console.error('[COURSE_IMAGE] Fetch error:', err?.message);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [courseName, location, providedUrl, maxWidth]);

  // Crossfade when image loads
  useEffect(() => {
    if (imageUrl && !imageError) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [imageUrl, imageError, fadeAnim]);

  const showImage = imageUrl && !imageError;

  return (
    <View style={[styles.container, height != null && { height }, style]}>
      {/* Always render the gradient fallback underneath */}
      <View style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={fallbackGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Subtle pinstripe texture */}
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: -100,
              left: i * 24 - 50,
              width: 1,
              height: 600,
              backgroundColor: '#fff',
              opacity: 0.04,
              transform: [{ rotate: '35deg' }],
            }}
          />
        ))}
      </View>

      {/* Shimmer over gradient while fetching */}
      {loading && !showImage && <ShimmerPlaceholder />}

      {/* Photo crossfades in over the gradient */}
      {showImage && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            onLoad={() => console.warn('[COURSE_IMAGE] Image loaded successfully')}
            onError={(e: any) => {
              console.warn('[COURSE_IMAGE] Image load FAILED:', e?.nativeEvent?.error || e);
              setImageError(true);
            }}
          />
        </Animated.View>
      )}

      {children}
      {showImage && showAttribution && <GoogleAttribution />}
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
  imageUrl: providedUrl,
  gradient,
  style,
  children,
  showAttribution = true,
}: DestinationImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(providedUrl ?? null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (providedUrl) {
      setImageUrl(providedUrl);
      setError(false);
      return;
    }

    if (!isGooglePlacesConfigured()) return;

    let cancelled = false;
    setLoading(true);
    fetchDreamImage(name).then((url) => {
      if (cancelled) return;
      if (url) {
        setImageUrl(url);
        setLoading(false);
      } else {
        // Retry once after 2s
        setTimeout(() => {
          if (cancelled) return;
          fetchDreamImage(name).then((retryUrl) => {
            if (!cancelled) {
              if (retryUrl) setImageUrl(retryUrl);
              setLoading(false);
            }
          }).catch((err) => {
            console.error('[DESTINATION_IMAGE] Retry fetch error:', err?.message);
            if (!cancelled) setLoading(false);
          });
        }, 2000);
      }
    }).catch((err) => {
      console.error('[DESTINATION_IMAGE] Fetch error:', err?.message);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [name, providedUrl]);

  // Crossfade
  useEffect(() => {
    if (imageUrl && !error) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [imageUrl, error, fadeAnim]);

  const showImage = imageUrl && !error;

  return (
    <View style={[styles.container, style]}>
      {/* Gradient fallback always rendered */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {loading && !showImage && <ShimmerPlaceholder />}
      {showImage && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            onError={() => setError(true)}
          />
        </Animated.View>
      )}
      {children}
      {showImage && showAttribution && <GoogleAttribution />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
