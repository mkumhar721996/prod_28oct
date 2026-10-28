"use client";

import { useState, type ReactNode } from "react";
import { nextIndex, prevIndex, showsControls } from "@/lib/carouselNav";

export function CarouselView({ slides, className }: { slides: ReactNode[]; className: string }) {
  const [index, setIndex] = useState(0);
  if (slides.length === 0) return null;
  return (
    <div className={`${className} carousel`} aria-roledescription="carousel">
      <div className="carousel-slide">{slides[index]}</div>
      {showsControls(slides.length) ? (
        <div className="carousel-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIndex(prevIndex(index, slides.length))}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIndex(nextIndex(index, slides.length))}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
