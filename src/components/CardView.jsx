import Masonry from 'react-masonry-css';

const breakpointCols = {
  default: 4,
  1280: 4,
  1024: 3,
  768: 2,
  520: 1,
};

export default function CardView({ notes, onDelete, onSelect }) {
  return (
    <Masonry
      breakpointCols={breakpointCols}
      className="flex gap-3"
      columnClassName="flex flex-col gap-3"
    >
      {notes.map((note) => (
        <div
          key={note.id}
          className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer break-inside-avoid"
          onClick={() => onSelect(note)}
        >
          {note.images[0] && (
            <img
              src={note.images[0]}
              alt=""
              className="w-full block"
            />
          )}
          <div className="p-3">
            <h3 className="font-semibold text-gray-800 text-sm mb-2 line-clamp-2 leading-snug">
              {note.title}
            </h3>
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-red-50 text-[#ff2442] text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">
                {new Date(note.created_at).toLocaleDateString('zh-CN')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('确定删除这条笔记？')) onDelete(note.id);
                }}
                className="text-xs text-gray-400 hover:text-[#ff2442] transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </Masonry>
  );
}
