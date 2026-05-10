import { useState } from 'react';

export default function CollectionFilter({ collections, selected, onSelect, onCreate }) {
  const [name, setName] = useState('');

  const create = () => {
    const next = name.trim();
    if (!next) return;
    onCreate(next);
    onSelect(next);
    setName('');
  };

  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
        合集
      </h3>
      <div className="space-y-0.5 mb-2">
        <button
          onClick={() => onSelect('')}
          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
            selected === ''
              ? 'bg-[#ff2442] text-white font-medium'
              : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部
        </button>
        {collections.map((collection) => (
          <button
            key={collection}
            onClick={() => onSelect(collection === selected ? '' : collection)}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm truncate transition-colors ${
              selected === collection
                ? 'bg-[#ff2442] text-white font-medium'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {collection}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
          }}
          placeholder="新合集"
          className="min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-xs outline-none focus:border-[#ff2442]"
        />
        <button
          onClick={create}
          className="px-2 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:bg-black"
        >
          +
        </button>
      </div>
    </div>
  );
}
