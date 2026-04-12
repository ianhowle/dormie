import { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';

// ─── Types ───────────────────────────────────────────────────────────
export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  /** Text to show in the center of the donut */
  centerLabel?: string;
  centerValue?: string;
  centerValueColor?: string;
  /** Animate segments on mount */
  animate?: boolean;
  onSegmentPress?: (segment: DonutSegment) => void;
};

// ─── Arc path helper ─────────────────────────────────────────────────
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

// ─── Component ───────────────────────────────────────────────────────
export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 20,
  centerLabel,
  centerValue,
  centerValueColor,
  animate = true,
  onSegmentPress,
}: DonutChartProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const animVal = useRef(new Animated.Value(0)).current;

  const total = useMemo(() => segments.reduce((s, seg) => s + seg.value, 0), [segments]);

  useEffect(() => {
    if (animate && total > 0) {
      animVal.setValue(0);
      Animated.timing(animVal, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      animVal.setValue(1);
    }
  }, [animate, total]);

  if (total === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <SvgCircle
            cx={size / 2}
            cy={size / 2}
            r={(size - strokeWidth) / 2}
            stroke={c.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        {centerLabel && (
          <View style={[styles.center, { width: size, height: size }]}>
            <Text style={[styles.centerLabel, { color: c.textMuted }]}>{centerLabel}</Text>
          </View>
        )}
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const GAP_DEG = segments.filter(s => s.value > 0).length > 1 ? 2 : 0;
  const activeSegments = segments.filter(s => s.value > 0);
  const totalGap = GAP_DEG * activeSegments.length;
  const availableDeg = 360 - totalGap;

  let currentAngle = 0;
  const arcs = activeSegments.map((seg) => {
    const sweepAngle = (seg.value / total) * availableDeg;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweepAngle;
    currentAngle = endAngle + GAP_DEG;
    return { ...seg, startAngle, endAngle };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <SvgCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={c.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Segments */}
        {arcs.map((arc) => {
          // For a full circle (single segment), draw a circle instead of arc
          if (arc.endAngle - arc.startAngle >= 359) {
            return (
              <SvgCircle
                key={arc.label}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={arc.color}
                strokeWidth={strokeWidth}
                fill="none"
              />
            );
          }
          return (
            <Path
              key={arc.label}
              d={describeArc(cx, cy, radius, arc.startAngle, arc.endAngle)}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              fill="none"
            />
          );
        })}
      </Svg>
      {/* Center text */}
      {(centerValue || centerLabel) && (
        <View style={[styles.center, { width: size, height: size }]}>
          {centerValue && (
            <Text style={[styles.centerValue, { color: centerValueColor ?? c.text, fontFamily: GEO }]}>
              {centerValue}
            </Text>
          )}
          {centerLabel && (
            <Text style={[styles.centerLabel, { color: c.textMuted }]}>{centerLabel}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Nested Donut (player vs group) ─────────────────────────────────
type NestedDonutProps = {
  playerPct: number;
  groupPct: number;
  size?: number;
  playerColor?: string;
  groupColor?: string;
  label?: string;
  animate?: boolean;
};

export function NestedDonutChart({
  playerPct,
  groupPct,
  size = 140,
  playerColor,
  groupColor,
  label,
  animate = true,
}: NestedDonutProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const pColor = playerColor ?? '#2E7D32';
  const gColor = groupColor ?? '#757575';

  const outerStroke = 16;
  const innerStroke = 10;
  const outerR = (size - outerStroke) / 2;
  const innerR = outerR - outerStroke / 2 - innerStroke / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const playerDeg = (clamp(playerPct) / 100) * 360;
  const groupDeg = (clamp(groupPct) / 100) * 360;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Outer background */}
        <SvgCircle cx={cx} cy={cy} r={outerR} stroke={c.border} strokeWidth={outerStroke} fill="none" />
        {/* Outer player arc */}
        {playerDeg > 0 && (
          playerDeg >= 359.5 ? (
            <SvgCircle cx={cx} cy={cy} r={outerR} stroke={pColor} strokeWidth={outerStroke} fill="none" />
          ) : (
            <Path
              d={describeArc(cx, cy, outerR, 0, playerDeg)}
              stroke={pColor}
              strokeWidth={outerStroke}
              strokeLinecap="butt"
              fill="none"
            />
          )
        )}
        {/* Inner background */}
        <SvgCircle cx={cx} cy={cy} r={innerR} stroke={c.border} strokeWidth={innerStroke} fill="none" />
        {/* Inner group arc */}
        {groupDeg > 0 && (
          groupDeg >= 359.5 ? (
            <SvgCircle cx={cx} cy={cy} r={innerR} stroke={gColor} strokeWidth={innerStroke} fill="none" />
          ) : (
            <Path
              d={describeArc(cx, cy, innerR, 0, groupDeg)}
              stroke={gColor}
              strokeWidth={innerStroke}
              strokeLinecap="butt"
              fill="none"
            />
          )
        )}
      </Svg>
      {/* Center text */}
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={[styles.nestedCenterPct, { color: pColor, fontFamily: GEO }]}>
          {Math.round(playerPct)}%
        </Text>
        {label && (
          <Text style={[styles.nestedCenterLabel, { color: c.textMuted }]}>
            vs {Math.round(groupPct)}% {label}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Mini Progress Circle ────────────────────────────────────────────
type MiniProgressCircleProps = {
  percentage: number;
  label: string;
  size?: number;
  color?: string;
};

export function MiniProgressCircle({
  percentage,
  label,
  size = 44,
  color,
}: MiniProgressCircleProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const fillColor = color ?? '#2E7D32';
  const strokeW = 3;
  const radius = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const pctClamped = Math.max(0, Math.min(100, percentage));
  const deg = (pctClamped / 100) * 360;

  return (
    <View style={styles.miniContainer}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <SvgCircle cx={cx} cy={cy} r={radius} stroke={c.border} strokeWidth={strokeW} fill="none" />
          {deg > 0 && (
            deg >= 359.5 ? (
              <SvgCircle cx={cx} cy={cy} r={radius} stroke={fillColor} strokeWidth={strokeW} fill="none" />
            ) : (
              <Path
                d={describeArc(cx, cy, radius, 0, deg)}
                stroke={fillColor}
                strokeWidth={strokeW}
                strokeLinecap="butt"
                fill="none"
              />
            )
          )}
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={[styles.miniPct, { color: c.text, fontFamily: GEO }]}>
            {Math.round(percentage)}%
          </Text>
        </View>
      </View>
      <Text style={[styles.miniLabel, { color: c.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ─── Donut Legend ────────────────────────────────────────────────────
export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.legend}>
      {segments.filter(s => s.value > 0).map((seg) => (
        <View key={seg.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
          <Text style={[styles.legendText, { color: c.textMuted }]}>
            {seg.label} ({seg.value})
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  nestedCenterPct: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -1,
  },
  nestedCenterLabel: {
    fontSize: 9,
    textAlign: 'center',
    maxWidth: 80,
    marginTop: 1,
  },
  miniContainer: {
    alignItems: 'center',
    gap: 4,
  },
  miniPct: {
    fontSize: 10,
    fontWeight: '700',
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: '500',
    maxWidth: 50,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendText: {
    fontSize: 11,
  },
});
