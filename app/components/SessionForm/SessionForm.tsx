'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { btn, Card, Chip, inputCls, labelCls } from '../ui';
import ConfirmButton from '../ConfirmButton';
import Toggle from '../Toggle';
import ExercisePicker from './ExercisePicker';
import RestTimerBar from './RestTimerBar';
import SessionTopBar from './SessionTopBar';
import {
  NEW_DRAFT_KEY,
  clearDraft,
  editDraftKey,
  pruneStaleNewDraft,
  readDraft,
  writeDraft,
} from '@/lib/draftStore';
import { SET_TYPE_LETTERS, SET_TYPE_NAMES, capitalize, formatClock, formatSet, formatWeight, todayISO } from '@/lib/format';
import { restTimer } from '@/lib/hooks/useRestTimer';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { SET_TYPES } from '@/lib/types';
import type { ExerciseWithLast, SessionWithSets, SetType, SetValues, Settings } from '@/lib/types';

type Field = 'reps' | 'weight' | 'rpe';

interface SetState {
  id: string;
  reps: string;
  weight: string;
  rpe: string;
  type: SetType;
}

interface BlockState {
  id: string;
  exerciseId: number;
  sets: SetState[];
}

interface FormState {
  date: string;
  label: string;
  notes: string;
  /** Edit mode only: minutes as typed, blank means no duration. */
  durationMin: string;
  blocks: BlockState[];
}

interface Props {
  exercises: ExerciseWithLast[];
  settings: Settings;
  edit?: { session: SessionWithSets };
}

const uid = () => Math.random().toString(36).slice(2, 10);
const emptySet = (): SetState => ({ id: uid(), reps: '', weight: '', rpe: '', type: 'normal' });
const emptyForm = (): FormState => ({ date: todayISO(), label: '', notes: '', durationMin: '', blocks: [] });

// A session left open longer than this is a forgotten draft, so its clock isn't saved as a duration.
const MAX_AUTO_DURATION_S = 6 * 60 * 60;
const MAX_MINUTES = 720;

// Random id for one session's save, so a retry after a dropped connection can't create a duplicate.
const newKey = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : '') ||
  `${uid()}${uid()}${uid()}`;

// What the form says, without the throwaway row ids. Used to tell whether anything really changed.
const signature = (f: FormState) =>
  JSON.stringify([
    f.date,
    f.label,
    f.notes,
    f.durationMin,
    f.blocks.map((b) => [b.exerciseId, b.sets.map((x) => [x.reps, x.weight, x.rpe, x.type])]),
  ]);

// An edit draft older than this is not worth restoring.
const MAX_EDIT_DRAFT_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const isBlankSet = (s: SetState) => s.reps === '' && s.weight === '' && s.rpe === '';

const hasContent = (f: FormState) => f.blocks.length > 0 || !!f.label.trim() || !!f.notes.trim();

function formFromSession(s: SessionWithSets): FormState {
  return {
    date: s.date,
    label: s.label ?? '',
    notes: s.notes ?? '',
    durationMin: s.duration_seconds ? String(Math.max(1, Math.round(s.duration_seconds / 60))) : '',
    blocks: s.exercises.map((g) => ({
      id: uid(),
      exerciseId: g.exercise_id,
      sets: g.sets.map((x) => ({
        id: uid(),
        reps: String(x.reps),
        weight: x.weight === null ? '' : formatWeight(x.weight),
        rpe: x.rpe === null ? '' : String(x.rpe),
        type: x.set_type,
      })),
    })),
  };
}

function loadDraft(
  key: string,
  knownExercises: Set<number>,
  /** Edit mode: the session as it is on the server now. A draft made from a different version is dropped. */
  baseSig: string | null
): { form: FormState; startedAt: number | null; clientKey: string | null } | null {
  try {
    const raw = readDraft(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const f = d?.form;
    if (d?.v !== 1 || typeof f?.date !== 'string' || !Array.isArray(f.blocks)) return null;
    if (baseSig !== null) {
      const fresh = typeof d.savedAt === 'number' && Date.now() - d.savedAt < MAX_EDIT_DRAFT_AGE_MS;
      if (d.base !== baseSig || !fresh) {
        // Quietly: this runs during render, so no listener notifications.
        clearDraft(key, true);
        return null;
      }
    }
    const blocks: BlockState[] = f.blocks
      .filter((b: BlockState) => knownExercises.has(b.exerciseId) && Array.isArray(b.sets) && b.sets.length > 0)
      .map((b: BlockState) => ({
        id: String(b.id),
        exerciseId: b.exerciseId,
        sets: b.sets.map((s) => ({
          id: String(s.id),
          reps: String(s.reps ?? ''),
          weight: String(s.weight ?? ''),
          rpe: String(s.rpe ?? ''),
          type: (SET_TYPES as readonly string[]).includes(s.type) ? s.type : 'normal',
        })),
      }));
    return {
      form: {
        date: f.date,
        label: String(f.label ?? ''),
        notes: String(f.notes ?? ''),
        durationMin: String(f.durationMin ?? ''),
        blocks,
      },
      startedAt: typeof d.startedAt === 'number' ? d.startedAt : null,
      clientKey: typeof d.clientKey === 'string' ? d.clientKey : null,
    };
  } catch {
    return null;
  }
}

function sanitize(field: Field, raw: string): string {
  if (field === 'reps') return raw.replace(/\D/g, '').slice(0, 4);
  const cleaned = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  const joined = rest.length ? `${whole}.${rest.join('')}` : whole;
  return joined.slice(0, field === 'weight' ? 7 : 4);
}

const repsOk = (v: string) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1000;
const weightOk = (v: string) => /^(\d+\.?\d*|\.\d+)$/.test(v) && Number(v) >= 0 && Number(v) <= 9999;
const rpeOk = (v: string) => /^(\d+\.?\d*|\.\d+)$/.test(v) && Number(v) >= 1 && Number(v) <= 10;

// Grey hints for each row. The nth working set takes last session's nth working set; extra rows
// copy the working row above (what was entered there, or its own hint). Warm-ups get no hint from
// last time, which only holds working sets, and don't feed the rows below them.
function placeholdersFor(block: BlockState, last: SetValues[]): Record<Field, string>[] {
  const empty = { reps: '', weight: '', rpe: '' };
  const out: Record<Field, string>[] = [];
  let working = 0;
  let prev = -1; // index of the last working row above
  block.sets.forEach((s, i) => {
    if (s.type === 'warmup') {
      out.push(empty);
      return;
    }
    const l = last[working++];
    if (l) {
      out.push({
        reps: String(l.reps),
        weight: l.weight === null ? '' : formatWeight(l.weight),
        rpe: l.rpe === null ? '' : String(l.rpe),
      });
    } else if (prev >= 0) {
      const p = block.sets[prev];
      const hint = out[prev];
      out.push({ reps: p.reps || hint.reps, weight: p.weight || hint.weight, rpe: p.rpe || hint.rpe });
    } else {
      out.push(empty);
    }
    prev = i;
  });
  return out;
}

const TYPE_STYLE: Record<SetType, string> = {
  normal: 'text-gray-600 active:bg-gray-100',
  warmup: 'bg-amber-100 text-amber-900 active:bg-amber-200',
  dropset: 'bg-sky-100 text-sky-900 active:bg-sky-200',
  failure: 'bg-red-100 text-red-800 active:bg-red-200',
};

const LABEL_SHORTCUTS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];

const noopSubscribe = () => () => {};

export default function SessionForm(props: Props) {
  // localStorage drafts only exist on the client, so render the form after mount.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return <div className="h-48 animate-pulse rounded-2xl bg-gray-100" aria-hidden="true" />;
  return <FormInner {...props} />;
}

function FormInner({ exercises: initialExercises, settings, edit }: Props) {
  const router = useRouter();
  const draftKey = edit ? editDraftKey(edit.session.id) : NEW_DRAFT_KEY;

  const [exercises, setExercises] = useState(initialExercises);
  const [init] = useState(() => {
    const baseline = edit ? formFromSession(edit.session) : emptyForm();
    if (!edit) pruneStaleNewDraft(true);
    const draft = loadDraft(draftKey, new Set(initialExercises.map((e) => e.id)), edit ? signature(baseline) : null);
    return {
      baseline,
      baseSig: signature(baseline),
      clientKey: draft?.clientKey ?? newKey(),
      form: draft?.form ?? baseline,
      // A blank new-session draft is just the clock running, nothing worth announcing.
      restored: draft !== null && (edit ? true : hasContent(draft.form)),
      startedAt: draft?.startedAt ?? Date.now(),
    };
  });
  const [form, setForm] = useState<FormState>(init.form);
  const [startedAt, setStartedAt] = useState(init.startedAt);
  const [restored, setRestored] = useState(init.restored);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [timerOn, setTimerOn] = useState(settings.rest_timer_enabled);

  const clientKeyRef = useRef(init.clientKey);
  const lastFailedRef = useRef<{ key: string; body: string } | null>(null);
  const [removed, setRemoved] = useState<{ blockId: string; index: number; set: SetState } | null>(null);
  const removedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useWakeLock(!edit);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // A brand new session starts with no rest timer, so a countdown left over from a discarded or
  // pruned draft can't show up before the first set is done.
  useEffect(() => {
    if (!edit && !init.restored && !hasContent(init.form)) restTimer.dismiss();
  }, [edit, init.restored, init.form]);

  // ── Autosave ──────────────────────────────────────────────
  const savedRef = useRef(false);
  const formRef = useRef(form);
  const startedAtRef = useRef(startedAt);
  useEffect(() => {
    formRef.current = form;
    startedAtRef.current = startedAt;
  });

  useEffect(() => {
    function persist(f: FormState) {
      if (savedRef.current) return;
      // Edit drafts only exist while there are unsaved changes. A new session is "started" the
      // moment the form opens, so its draft (and clock) is kept even while still blank.
      if (edit && signature(f) === init.baseSig) {
        clearDraft(draftKey);
        return;
      }
      writeDraft(
        draftKey,
        JSON.stringify({
          v: 1,
          form: f,
          startedAt: edit ? undefined : startedAtRef.current,
          clientKey: edit ? undefined : clientKeyRef.current,
          base: edit ? init.baseSig : undefined,
          savedAt: Date.now(),
        })
      );
    }
    const t = setTimeout(() => persist(form), 250);
    const flush = () => persist(formRef.current);
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [form, startedAt, draftKey, edit, init.baseSig]);

  // ── Form updates ──────────────────────────────────────────
  function patchBlock(blockId: string, fn: (b: BlockState) => BlockState) {
    setForm((f) => ({ ...f, blocks: f.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));
  }

  function setField(blockId: string, setId: string, field: Field, raw: string) {
    const value = sanitize(field, raw);
    const prev = form.blocks.find((b) => b.id === blockId)?.sets.find((s) => s.id === setId)?.[field];
    patchBlock(blockId, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
    }));
    // Entering the reps for a set is what kicks off the rest countdown.
    if (field === 'reps' && prev === '' && value !== '' && timerOn && !edit) {
      restTimer.start(settings.rest_seconds);
    }
  }

  // Tapping an empty field that shows a grey hint accepts the hint as typed input.
  function onFieldFocus(
    e: React.FocusEvent<HTMLInputElement>,
    block: BlockState,
    set: SetState,
    field: Field,
    hint: string
  ) {
    const el = e.currentTarget;
    if (set[field] === '' && hint) setField(block.id, set.id, field, hint);
    // Select the whole value so typing replaces it. iOS needs a second go after it has settled.
    const selectAll = () => {
      try {
        el.setSelectionRange(0, el.value.length);
      } catch {
        // some input types don't support selection
      }
    };
    requestAnimationFrame(selectAll);
    setTimeout(selectAll, 80);
  }

  // Tapping the set number steps through normal, warm-up, drop, failure.
  function cycleType(blockId: string, setId: string) {
    patchBlock(blockId, (b) => ({
      ...b,
      sets: b.sets.map((s) =>
        s.id === setId ? { ...s, type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length] } : s
      ),
    }));
  }

  function addExercise(ex: ExerciseWithLast) {
    const rows = Math.min(8, Math.max(1, ex.last_sets.length));
    const block: BlockState = {
      id: uid(),
      exerciseId: ex.id,
      sets: Array.from({ length: rows }, emptySet),
    };
    setForm((f) => ({ ...f, blocks: [...f.blocks, block] }));
    setPickerOpen(false);
    requestAnimationFrame(() =>
      document.getElementById(`block-${block.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  async function toggleTimer(next: boolean) {
    setTimerOn(next);
    if (!next) restTimer.dismiss();
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rest_timer_enabled: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTimerOn(!next);
      setError('Could not save the rest timer setting.');
    }
  }

  // ── Save ──────────────────────────────────────────────────
  // Rows the user never touched (planned from last time but skipped) are not part of the session.
  function withoutBlankRows(blocks: BlockState[]): BlockState[] {
    return blocks
      .map((b) => ({ ...b, sets: b.sets.filter((s) => !isBlankSet(s)) }))
      .filter((b) => b.sets.length > 0);
  }

  function firstInvalid(blocks: BlockState[]): string | null {
    for (const b of blocks) {
      const ex = byId.get(b.exerciseId);
      for (const s of b.sets) {
        if (!ex?.is_bodyweight && !weightOk(s.weight)) return `f-${s.id}-weight`;
        if (!repsOk(s.reps)) return `f-${s.id}-reps`;
        if (s.rpe && !rpeOk(s.rpe)) return `f-${s.id}-rpe`;
      }
    }
    return null;
  }

  async function submit() {
    if (saving) return;
    setAttempted(true);
    setError('');
    if (!form.date) return setError('Pick a date.');
    const blocks = withoutBlankRows(form.blocks);
    if (blocks.length === 0) return setError('Add at least one exercise and fill in a set.');
    if (edit && form.durationMin !== '' && (Number(form.durationMin) < 1 || Number(form.durationMin) > MAX_MINUTES)) {
      return setError(`Duration must be between 1 and ${MAX_MINUTES} minutes, or blank.`);
    }
    const bad = firstInvalid(blocks);
    if (bad) {
      setError('Fill in the highlighted fields.');
      // Scroll only. Focusing would tap-fill the grey hint and defeat the check.
      requestAnimationFrame(() =>
        document.getElementById(bad)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      );
      return;
    }
    if (blocks.length !== form.blocks.length || blocks.some((b, i) => b.sets.length !== form.blocks[i].sets.length)) {
      setForm((f) => ({ ...f, blocks }));
    }

    let duration_seconds: number | null;
    if (edit) {
      // Untouched field: send the stored seconds back as they were, no rounding drift.
      duration_seconds =
        form.durationMin === init.baseline.durationMin
          ? edit.session.duration_seconds
          : form.durationMin === ''
            ? null
            : Number(form.durationMin) * 60;
    } else {
      const secs = Math.round((Date.now() - startedAt) / 1000);
      duration_seconds = secs >= 1 && secs <= MAX_AUTO_DURATION_S ? secs : null;
    }

    const payload = {
      date: form.date,
      label: form.label.trim() || null,
      notes: form.notes.trim() || null,
      duration_seconds,
      blocks: blocks.map((b) => {
        const bw = byId.get(b.exerciseId)?.is_bodyweight ?? false;
        return {
          exercise_id: b.exerciseId,
          sets: b.sets.map((s) => ({
            reps: parseInt(s.reps, 10),
            weight: bw ? null : parseFloat(s.weight),
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            set_type: s.type,
          })),
        };
      }),
    };

    // Same content as a save that may have gone through before the connection dropped: reuse its key
    // so the server hands back that session. Changed content gets a fresh key.
    const contentSig = JSON.stringify(payload.blocks) + payload.date + payload.label + payload.notes;
    let key = clientKeyRef.current;
    if (lastFailedRef.current && lastFailedRef.current.body !== contentSig) key = newKey();
    clientKeyRef.current = key;

    setSaving(true);
    try {
      const res = await fetch(edit ? `/api/sessions/${edit.session.id}` : '/api/sessions', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit ? payload : { ...payload, client_key: key }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Could not save. Try again.');
      savedRef.current = true;
      clearDraft(draftKey);
      restTimer.dismiss();
      router.push(`/history/${edit ? edit.session.id : data.id}`);
    } catch (e) {
      lastFailedRef.current = { key, body: contentSig };
      setError(
        e instanceof TypeError
          ? 'No connection. Your session is still saved on this device, tap Save again when you have signal. It will not be saved twice.'
          : e instanceof Error
            ? e.message
            : 'Could not save. Try again.'
      );
      setSaving(false);
    }
  }

  function removeSet(block: BlockState, index: number) {
    const set = block.sets[index];
    patchBlock(block.id, (b) => ({ ...b, sets: b.sets.filter((x) => x.id !== set.id) }));
    clearTimeout(removedTimer.current);
    setRemoved({ blockId: block.id, index, set });
    removedTimer.current = setTimeout(() => setRemoved(null), 8000);
  }

  function undoRemove() {
    if (!removed) return;
    const { blockId, index, set } = removed;
    patchBlock(blockId, (b) => {
      const sets = [...b.sets];
      sets.splice(Math.min(index, sets.length), 0, set);
      return { ...b, sets };
    });
    clearTimeout(removedTimer.current);
    setRemoved(null);
  }

  const fieldCls = (invalid: boolean) =>
    `h-14 w-full min-w-0 scroll-mb-40 rounded-xl border bg-white px-1 text-center text-xl font-semibold tabular-nums text-gray-900 placeholder:font-normal focus:outline-none focus:ring-2 ${
      invalid
        ? 'border-red-600 bg-red-50 ring-2 ring-red-200'
        : 'border-gray-300 focus:border-brand-ink focus:ring-brand/40'
    }`;

  return (
    <div className="space-y-4">
      {!edit && <SessionTopBar startedAt={startedAt} />}

      {restored && (
        <div className="space-y-3 rounded-2xl border border-brand/40 bg-brand-soft p-4">
          <p className="text-sm font-medium text-gray-900">
            {edit ? 'Restored your unsaved changes.' : 'Restored your unsaved session.'}
          </p>
          <ConfirmButton
            label={edit ? 'Discard changes' : 'Discard and start over'}
            confirmLabel="Discard"
            message="This throws away everything you entered since the last save."
            variant="secondary"
            className="w-full"
            onConfirm={() => {
              clearDraft(draftKey);
              restTimer.dismiss();
              clientKeyRef.current = newKey();
              lastFailedRef.current = null;
              setForm(init.baseline);
              setStartedAt(Date.now());
              setAttempted(false);
              setError('');
              setRestored(false);
            }}
          />
        </div>
      )}

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="s-date" className={labelCls}>
              Date
            </label>
            <input
              id="s-date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={`${inputCls} min-w-0`}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="s-label" className={labelCls}>
              Label
            </label>
            <input
              id="s-label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Push, Legs..."
              maxLength={60}
              className={inputCls}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Label shortcuts">
          {LABEL_SHORTCUTS.map((l) => {
            const on = form.label === l;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => setForm((f) => ({ ...f, label: on ? '' : l }))}
                className={`min-h-12 rounded-xl border px-4 text-base font-semibold ${
                  on
                    ? 'border-brand-ink bg-brand-soft text-brand-ink'
                    : 'border-gray-300 bg-white text-gray-900 active:bg-gray-100'
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
        {edit && (
          <div>
            <label htmlFor="s-duration" className={labelCls}>
              Duration (minutes)
            </label>
            <input
              id="s-duration"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={form.durationMin}
              placeholder="Not recorded"
              onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
              className={inputCls}
            />
          </div>
        )}
        {!edit && (
          <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
            <div>
              <p className="text-base font-semibold">Rest timer</p>
              <p className="text-sm text-gray-600">
                {timerOn ? (
                  <>
                    {formatClock(settings.rest_seconds)} after each set.{' '}
                    <Link href="/settings" className="inline-flex min-h-11 items-center font-medium text-brand-ink underline">
                      Change length
                    </Link>
                  </>
                ) : (
                  'Off'
                )}
              </p>
            </div>
            <Toggle label="Rest timer" checked={timerOn} onChange={toggleTimer} />
          </div>
        )}
        <div>
          <label htmlFor="s-notes" className={labelCls}>
            Notes
          </label>
          <textarea
            id="s-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            maxLength={2000}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-brand-ink focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>
      </Card>

      {form.blocks.map((block, blockIndex) => {
        const ex = byId.get(block.exerciseId);
        if (!ex) return null;
        const hints = placeholdersFor(block, ex.last_sets);
        const cols = ex.is_bodyweight
          ? 'grid-cols-[2.5rem_1fr_4.5rem_2.75rem]'
          : 'grid-cols-[2.5rem_1.35fr_1fr_4.5rem_2.75rem]';

        return (
          <div key={block.id} id={`block-${block.id}`} className="scroll-mt-4">
            <Card className="space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{ex.name}</h2>
                  <Chip tone="brand">{capitalize(ex.primary_muscle)}</Chip>
                </div>
                {ex.last_sets.length > 0 && (
                  <p className="mt-0.5 text-sm text-gray-600">
                    Last time: {ex.last_sets.map((s) => formatSet(s, ex.is_bodyweight)).join(', ')}
                  </p>
                )}
                {blockIndex === 0 && (
                  <p className="mt-0.5 text-sm text-gray-600">
                    Tap a set number to mark it warm-up (W), drop set (D) or failure (F).
                  </p>
                )}
              </div>

              <div className={`grid ${cols} items-end gap-1.5 text-center text-xs font-medium text-gray-600`}>
                <span>Set</span>
                {!ex.is_bodyweight && <span>Weight (kg)</span>}
                <span>Reps</span>
                <span>RPE</span>
                <span />
              </div>

              {block.sets.map((s, i) => {
                const hint = hints[i];
                const name = `set ${i + 1}, ${ex.name}`;
                const done = !edit && repsOk(s.reps) && (ex.is_bodyweight || weightOk(s.weight));
                return (
                  <div
                    key={s.id}
                    className={`-mx-1.5 grid ${cols} items-center gap-1.5 rounded-xl p-1.5 transition-colors ${
                      done ? 'bg-brand-soft' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => cycleType(block.id, s.id)}
                      aria-label={`Set ${i + 1} is ${SET_TYPE_NAMES[s.type].toLowerCase()}, ${ex.name}. Tap to change.`}
                      className={`flex h-12 w-full items-center justify-center rounded-xl text-base font-bold ${
                        s.type === 'normal' && done ? 'text-brand-ink' : TYPE_STYLE[s.type]
                      }`}
                    >
                      <span className="flex flex-col items-center leading-none">
                        <span>{i + 1}</span>
                        {s.type !== 'normal' && <span className="mt-0.5 text-[11px]">{SET_TYPE_LETTERS[s.type]}</span>}
                      </span>
                    </button>
                    {!ex.is_bodyweight && (
                      <input
                        id={`f-${s.id}-weight`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Weight in kilograms, ${name}`}
                        value={s.weight}
                        placeholder={hint.weight}
                        onFocus={(e) => onFieldFocus(e, block, s, 'weight', hint.weight)}
                        onChange={(e) => setField(block.id, s.id, 'weight', e.target.value)}
                        className={fieldCls(attempted && !weightOk(s.weight))}
                      />
                    )}
                    <input
                      id={`f-${s.id}-reps`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      aria-label={`Reps, ${name}`}
                      value={s.reps}
                      placeholder={hint.reps}
                      onFocus={(e) => onFieldFocus(e, block, s, 'reps', hint.reps)}
                      onChange={(e) => setField(block.id, s.id, 'reps', e.target.value)}
                      className={fieldCls(attempted && !repsOk(s.reps))}
                    />
                    <input
                      id={`f-${s.id}-rpe`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`RPE, ${name}`}
                      value={s.rpe}
                      placeholder={hint.rpe}
                      onFocus={(e) => onFieldFocus(e, block, s, 'rpe', hint.rpe)}
                      onChange={(e) => setField(block.id, s.id, 'rpe', e.target.value)}
                      className={fieldCls(attempted && s.rpe !== '' && !rpeOk(s.rpe))}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      disabled={block.sets.length === 1}
                      onClick={() => removeSet(block, i)}
                      className="flex h-12 w-11 items-center justify-center rounded-xl text-2xl text-gray-600 active:bg-gray-100 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {removed?.blockId === block.id && (
                <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-gray-100 px-3">
                  <span className="text-sm text-gray-800">Set removed.</span>
                  <button
                    type="button"
                    onClick={undoRemove}
                    className="min-h-12 px-2 text-base font-semibold text-brand-ink"
                  >
                    Undo
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => patchBlock(block.id, (b) => ({ ...b, sets: [...b.sets, emptySet()] }))}
                className={`${btn('secondary')} w-full`}
              >
                Add set
              </button>
              <ConfirmButton
                label="Remove exercise"
                confirmLabel="Remove"
                message={`Remove ${ex.name} and its sets from this session?`}
                variant="ghost"
                className="w-full text-red-700!"
                onConfirm={() => setForm((f) => ({ ...f, blocks: f.blocks.filter((b) => b.id !== block.id) }))}
              />
            </Card>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={`${btn(!edit && form.blocks.length === 0 ? 'primary' : 'secondary', 'lg')} w-full`}
      >
        Add exercise
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <button type="button" onClick={submit} disabled={saving} className={`${btn('primary', 'lg')} w-full`}>
          {saving ? 'Saving...' : edit ? 'Save changes' : 'Save session'}
        </button>
        {edit && (
          <Link href={`/history/${edit.session.id}`} className={`${btn('secondary')} w-full`}>
            Cancel
          </Link>
        )}
        <p className="text-center text-xs text-gray-600">Your progress is saved on this device as you go.</p>
      </div>

      {!edit && <RestTimerBar />}

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          onPick={addExercise}
          onCreated={(ex) => {
            setExercises((list) => [ex, ...list]);
            addExercise(ex);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
