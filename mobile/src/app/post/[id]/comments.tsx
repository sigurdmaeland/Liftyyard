import { Stack, router, useLocalSearchParams } from 'expo-router';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { EmptyState } from '@/components/empty-state';
import { Pop } from '@/components/pop';
import { ThemedText } from '@/components/themed-text';
import { openReport } from '@/features/safety/actions';
import { LikeButton } from '@/features/social/like-button';
import { UserAvatar } from '@/features/social/user-avatar';
import { useTheme } from '@/hooks/use-theme';
import { uuidv7 } from '@/lib/ids';
import { formatRelativeDateTime } from '@/lib/stats';
import { type Comment, type FeedItem, addComment, deleteComment, fetchComments, fetchWorkoutView, setCommentLike } from '@/services/feed';
import { type UserSummary, searchUsers } from '@/services/social';
import { MaxContentWidth, Spacing } from '@/theme';

/** Hurtigvalg over tekstfeltet. Trykk legger emojien til i kommentaren. */
const QUICK = [
  { emoji: '💪', label: 'Sterk' },
  { emoji: '🔥', label: 'Ild' },
  { emoji: '👏', label: 'Applaus' },
  { emoji: '🏋️', label: 'Vektløfter' },
  { emoji: '👊', label: 'Knyttneve' },
  { emoji: '🤯', label: 'Imponert' },
  { emoji: '🏆', label: 'Trofé' },
];

/** «nå», «5 min», «2 t», ellers dato. */
function shortTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'nå';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} t`;
  return formatRelativeDateTime(iso);
}

/** Øverste kommentarer i tidsrekkefølge, med svarene rett under sin kommentar. */
function threaded(list: Comment[]): Comment[] {
  const replies = new Map<string, Comment[]>();
  for (const c of list) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  const ids = new Set(list.map((c) => c.id));
  return list.filter((c) => !c.parentId || !ids.has(c.parentId)).flatMap((c) => [c, ...(replies.get(c.id) ?? [])]);
}

/** Kommentartekst der @brukernavn er lenker til profilen. */
function BodyWithMentions({ body }: { body: string }) {
  const theme = useTheme();
  const parts = body.split(/(@[a-z0-9._]{3,30})/gi);
  return (
    <ThemedText style={styles.body}>
      {parts.map((p, i) =>
        /^@[a-z0-9._]{3,30}$/i.test(p) ? (
          <ThemedText
            key={i}
            style={{ color: theme.accent, fontWeight: 600 }}
            onPress={() => router.push({ pathname: '/user/[username]', params: { username: p.slice(1).toLowerCase() } })}
            accessibilityRole="link">
            {p}
          </ThemedText>
        ) : (
          p
        ),
      )}
    </ThemedText>
  );
}

/** Kommentarer på en økt: økten øverst, kommentarene, hurtigvalg med emojier og skrivefelt. */
export default function CommentsScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const theme = useTheme();
  const [summary, setSummary] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [mentionHits, setMentionHits] = useState<UserSummary[]>([]);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  // @omtale: når siste ord begynner med «@», foreslås brukere.
  const onChangeText = (t: string) => {
    setText(t);
    const m = /@([a-z0-9._]{2,30})$/i.exec(t);
    if (!m) {
      setMentionHits([]);
      return;
    }
    searchUsers(m[1])
      .then((users) => setMentionHits(users.filter((u) => !u.isSelf).slice(0, 5)))
      .catch(() => setMentionHits([]));
  };
  const pickMention = (u: UserSummary) => {
    setText((t) => t.replace(/@([a-z0-9._]*)$/i, `@${u.username} `));
    setMentionHits([]);
    input.current?.focus();
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    if (!c.author.isSelf && !text.includes(`@${c.author.username}`)) setText(`@${c.author.username} `);
    input.current?.focus();
  };

  const toggleLike = (c: Comment) => {
    const liked = !c.likedByMe;
    const update = (l: boolean, n: number) =>
      setComments((list) => list?.map((x) => (x.id === c.id ? { ...x, likedByMe: l, likeCount: n } : x)) ?? null);
    update(liked, (c.likeCount ?? 0) + (liked ? 1 : -1));
    setCommentLike(c.id, liked).catch(() => update(!liked, c.likeCount ?? 0));
  };
  const list = useRef<FlatList<Comment>>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchWorkoutView(id), fetchComments(id)])
      .then(([view, c]) => {
        if (!active) return;
        setSummary(view.summary);
        setComments(c);
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [id]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      setComments(await addComment(id, uuidv7(), body, replyTo?.id));
      setText('');
      setReplyTo(null);
      setMentionHits([]);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      Alert.alert('Kunne ikke sende', 'Prøv igjen når du har nett.');
    } finally {
      setSending(false);
    }
  };

  const remove = useCallback(
    (c: Comment) =>
      Alert.alert('Slette kommentaren?', undefined, [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () =>
            deleteComment(c.id)
              .then(() => setComments((l) => l?.filter((x) => x.id !== c.id) ?? null))
              .catch(() => Alert.alert('Det gikk ikke', 'Prøv igjen når du har nett.')),
        },
      ]),
    [],
  );

  const menu = (c: Comment) =>
    Alert.alert('Kommentar', c.body.length > 80 ? `${c.body.slice(0, 80)}…` : c.body, [
      ...(c.canDelete ? [{ text: 'Slett', style: 'destructive' as const, onPress: () => remove(c) }] : []),
      ...(!c.author.isSelf ? [{ text: 'Rapporter kommentaren', onPress: () => openReport('COMMENT', c.id, c.author.username) }] : []),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);

  const header = summary ? (
    <View style={[styles.post, { borderBottomColor: theme.backgroundSelected }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/post/[id]', params: { id } })}
        accessibilityRole="button"
        accessibilityLabel={`Økten ${summary.name} av ${summary.author.displayName}`}
        accessibilityHint="Åpner økten"
        style={styles.postHead}>
        <UserAvatar uri={summary.author.avatarUrl} size={48} />
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>{summary.author.displayName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatRelativeDateTime(summary.startedAt)}
          </ThemedText>
        </View>
        <Icon name="chevron.right" size={16} color={theme.textSecondary} fallback="›" />
      </Pressable>
      <ThemedText accessibilityRole="header" style={styles.postTitle}>
        {summary.name}
      </ThemedText>
      <LikeButton
        workoutId={summary.id}
        liked={summary.likedByMe}
        count={summary.likeCount}
        onChange={(likedByMe, likeCount) => setSummary({ ...summary, likedByMe, likeCount })}
      />
    </View>
  ) : undefined;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Kommentarer' }} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {error ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            Kunne ikke hente kommentarene. Har du nett?
          </ThemedText>
        ) : comments === null ? (
          <ActivityIndicator style={styles.message} />
        ) : (
          <FlatList
            ref={list}
            data={threaded(comments)}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={header}
            contentContainerStyle={styles.list}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="interactive"
            renderItem={({ item: c }) => (
              <Pressable
                onLongPress={() => menu(c)}
                accessibilityHint="Hold inne for valg"
                accessibilityActions={[{ name: 'menu', label: 'Valg for kommentaren' }]}
                onAccessibilityAction={() => menu(c)}
                style={[styles.comment, c.parentId ? styles.reply : null]}>
                <Pressable
                  onPress={() => router.push({ pathname: '/user/[username]', params: { username: c.author.username } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Profilen til ${c.author.displayName}`}>
                  <UserAvatar uri={c.author.avatarUrl} size={c.parentId ? 32 : 40} />
                </Pressable>
                <View style={styles.flex}>
                  <ThemedText>
                    <ThemedText style={styles.bold}>{c.author.displayName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{`  ${shortTime(c.createdAt)}`}</ThemedText>
                  </ThemedText>
                  <BodyWithMentions body={c.body} />
                  <Pressable onPress={() => startReply(c)} accessibilityRole="button" accessibilityLabel={`Svar ${c.author.displayName}`} hitSlop={8} style={styles.replyButton}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Svar
                    </ThemedText>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => toggleLike(c)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !!c.likedByMe }}
                  accessibilityLabel={`${c.likedByMe ? 'Fjern liker på' : 'Lik'} kommentaren${c.likeCount ? `, ${c.likeCount} liker` : ''}`}
                  style={styles.commentLike}>
                  <Pop trigger={!!c.likedByMe}>
                    <Icon name={c.likedByMe ? 'hand.thumbsup.fill' : 'hand.thumbsup'} size={18} color={c.likedByMe ? theme.accent : theme.textSecondary} fallback="👍" />
                  </Pop>
                  {(c.likeCount ?? 0) > 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {c.likeCount}
                    </ThemedText>
                  )}
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <EmptyState icon="bubble.left.and.bubble.right" title="Ingen kommentarer ennå" text="Si noe hyggelig! Bruk gjerne en emoji under." />
            }
          />
        )}

        <SafeAreaView edges={['bottom']} style={[styles.composer, { borderTopColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
          {replyTo && (
            <View style={[styles.replying, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                Svarer {replyTo.author.displayName}
              </ThemedText>
              <Pressable onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Avbryt svar" hitSlop={10}>
                <Icon name="xmark" size={14} color={theme.textSecondary} fallback="✕" />
              </Pressable>
            </View>
          )}
          {mentionHits.length > 0 && (
            <View style={styles.mentions}>
              {mentionHits.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => pickMention(u)}
                  accessibilityRole="button"
                  accessibilityLabel={`Nevn ${u.displayName}`}
                  style={[styles.mention, { backgroundColor: theme.backgroundElement }]}>
                  <UserAvatar uri={u.avatarUrl} size={22} />
                  <ThemedText type="small">@{u.username}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.quick}>
            {QUICK.map((q) => (
              <Pressable
                key={q.emoji}
                onPress={() => {
                  setText((t) => `${t}${q.emoji}`);
                  input.current?.focus();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Legg til ${q.label.toLowerCase()}`}
                style={styles.emoji}>
                <ThemedText style={styles.emojiText}>{q.emoji}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={[styles.inputPill, { borderColor: theme.backgroundSelected }]}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={onChangeText}
              placeholder={replyTo ? `Svar ${replyTo.author.displayName} …` : 'Legg til en kommentar …'}
              placeholderTextColor={theme.textSecondary}
              autoFocus={focus === '1'}
              multiline
              maxLength={1000}
              accessibilityLabel="Kommentar"
              style={[styles.input, { color: theme.text }]}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send kommentar"
              accessibilityState={{ disabled: !text.trim() || sending, busy: sending }}
              style={[styles.send, { backgroundColor: text.trim() ? theme.accentFill : theme.backgroundSelected }]}>
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Icon name="arrow.up" size={18} color={text.trim() ? '#FFFFFF' : theme.textSecondary} fallback="↑" />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  message: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
  post: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.two },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 48 },
  postTitle: { fontSize: 22, lineHeight: 28, fontWeight: 800 },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  body: { marginTop: 2 },
  comment: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start', paddingVertical: Spacing.three },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  emoji: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 28, lineHeight: 34 },
  inputPill: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 24, paddingLeft: Spacing.three, padding: 4, marginBottom: Spacing.two },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, maxHeight: 120 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reply: { paddingLeft: 52, paddingVertical: Spacing.two },
  replyButton: { alignSelf: 'flex-start', marginTop: 4, minHeight: 28, justifyContent: 'center' },
  commentLike: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  mentions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  mention: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18 },
});
