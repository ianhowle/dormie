import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import { useToast } from '../Toast';
import { Avatar } from '../Avatar';

const HAIRLINE = 'rgba(255,255,255,0.06)';

const AVATAR_SIZE = 32;

export type InviteDeliveryMethod = 'dormie' | 'sms' | 'guest';

export interface InvitePreviewMember {
  id: string;
  name: string;
  deliveryMethod: InviteDeliveryMethod;
  avatarUrl?: string;
  /** Phone number (for SMS) or email (for email invite). Rendered next to the
   *  delivery method indicator when present. */
  phoneOrEmail?: string;
  isOrganizer?: boolean;
}

export interface InvitePreviewProps {
  members: InvitePreviewMember[];
  /** Trip-level invite link to copy when the user taps "Tap to copy invite
   *  link" on an SMS row. v1 SMS fallback per the wizard spec — Twilio
   *  integration ships in v2. If null/undefined, the copy affordance is
   *  hidden and the SMS row just shows the phone number. */
  inviteUrl?: string | null;
  onAddPlayer?: () => void;
}

/**
 * Step 7 invite preview. Lists planned invitees with per-member delivery
 * method indicators (Dormie push / SMS / guest / organizer). SMS rows
 * surface the v1 "tap to copy invite link" fallback that copies the
 * trip's invite URL to clipboard for manual paste into iMessage/SMS.
 *
 * Solo trips (organizer only, no other members) render a minimal empty
 * state so the wizard's Step 7 doesn't show an empty section header.
 */
export function InvitePreview({ members, inviteUrl, onAddPlayer }: InvitePreviewProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  // Solo-trip detection: empty members, OR only the organizer.
  const inviteCount = useMemo(
    () => members.filter((m) => !m.isOrganizer).length,
    [members],
  );
  const isSoloTrip = inviteCount === 0;

  const handleCopyInvite = () => {
    if (!inviteUrl) return;
    haptics.light();
    Clipboard.setString(inviteUrl);
    showToast({ message: 'Invite link copied', type: 'success', icon: 'copy-outline' });
  };

  const handleAddPlayer = () => {
    if (!onAddPlayer) return;
    haptics.light();
    onAddPlayer();
  };

  return (
    <View style={s.wrap}>
      {/* Section header */}
      <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>INVITING</Text>

      {isSoloTrip ? (
        <View style={[s.emptyCard, { backgroundColor: '#151312', borderColor: HAIRLINE }]}>
          <Text style={[s.emptyText, { color: c.textMuted }]}>
            No invitations to send — solo trip.
          </Text>
        </View>
      ) : (
        <View>
          {members.map((m) => (
            <InviteRow
              key={m.id}
              member={m}
              hasInviteUrl={!!inviteUrl}
              onCopyInvite={handleCopyInvite}
            />
          ))}
        </View>
      )}

      {/* Add another player CTA (always present so solo trips can add) */}
      {onAddPlayer && (
        <Pressable
          onPress={handleAddPlayer}
          style={({ pressed }) => [
            s.addPlayerBtn,
            { borderColor: HAIRLINE, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="person-add-outline" size={14} color={c.textMuted} />
          <Text style={[s.addPlayerText, { color: c.textMuted, fontFamily: GEO }]}>
            Add another player →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────

function InviteRow({
  member,
  hasInviteUrl,
  onCopyInvite,
}: {
  member: InvitePreviewMember;
  hasInviteUrl: boolean;
  onCopyInvite: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isOrganizer = !!member.isOrganizer;

  return (
    <View style={[s.row, { backgroundColor: '#151312', borderColor: HAIRLINE }]}>
      <Avatar
        id={member.id}
        name={member.name}
        photoUrl={member.avatarUrl}
        size={AVATAR_SIZE}
      />

      <View style={s.rowBody}>
        <View style={s.nameRow}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
            {member.name}
          </Text>
          {isOrganizer && (
            <View style={[s.organizerBadge, { borderColor: '#006747' }]}>
              <Ionicons name="checkmark" size={10} color="#006747" />
              <Text style={[s.organizerBadgeText, { color: '#006747', fontFamily: GEO }]}>
                ORGANIZER
              </Text>
            </View>
          )}
        </View>

        <DeliveryMethodLine
          member={member}
          hasInviteUrl={hasInviteUrl}
          onCopyInvite={onCopyInvite}
        />
      </View>
    </View>
  );
}

// ─── Delivery method line (per row) ──────────────────────────────────

function DeliveryMethodLine({
  member,
  hasInviteUrl,
  onCopyInvite,
}: {
  member: InvitePreviewMember;
  hasInviteUrl: boolean;
  onCopyInvite: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (member.isOrganizer) {
    return (
      <Text style={[s.deliveryLine, { color: c.textMuted }]}>
        No invite needed
      </Text>
    );
  }

  switch (member.deliveryMethod) {
    case 'dormie':
      return (
        <Text style={[s.deliveryLine, { color: c.textMuted }]}>
          via Dormie
        </Text>
      );
    case 'sms':
      return (
        <View>
          <Text style={[s.deliveryLine, { color: c.textMuted }]}>
            via SMS{member.phoneOrEmail ? ` — ${member.phoneOrEmail}` : ''}
          </Text>
          {hasInviteUrl && (
            <Pressable
              onPress={onCopyInvite}
              style={({ pressed }) => [
                s.copyLinkRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              hitSlop={6}
            >
              <Ionicons name="copy-outline" size={12} color="#C9A227" />
              <Text style={[s.copyLinkText, { color: '#C9A227', fontFamily: GEO }]}>
                Tap to copy invite link
              </Text>
            </Pressable>
          )}
        </View>
      );
    case 'guest':
      return (
        <Text style={[s.deliveryLine, { color: c.textMuted }]}>
          Guest player — no invitation
        </Text>
      );
    default:
      return null;
  }
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  /* Empty (solo) */
  emptyCard: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },

  /* Member row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  rowBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },

  /* Organizer badge */
  organizerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  organizerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  /* Delivery method secondary line */
  deliveryLine: {
    fontSize: 12,
    marginTop: 3,
  },
  copyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  copyLinkText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Add player CTA */
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  addPlayerText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
