import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Config } from '@drystack/core';
// @ts-expect-error — provided by the drystack Astro integration's Vite plugin
import apiPath from 'virtual:keystatic-path';
import { Badge } from '@keystar/ui/badge';
import { ActionButton, Button, ButtonGroup } from '@keystar/ui/button';
import { Dialog, DialogContainer, useDialogContainer } from '@keystar/ui/dialog';
import { Icon } from '@keystar/ui/icon';
import { editIcon } from '@keystar/ui/icon/icons/editIcon';
import { xIcon } from '@keystar/ui/icon/icons/xIcon';
import { saveIcon } from '@keystar/ui/icon/icons/saveIcon';
import { eyeIcon } from '@keystar/ui/icon/icons/eyeIcon';
import { externalLinkIcon } from '@keystar/ui/icon/icons/externalLinkIcon';
import { chevronRightIcon } from '@keystar/ui/icon/icons/chevronRightIcon';
import { trash2Icon } from '@keystar/ui/icon/icons/trash2Icon';
import { HStack } from '@keystar/ui/layout';
import { Content } from '@keystar/ui/slots';
import { toastQueue } from '@keystar/ui/toast';
import { Tooltip, TooltipTrigger } from '@keystar/ui/tooltip';
import { Heading, Text } from '@keystar/ui/typography';
import { enableEditing, disableEditing, getOriginalValue, refreshFromLatestSource } from './bind';
import { getAllEdits, deleteEdit } from './store';
import { saveEdits, getCurrentBranchName } from './save';
import { showDeployProgressToast } from '@drystack/core/deploy-progress-toast';
import { refreshAfterDeploy } from './dom-refresh';

type Spot = { key: string; name: string; field: string };
type FieldChange = Spot & { before: string; after: string };

const adminBase = `/${String(apiPath).replace(/^\/+|\/+$/g, '')}`;

// Every editable spot rendered on the current page, read from the DOM.
// Deduped by key — the same field can appear on multiple elements (e.g. a
// site title in both the header and footer), and consumers below need one
// entry per key, not one per DOM node, since they re-query all matching
// elements by key when they need to touch the DOM.
function readSpots(): Spot[] {
  const seen = new Set<string>();
  const spots: Spot[] = [];
  document.querySelectorAll<HTMLElement>('[data-dry]').forEach(el => {
    const key = el.getAttribute('data-dry');
    if (!key || seen.has(key)) return;
    const [type, name, field] = key.split('::');
    if (type === 'singleton' && name && field) {
      seen.add(key);
      spots.push({ key, name, field });
    }
  });
  return spots;
}

export function Toolbar({ config }: { config: Config<any, any> }) {
  const [editing, setEditing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);

  // Hover dropdown state — the menu itself is portaled to <body>.
  const refWrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [refOpen, setRefOpen] = useState(false);
  const [refPos, setRefPos] = useState({ left: 0, bottom: 0 });

  const refreshCount = async () => {
    setPendingCount((await getAllEdits()).length);
  };

  useEffect(() => {
    refreshCount();
    setSpots(readSpots());
  }, []);

  const toggleEdit = () => {
    if (editing) {
      disableEditing();
    } else {
      enableEditing(refreshCount);
      setSpots(readSpots());
      // Don't block entering edit mode on the network — repaint with the
      // real current source once it resolves, fields with a pending edit
      // stay untouched.
      refreshFromLatestSource(config).then(refreshCount);
    }
    setEditing(!editing);
  };

  const onSave = async () => {
    setSaving(true);
    const editedKeys = (await getAllEdits()).map(e => e.key);
    try {
      const commitOid = await saveEdits(config);
      await refreshCount();
      if (!commitOid) {
        // Local mode, or nothing to commit — already live, nothing to track.
        toastQueue.positive('Changes saved', { timeout: 4000 });
        return;
      }
      trackDeploy(commitOid, editedKeys, refreshCount);
    } catch (err) {
      toastQueue.critical(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const goToAdmin = async (name: string) => {
    try {
      const branch = await getCurrentBranchName(config);
      const branchSegment = branch ? `branch/${encodeURIComponent(branch)}/` : '';
      window.location.href = `${adminBase}/${branchSegment}singleton/${encodeURIComponent(name)}`;
    } catch (err) {
      toastQueue.critical(err instanceof Error ? err.message : String(err));
    }
  };

  // Highlight (and scroll to) every editable spot belonging to a singleton.
  const flashSingleton = (name: string, on: boolean) => {
    const els = spots
      .filter(s => s.name === name)
      .flatMap(s =>
        Array.from(
          document.querySelectorAll<HTMLElement>(`[data-dry="${CSS.escape(s.key)}"]`)
        )
      );
    els.forEach(el => el.classList.toggle('dry-spot-flash', on));
    if (on && els[0]) {
      els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // One entry per singleton (deduped), labelled from config.
  const singletonList = Array.from(
    new Map(
      spots.map(s => [
        s.name,
        (config.singletons?.[s.name] as { label?: string })?.label ?? s.name,
      ])
    )
  ).map(([name, label]) => ({ name, label }));

  const openRefMenu = () => {
    clearTimeout(closeTimer.current);
    const el = refWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRefPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    setRefOpen(true);
  };
  const scheduleCloseRefMenu = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setRefOpen(false), 140);
  };

  const nothingToSave = pendingCount === 0;

  return (
    <div className="dry-bar">
      <Button
        prominence="high"
        aria-label={editing ? 'Exit edit mode' : 'Edit page'}
        onPress={toggleEdit}
        UNSAFE_className="dry-fab"
      >
        <span className={`dry-fab-icon dry-fab-icon--edit${editing ? ' is-hidden' : ''}`}>
          <Icon src={editIcon} />
        </span>
        <span className={`dry-fab-icon dry-fab-icon--x${editing ? '' : ' is-hidden'}`}>
          <Icon src={xIcon} />
        </span>
      </Button>

      <div className={`dry-menu${editing ? ' is-open' : ''}`}>
        <div className="dry-menu-inner">
          <HStack
            gap="regular"
            alignItems="center"
            backgroundColor="surface"
            border="muted"
            borderRadius="full"
            paddingX="medium"
            paddingY="regular"
            elementType="section"
            UNSAFE_style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.18)', overflow: 'hidden' }}
          >
            <div
              className="dry-ref"
              ref={refWrapRef}
              onMouseEnter={openRefMenu}
              onMouseLeave={scheduleCloseRefMenu}
            >
              <ActionButton
                aria-label="Open in drystack admin"
                isDisabled={singletonList.length === 0}
                UNSAFE_className="dry-iconbtn"
              >
                <Icon src={externalLinkIcon} />
              </ActionButton>
            </div>

            <TooltipTrigger>
              <div className="dry-review">
                <ActionButton
                  aria-label="Review changes"
                  onPress={() => setReviewOpen(true)}
                  isDisabled={nothingToSave}
                  UNSAFE_className="dry-iconbtn"
                >
                  <Icon src={eyeIcon} />
                </ActionButton>
                {!nothingToSave && (
                  <span className="dry-badge">
                    <Badge tone="accent">{pendingCount}</Badge>
                  </span>
                )}
              </div>
              <Tooltip>Review changes</Tooltip>
            </TooltipTrigger>

            <TooltipTrigger>
              <Button
                aria-label="Save changes"
                prominence="high"
                onPress={onSave}
                isDisabled={nothingToSave || saving}
                UNSAFE_className="dry-iconbtn"
              >
                <Icon src={saveIcon} />
              </Button>
              <Tooltip>{saving ? 'Saving…' : 'Save changes'}</Tooltip>
            </TooltipTrigger>
          </HStack>
        </div>
      </div>

      {refOpen &&
        singletonList.length > 0 &&
        createPortal(
          <div
            className="dry-ref-menu"
            role="menu"
            style={{ left: refPos.left, bottom: refPos.bottom }}
            onMouseEnter={openRefMenu}
            onMouseLeave={scheduleCloseRefMenu}
          >
            {singletonList.map(s => (
              <button
                type="button"
                role="menuitem"
                key={s.name}
                className="dry-ref-item"
                onMouseEnter={() => flashSingleton(s.name, true)}
                onMouseLeave={() => flashSingleton(s.name, false)}
                onClick={() => goToAdmin(s.name)}
              >
                <span className="dry-ref-name">{s.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}

      <DialogContainer onDismiss={() => setReviewOpen(false)}>
        {reviewOpen && <ReviewDialog onChange={refreshCount} />}
      </DialogContainer>
    </div>
  );
}

// Opens a single persistent toast tracking the Cloudflare build for
// `commitOid`, then reacts to the outcome: on success, morphs the page to the
// freshly deployed HTML (dom-refresh.ts) instead of a hard reload; on
// failure/cancel/timeout, leaves the edits in IndexedDB (nothing shipped) and
// reports the outcome as a separate short-lived toast.
function trackDeploy(
  commitOid: string,
  editedKeys: string[],
  onSettledRefresh: () => void
) {
  showDeployProgressToast(commitOid, async outcome => {
    if (outcome === 'succeeded') {
      await refreshAfterDeploy(editedKeys);
      onSettledRefresh();
      toastQueue.positive('Đã cập nhật trang mới nhất', { timeout: 4000 });
    } else if (outcome === 'failed' || outcome === 'canceled') {
      toastQueue.critical(
        'Build thất bại — các thay đổi vẫn được giữ lại, thử lưu lại sau.',
        { timeout: 8000 }
      );
    } else {
      toastQueue.info(
        'Build đang lâu hơn bình thường — tải lại trang để kiểm tra.',
        { timeout: 8000 }
      );
    }
  });
}

function ReviewDialog({ onChange }: { onChange: () => void }) {
  const { dismiss } = useDialogContainer();
  const [changes, setChanges] = useState<FieldChange[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllEdits().then(edits => {
      if (cancelled) return;
      const list = edits
        .map(e => {
          const [, name, field] = e.key.split('::');
          return {
            key: e.key,
            name,
            field,
            before: getOriginalValue(e.key) ?? '',
            after: e.value,
          };
        })
        .filter(c => c.before !== c.after);
      setChanges(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Discard a single field's edit: drop it from the store, revert the live DOM
  // back to its original value, and refresh the toolbar's pending count.
  const handleDelete = async (key: string) => {
    await deleteEdit(key);
    const els = document.querySelectorAll<HTMLElement>(
      `[data-dry="${CSS.escape(key)}"]`
    );
    const original = getOriginalValue(key);
    if (original != null) els.forEach(el => { el.textContent = original; });
    setChanges(cs => cs?.filter(c => c.key !== key) ?? null);
    onChange();
  };

  return (
    <Dialog size="large" aria-label="Review changes">
      <Heading>Review changes</Heading>
      <Content>
        {!changes && <Text>Loading…</Text>}
        {changes?.length === 0 && <Text>No changes.</Text>}
        {changes && changes.length > 0 && (
          <div>
            {changes.map((c, i) => (
              <FieldDiffView
                key={c.key}
                change={c}
                defaultOpen={i === 0}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Content>
      <ButtonGroup>
        <Button onPress={dismiss}>Close</Button>
      </ButtonGroup>
    </Dialog>
  );
}

function FieldDiffView({
  change,
  defaultOpen,
  onDelete,
}: {
  change: FieldChange;
  defaultOpen?: boolean;
  onDelete: (key: string) => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const lines = diffLines(change.before, change.after);
  return (
    <div className="dry-acc">
      <div className="dry-acc-head">
        <button
          type="button"
          className="dry-acc-summary"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          <span className={`dry-acc-chevron${open ? ' is-open' : ''}`}>
            <Icon src={chevronRightIcon} />
          </span>
          <Text weight="semibold">{change.field}</Text>
          <Text color="neutralSecondary">· {change.name}</Text>
        </button>
        <TooltipTrigger>
          <ActionButton
            prominence="low"
            aria-label="Discard this change"
            onPress={() => onDelete(change.key)}
          >
            <Icon src={trash2Icon} />
          </ActionButton>
          <Tooltip>Discard this change</Tooltip>
        </TooltipTrigger>
      </div>
      <div className={`dry-acc-body${open ? ' is-open' : ''}`}>
        <div className="dry-acc-body-inner">
          <div
            className="dry-diff"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              lineHeight: 1.5,
              borderTop: '1px solid rgba(128,128,128,0.3)',
              overflowX: 'auto',
            }}
          >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '0 8px',
              background:
                line.type === 'add'
                  ? 'rgba(22,163,74,0.16)'
                  : line.type === 'del'
                    ? 'rgba(220,38,38,0.16)'
                    : 'transparent',
            }}
          >
            <span
              style={{
                width: 16,
                flex: 'none',
                userSelect: 'none',
                color:
                  line.type === 'add'
                    ? '#16a34a'
                    : line.type === 'del'
                      ? '#dc2626'
                      : 'rgba(128,128,128,0.7)',
              }}
            >
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </span>
            <span style={{ flex: 1 }}>{line.text || ' '}</span>
          </div>
        ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type DiffLine = { type: 'add' | 'del' | 'same'; text: string };

// Minimal LCS line diff — enough to preview a single field's text change.
function diffLines(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : [];
  const b = after ? after.split('\n') : [];
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}
