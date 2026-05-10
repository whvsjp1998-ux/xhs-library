import { useState, useEffect, useCallback } from 'react';
import CardView from './components/CardView.jsx';
import ImageView from './components/ImageView.jsx';
import TagFilter from './components/TagFilter.jsx';
import SearchBar from './components/SearchBar.jsx';
import NoteModal from './components/NoteModal.jsx';

function getApiBase() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }

  if (window.location.port === '5173') {
    return 'http://localhost:3001';
  }

  return window.location.origin;
}

const API = getApiBase();

export default function App() {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [view, setView] = useState('card');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [error, setError] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (selectedTag) p.set('tag', selectedTag);
    try {
      const res = await fetch(`${API}/notes?${p}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setNotes(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotes([]);
      setError(e.message || 'Server is not ready');
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tags`);
      const data = await res.json();
      setTags(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const deleteNote = async (id) => {
    await fetch(`${API}/notes/${id}`, { method: 'DELETE' });
    setSelectedNote(null);
    fetchNotes();
    fetchTags();
  };

  useEffect(() => { fetchNotes(); }, [fetchNotes]);
  useEffect(() => { fetchTags(); }, [fetchTags]);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-5 h-14 flex items-center gap-4">
          <span className="text-lg font-bold text-[#ff2442] whitespace-nowrap select-none">
            📚 小红书库
          </span>
          <div className="flex-1 max-w-md">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="flex gap-1.5 ml-auto">
            {['card', 'image'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-[#ff2442] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v === 'card' ? '卡片' : '图片'}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">{notes.length} 条</span>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-5 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-40 flex-shrink-0">
          <TagFilter tags={tags} selected={selectedTag} onSelect={setSelectedTag} />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-8 h-8 border-2 border-[#ff2442] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-24 text-gray-500 select-none">
              <div className="text-sm font-medium text-red-500 mb-2">服务连接失败</div>
              <div className="text-xs text-gray-400">{error}</div>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-24 text-gray-400 select-none">
              <div className="text-5xl mb-3">📭</div>
              <div className="text-sm">
                {search || selectedTag ? '没有匹配的笔记' : '还没有保存任何笔记'}
              </div>
            </div>
          ) : view === 'card' ? (
            <CardView notes={notes} onDelete={deleteNote} onSelect={setSelectedNote} />
          ) : (
            <ImageView notes={notes} onSelect={setSelectedNote} />
          )}
        </main>
      </div>

      {selectedNote && (
        <NoteModal
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
          onDelete={deleteNote}
        />
      )}
    </div>
  );
}
