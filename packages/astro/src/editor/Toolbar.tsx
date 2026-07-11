import React, { useEffect, useState } from 'react';
import type { Config } from '@drystack/core';
import { enableEditing, disableEditing } from './bind';
import { getAllEdits } from './store';
import { saveEdits } from './save';

const barStyle: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 16,
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 999,
  background: '#111827',
  color: '#fff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  zIndex: 2147483647,
};

const buttonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export function Toolbar({ config }: { config: Config<any, any> }) {
  const [editing, setEditing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);

  const refreshCount = async () => {
    setPendingCount((await getAllEdits()).length);
  };

  useEffect(() => {
    refreshCount();
  }, []);

  const toggleEdit = () => {
    if (editing) {
      disableEditing();
    } else {
      enableEditing(refreshCount);
    }
    setEditing(!editing);
  };

  const onSave = async () => {
    setStatus('saving');
    setError(null);
    try {
      await saveEdits(config);
      await refreshCount();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={barStyle}>
      <button
        style={{
          ...buttonStyle,
          background: editing ? '#2563eb' : 'transparent',
          color: '#fff',
          border: '1px solid #374151',
        }}
        onClick={toggleEdit}
      >
        {editing ? 'Đang sửa' : 'Sửa trang'}
      </button>
      <button
        style={{
          ...buttonStyle,
          background: pendingCount > 0 ? '#16a34a' : '#374151',
          color: '#fff',
          opacity: pendingCount > 0 && status !== 'saving' ? 1 : 0.6,
        }}
        onClick={onSave}
        disabled={pendingCount === 0 || status === 'saving'}
      >
        {status === 'saving'
          ? 'Đang lưu…'
          : `Lưu${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
      </button>
      {status === 'saved' && <span>Đã lưu</span>}
      {status === 'error' && (
        <span style={{ color: '#fca5a5', maxWidth: 320 }}>{error}</span>
      )}
    </div>
  );
}
