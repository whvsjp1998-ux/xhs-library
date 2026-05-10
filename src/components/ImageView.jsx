import Masonry from 'react-masonry-css';
import { imageUrl } from '../imageUrl.js';

const breakpointCols = {
  default: 4,
  1280: 4,
  1024: 3,
  768: 2,
  520: 2,
};

export default function ImageView({ notes, onSelect }) {
  return (
    <Masonry
      breakpointCols={breakpointCols}
      className="flex gap-3"
      columnClassName="flex flex-col gap-3"
    >
      {notes.map((note) => (
        <div
          key={note.id}
          className="relative group cursor-pointer overflow-hidden rounded-2xl bg-gray-200 break-inside-avoid"
          onClick={() => onSelect(note)}
        >
          {note.images[0] ? (
            <img
              src={imageUrl(note.images[0])}
              alt=""
              className="w-full block"
            />
          ) : note.videos?.[0] ? (
            <video
              src={note.videos[0]}
              className="w-full block bg-black"
              controls
              playsInline
            />
          ) : (
            <div className="w-full h-36 flex items-center justify-center text-gray-400 text-sm select-none">
              无图片
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3">
            <span className="text-white text-xs font-medium line-clamp-2 leading-snug">
              {note.title}
            </span>
          </div>

          {/* Multi-image badge */}
          {note.images.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {note.images.length}张
            </div>
          )}
        </div>
      ))}
    </Masonry>
  );
}
