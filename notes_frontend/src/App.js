import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

/**
 * Format ISO timestamp to a small readable string.
 * Falls back gracefully if parsing fails.
 */
function formatTimestamp(isoString) {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  return dt.toLocaleString();
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const isEditingExisting = Boolean(selectedNote);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const syncEditorWithSelection = (note) => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
  };

  const fetchNotes = async () => {
    setLoading(true);
    clearMessages();

    try {
      const res = await fetch(`${API_BASE_URL}/notes`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || `Failed to load notes (${res.status})`);
      }
      const data = await res.json();
      setNotes(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e.message || 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    syncEditorWithSelection(selectedNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const startNewNote = () => {
    clearMessages();
    setSelectedId(null);
    syncEditorWithSelection(null);
  };

  const selectNote = (id) => {
    clearMessages();
    setSelectedId(id);
  };

  const validate = () => {
    if (!title.trim()) return 'Title is required.';
    return '';
  };

  const createNote = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const res = await fetch(`${API_BASE_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || `Failed to create note (${res.status})`);
      }

      const created = await res.json();
      setInfo('Note created.');
      await fetchNotes();
      setSelectedId(created.id);
    } catch (e) {
      setError(e.message || 'Failed to create note.');
    } finally {
      setSaving(false);
    }
  };

  const updateNote = async () => {
    if (!selectedNote) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const didChange =
      title.trim() !== (selectedNote.title || '') || content !== (selectedNote.content || '');

    if (!didChange) {
      setInfo('No changes to save.');
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const res = await fetch(`${API_BASE_URL}/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || `Failed to update note (${res.status})`);
      }

      setInfo('Changes saved.');
      await fetchNotes();
    } catch (e) {
      setError(e.message || 'Failed to update note.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedNote) return;

    // Non-blocking confirmation (still uses built-in confirm for simplicity)
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this note? This cannot be undone.');
    if (!ok) return;

    setDeleting(true);
    clearMessages();

    try {
      const res = await fetch(`${API_BASE_URL}/notes/${selectedNote.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.detail || `Failed to delete note (${res.status})`);
      }

      setInfo('Note deleted.');
      setSelectedId(null);
      syncEditorWithSelection(null);
      await fetchNotes();
    } catch (e) {
      setError(e.message || 'Failed to delete note.');
    } finally {
      setDeleting(false);
    }
  };

  const onPrimaryAction = async () => {
    if (isEditingExisting) {
      await updateNote();
    } else {
      await createNote();
    }
  };

  return (
    <div className="NotesApp">
      <header className="TopBar">
        <div className="TopBar-left">
          <div className="AppTitle">Notes</div>
          <div className="AppSubtitle">Simple CRUD notes app</div>
        </div>

        <div className="TopBar-actions">
          <button className="Button Button-secondary" onClick={fetchNotes} disabled={loading}>
            Refresh
          </button>
          <button className="Button Button-primary" onClick={startNewNote}>
            New note
          </button>
        </div>
      </header>

      <main className="Main">
        <section className="Panel Panel-list" aria-label="Notes list">
          <div className="PanelHeader">
            <div className="PanelTitle">Your notes</div>
            <div className="PanelMeta">{loading ? 'Loading…' : `${notes.length} total`}</div>
          </div>

          <div className="List" role="list">
            {notes.length === 0 && !loading ? (
              <div className="EmptyState">
                <div className="EmptyTitle">No notes yet</div>
                <div className="EmptyText">Create your first note with “New note”.</div>
              </div>
            ) : null}

            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`ListItem ${selectedId === n.id ? 'is-active' : ''}`}
                onClick={() => selectNote(n.id)}
                role="listitem"
              >
                <div className="ListItem-title">{n.title}</div>
                <div className="ListItem-sub">
                  <span className="ListItem-time">Updated {formatTimestamp(n.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="Panel Panel-editor" aria-label="Note editor">
          <div className="PanelHeader">
            <div className="PanelTitle">{isEditingExisting ? 'Edit note' : 'Create note'}</div>
            <div className="PanelMeta">
              {isEditingExisting ? `Created ${formatTimestamp(selectedNote.created_at)}` : ' '}
            </div>
          </div>

          <div className="Editor">
            <label className="Field">
              <div className="FieldLabel">Title</div>
              <input
                className="Input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Grocery list"
                maxLength={200}
              />
            </label>

            <label className="Field">
              <div className="FieldLabel">Content</div>
              <textarea
                className="Textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write something…"
                rows={12}
              />
            </label>

            {(error || info) && (
              <div className={`Message ${error ? 'Message-error' : 'Message-info'}`} role="status">
                {error || info}
              </div>
            )}

            <div className="EditorActions">
              {isEditingExisting ? (
                <button
                  className="Button Button-danger"
                  onClick={deleteSelected}
                  disabled={deleting || saving}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : (
                <button className="Button Button-secondary" onClick={startNewNote}>
                  Clear
                </button>
              )}

              <div className="EditorActions-right">
                <button
                  className="Button Button-primary"
                  onClick={onPrimaryAction}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : isEditingExisting ? 'Save changes' : 'Create note'}
                </button>
              </div>
            </div>

            <div className="Hint">
              Backend: <code>{API_BASE_URL}</code>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
