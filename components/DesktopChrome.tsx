import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Blob } from './Blob';
import { LogoMark } from './Logo';
import { Icon, type IconName } from './Icon';
import { initialsOf, useAuth } from '../lib/auth';
import { notebookInPath, openingNotebook, stillThere } from '../lib/shelf';
import { useStore } from '../lib/store';
import { relative } from '../lib/time';
import { c, f, NAV_OFF, NAV_ON, shadow, tintOf } from '../theme/tokens';

const SHELF_KEY = 'jot.shelf';
const NOTEBOOK_KEY = 'jot.notebook';
const SHELF_W = 244;
const HANDLE = 18;

/**
 * The grip beside the shelf.
 *
 * Always drawn, and always showing which way the shelf will go: a control that
 * appears only on hover is a control nobody finds twice.
 *
 * With the shelf away the grip is pinned to the rail rather than sitting in the
 * row. It has to stay still: a hover target that moves because it was hovered
 * slides out from under the cursor, loses the hover, slides back, and catches
 * the cursor again — open and shut, over and over.
 */
function EdgeHandle({
  open,
  floating,
  onPress,
  onHoverIn,
  onHoverOut,
}: {
  open: boolean;
  floating?: boolean;
  onPress: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityLabel={open ? 'Hide the notebooks' : 'Show the notebooks'}
      onPress={onPress}
      onHoverIn={() => {
        setHover(true);
        onHoverIn?.();
      }}
      onHoverOut={() => {
        setHover(false);
        onHoverOut?.();
      }}
      style={[styles.handle, floating ? styles.handleFloating : null, hover && styles.handleOn]}
    >
      <View style={[styles.grip, hover && styles.gripOn]}>
        <Icon name={open ? 'chevronLeft' : 'chevronRight'} size={13} color={c.n700} />
      </View>
    </Pressable>
  );
}

/**
 * The desktop half of the design: the islands unroll into a rail, and the
 * notebook list and note list become permanent columns beside the note.
 */
export function DesktopChrome({ onProfile }: { onProfile: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { notebooks, notes, tagCounts, search, notebookById, createNote } = useStore();
  const { profile, user, avatarUrl } = useAuth();

  const [nbFilter, setNbFilter] = useState<string | null>(() => notebookInPath(pathname));
  const [q, setQ] = useState('');

  /** The notebook the list is filtered to. Remembered, so a reload keeps it. */
  function pickNotebook(id: string | null) {
    setNbFilter(id);
    void (id ? AsyncStorage.setItem(NOTEBOOK_KEY, id) : AsyncStorage.removeItem(NOTEBOOK_KEY)).catch(
      () => undefined,
    );
  }

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(NOTEBOOK_KEY)
      .then((raw) => {
        if (alive) setNbFilter(openingNotebook(pathname, raw));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Read once, on the way in; the address only matters for the first answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A notebook's own page names the notebook, however it was reached.
  const inPath = notebookInPath(pathname);
  useEffect(() => {
    if (inPath) pickNotebook(inPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPath]);

  // A notebook deleted since it was picked takes the filter with it.
  const known = notebooks.map((nb) => nb.id);
  const kept = stillThere(nbFilter, known);
  useEffect(() => {
    if (kept !== nbFilter) pickNotebook(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept, nbFilter]);

  /**
   * One switch, two states: the note list on its own, or the shelf beside it.
   * The list never goes away — a page with nothing to navigate by is not worth
   * the strip of screen that hiding it would win.
   */
  const [shelf, setShelf] = useState(true);
  /** True while the cursor is holding the shelf open for a look. */
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The choice is a preference, so it outlives the session.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SHELF_KEY)
      .then((raw) => {
        if (alive && raw) setShelf(raw === 'open');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (peekTimer.current) clearTimeout(peekTimer.current);
    };
  }, []);

  function toggleShelf() {
    setShelf((now) => {
      void AsyncStorage.setItem(SHELF_KEY, now ? 'away' : 'open').catch(() => undefined);
      return !now;
    });
    setPeek(false);
  }

  /**
   * A beat before the shelf slides away again, so crossing the gap between the
   * grip and the shelf does not close it under the cursor.
   */
  function holdPeek() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = null;
    setPeek(true);
  }

  function releasePeek(after = 170) {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(false), after);
  }

  /**
   * The shelf's own hover, kept off Pressable on purpose.
   *
   * A Pressable contains its hover: entering a nested one — a notebook row —
   * dispatches a lock that ends the hover of every Pressable around it. The
   * peeked shelf therefore slid shut the moment the cursor reached a notebook,
   * and opened again on the way to the next one. Enter and leave do not fire
   * for a move onto a child, which is exactly the containment wanted here.
   */
  const shelfHover = Platform.OS === 'web' ? { onMouseEnter: holdPeek, onMouseLeave: () => releasePeek(120) } : {};

  const segment = pathname.split('/')[1] ?? '';
  const selectedId = pathname.split('/')[2];
  const list = search(q, nbFilter);

  const railTone = (on: boolean) => (on ? NAV_ON : NAV_OFF);

  const railButtons: { icon: IconName; label: string; on: boolean; go: () => void }[] = [
    {
      icon: 'calendar',
      label: 'Today',
      on: segment === 'today',
      go: () => {
        pickNotebook(null);
        router.replace('/today');
      },
    },
    {
      icon: 'book',
      label: 'Notebooks',
      on: segment === 'shelf' || segment === 'notebook',
      go: () => router.replace('/shelf'),
    },
    {
      icon: 'search',
      label: 'Search',
      on: segment === 'search',
      go: () => router.replace('/search'),
    },
    {
      icon: 'tag',
      label: 'Tags',
      on: segment === 'tags',
      go: () => router.replace('/tags'),
    },
    {
      icon: 'graph',
      label: 'Link map',
      on: segment === 'graph',
      go: () => router.replace('/graph'),
    },
  ];

  /**
   * A new note goes in the notebook being looked at. With the list showing
   * everything there is no such notebook, so there is no button either: a note
   * filed somewhere the writer did not choose is a note they will not find.
   */
  const picked = nbFilter ? notebookById(nbFilter) : undefined;

  async function newNote() {
    if (!picked) return;
    const made = await createNote(picked.id);
    if (made) router.replace(`/editor/${made.id}`);
  }

  /**
   * The shelf slides the rest of the page across rather than covering it, so
   * nothing sits hidden underneath. Its width is what moves; the column inside
   * keeps its own, so the contents do not reflow on the way.
   */
  const slide = useRef(new Animated.Value(shelf ? SHELF_W : 0)).current;
  const shelfOut = shelf || peek;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: shelfOut ? SHELF_W : 0,
      duration: 170,
      useNativeDriver: false,
    }).start();
  }, [shelfOut, slide]);

  return (
    <>
      <View style={styles.rail}>
        <LogoMark size={40} elevated={false} />

        <View style={styles.railIsland}>
          {railButtons.map((b) => {
            const tone = railTone(b.on);
            return (
              <Pressable
                key={b.label}
                accessibilityLabel={b.label}
                onPress={b.go}
                style={[styles.railButton, { backgroundColor: tone.bg }]}
              >
                <Icon name={b.icon} size={20} color={tone.fg} />
              </Pressable>
            );
          })}
        </View>

        <Pressable accessibilityLabel="Profile" onPress={onProfile}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Blob size={44} color={c.a300}>
              <Text style={styles.initials}>
                {initialsOf(profile?.full_name || user?.email || '')}
              </Text>
            </Blob>
          )}
        </Pressable>
      </View>

      <Animated.View style={[styles.slide, { width: slide }]}>
        {/* Hovering the shelf holds it open, so it does not slide away on the
            cursor's way to a notebook. */}
        <View {...(shelf ? {} : shelfHover)} style={styles.notebookColumn}>
        <View style={styles.columnHead}>
          <View style={styles.columnTitleRow}>
            {picked ? <Blob size={13} color={tintOf(picked.tint).tint} /> : null}
            <Text style={styles.columnTitle} numberOfLines={1}>
              {picked ? picked.name : 'Notebooks'}
            </Text>
          </View>
          <Text style={styles.columnNote} numberOfLines={1}>
            {picked ? 'New notes land here' : 'Pick a notebook to start a note'}
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
          <Pressable
            onPress={() => pickNotebook(null)}
            style={[styles.nbRow, !nbFilter && { backgroundColor: c.paper }]}
          >
            <Blob size={11} color={c.n400} />
            <Text style={styles.nbName}>All notes</Text>
            <Text style={styles.nbCount}>{notes.length}</Text>
          </Pressable>

          {notebooks.map((nb) => {
            const tone = tintOf(nb.tint);
            const count = notes.filter((n) => n.notebook_id === nb.id).length;
            return (
              <Pressable
                key={nb.id}
                onPress={() => {
                  pickNotebook(nb.id);
                  router.replace(`/notebook/${nb.id}`);
                }}
                style={[styles.nbRow, nbFilter === nb.id && { backgroundColor: c.paper }]}
              >
                <Blob size={11} color={tone.tint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.nbName} numberOfLines={1}>
                    {nb.name}
                  </Text>
                  <Text style={styles.nbCode}>{nb.code}</Text>
                </View>
                <Text style={styles.nbCount}>{count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ gap: 8 }}>
          <Text style={styles.kicker}>Tags</Text>
          <View style={styles.tagWrap}>
            {tagCounts.slice(0, 12).map((t) => (
              <Pressable
                key={t.name}
                onPress={() => {
                  setQ('#' + t.name);
                  pickNotebook(null);
                }}
                style={styles.tag}
              >
                <Text style={styles.tagText}>#{t.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        </View>
      </Animated.View>

      {/* Open, the grip sits between the two columns. Away, it stays pinned by
          the rail so that hovering it cannot move it. */}
      <EdgeHandle
        open={shelf}
        floating={!shelf}
        onPress={toggleShelf}
        onHoverIn={shelf ? undefined : holdPeek}
        onHoverOut={shelf ? undefined : () => releasePeek()}
      />

      <View style={styles.listColumn}>
        {/* With the shelf away, this line is the only thing saying which
            notebook the list belongs to. */}
        {!shelf ? (
          <View style={styles.listHead}>
            {picked ? <Blob size={12} color={tintOf(picked.tint).tint} /> : null}
            <Text style={styles.listHeadText} numberOfLines={1}>
              {picked ? picked.name : 'All notes'}
            </Text>
          </View>
        ) : null}

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Icon name="search" size={16} color={c.n500} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search all notes"
              placeholderTextColor={c.n500}
              selectionColor={c.accent}
              style={styles.searchInput}
            />
          </View>
          {picked ? (
            <Pressable
              accessibilityLabel={`New note in ${picked.name}`}
              onPress={newNote}
              style={styles.newNote}
            >
              <Icon name="plus" size={18} color={c.paper} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.kicker}>
          {nbFilter
            ? notebookById(nbFilter)?.name ?? 'Notebook'
            : q.trim()
              ? `${list.length} found`
              : 'All notes'}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {list.map((n) => {
            const tone = tintOf(notebookById(n.notebook_id)?.tint ?? 0);
            const on = n.id === selectedId;
            return (
              <Pressable
                key={n.id}
                onPress={() => router.replace(`/note/${n.id}`)}
                style={[styles.noteRow, on && { backgroundColor: c.paper, ...shadow.sm }]}
              >
                <View style={styles.noteRowHead}>
                  <View style={[styles.dot, { backgroundColor: tone.tint }]} />
                  <Text style={[styles.noteRowNb, { color: tone.dark }]} numberOfLines={1}>
                    {notebookById(n.notebook_id)?.name ?? 'Notebook'}
                  </Text>
                  <Text style={styles.noteRowWhen}>{relative(n.updated_at)}</Text>
                </View>
                <Text style={styles.noteRowTitle} numberOfLines={2}>
                  {n.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 82,
    backgroundColor: c.n200,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 20,
  },
  railIsland: {
    gap: 3,
    backgroundColor: c.paper,
    borderRadius: 999,
    padding: 5,
    ...shadow.sm,
  },
  railButton: { width: 48, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 999 },
  initials: { fontFamily: f.head, fontSize: 13, color: c.a900 },

  slide: { overflow: 'hidden' },
  /**
   * Pinned beside the rail, out of the row, and above the shelf that slides out
   * next to it. The rail is 82 wide; this sits on its edge.
   */
  handleFloating: {
    position: 'absolute',
    left: 82,
    top: 0,
    bottom: 0,
    width: HANDLE + 8,
    zIndex: 9,
    borderRightWidth: 0,
  },
  notebookColumn: {
    width: SHELF_W,
    flex: 1,
    paddingVertical: 26,
    paddingLeft: 30,
    paddingRight: 18,
    gap: 14,
  },
  handle: {
    width: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: c.n300,
  },
  handleOn: { backgroundColor: c.n200 },
  grip: {
    width: 22,
    height: 34,
    marginLeft: -6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.n300,
  },
  gripOn: { backgroundColor: c.a100, borderColor: c.a300 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listHeadText: { flex: 1, fontFamily: f.head, fontSize: 17, color: c.text },
  columnHead: { gap: 2 },
  columnTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  columnTitle: { flex: 1, fontFamily: f.head, fontSize: 19, color: c.text },
  columnNote: { fontFamily: f.b600, fontSize: 11, color: c.n500 },
  nbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nbName: { flex: 1, fontFamily: f.b700, fontSize: 13.5, color: c.text },
  nbCode: { fontFamily: f.b600, fontSize: 11, color: c.n500 },
  nbCount: { fontFamily: f.b700, fontSize: 11.5, color: c.n500 },
  kicker: {
    fontFamily: f.b800,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: c.n500,
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { backgroundColor: c.a100, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  tagText: { fontFamily: f.b700, fontSize: 11.5, color: c.a700 },

  listColumn: {
    width: 310,
    paddingVertical: 26,
    paddingHorizontal: 18,
    gap: 14,
    borderRightWidth: 1,
    borderRightColor: c.n300,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: c.n100,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  searchInput: { flex: 1, fontFamily: f.b500, fontSize: 13.5, color: c.text, padding: 0 },
  newNote: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  noteRow: { borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 5 },
  noteRowHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 99 },
  noteRowNb: {
    flex: 1,
    fontFamily: f.b800,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  noteRowWhen: { fontFamily: f.b600, fontSize: 11, color: c.n500 },
  noteRowTitle: { fontFamily: f.b700, fontSize: 14.5, lineHeight: 19, color: c.text },
});
