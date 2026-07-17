"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Disc, Disc3, GripVertical, Star } from "lucide-react";
import type { RecordDTO } from "@/lib/types";

function FormatBadge({ format }: { format: RecordDTO["format"] }) {
  const Icon = format === "CD" ? Disc : Disc3;
  return (
    <span className="flex w-16 shrink-0 items-center gap-1 text-[11px] uppercase tracking-wide text-ink-muted">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      {format === "OTHER" ? "Other" : format === "CD" ? "CD" : "Vinyl"}
    </span>
  );
}

function RowContent({
  record,
  onToggleFavorite,
}: {
  record: RecordDTO;
  onToggleFavorite: (record: RecordDTO) => void;
}) {
  return (
    <>
      {record.coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={record.coverSrc}
          alt=""
          loading="lazy"
          className="h-9 w-9 shrink-0 rounded-[2px] object-cover ring-1 ring-black/5"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] bg-line/60">
          <Disc3 className="h-4 w-4 text-ink-muted" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{record.title}</span>
        <span className="block truncate text-xs text-ink-muted">
          {record.artist}
          {record.year ? ` - ${record.year}` : ""}
        </span>
      </span>
      <FormatBadge format={record.format} />
      <button
        type="button"
        onClick={() => onToggleFavorite(record)}
        aria-label={record.isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={record.isFavorite}
        className={`rounded-full p-2 transition-colors ${
          record.isFavorite
            ? "text-ink"
            : "text-line-strong hover:text-ink-muted"
        }`}
      >
        <Star
          className="h-4 w-4"
          strokeWidth={1.75}
          fill={record.isFavorite ? "currentColor" : "none"}
        />
      </button>
    </>
  );
}

function SortableRow({
  record,
  onToggleFavorite,
}: {
  record: RecordDTO;
  onToggleFavorite: (record: RecordDTO) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: record.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${
        isDragging
          ? "z-10 bg-surface shadow-[0_12px_32px_-12px_rgba(19,19,22,0.35)] ring-1 ring-line-strong"
          : "hover:bg-canvas"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${record.title}`}
        className="cursor-grab touch-none rounded p-1.5 text-line-strong transition-colors hover:text-ink-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <RowContent record={record} onToggleFavorite={onToggleFavorite} />
    </li>
  );
}

export default function RecordList({
  records,
  onReorder,
  onToggleFavorite,
}: {
  records: RecordDTO[];
  onReorder: (orderedIds: number[]) => void;
  onToggleFavorite: (record: RecordDTO) => void;
}) {
  const active = records.filter((r) => !r.archived);
  const archived = records.filter((r) => r.archived);
  const [dragIds, setDragIds] = useState<number[] | null>(null);

  const displayed = dragIds
    ? (dragIds
        .map((id) => active.find((r) => r.id === id))
        .filter(Boolean) as RecordDTO[])
    : active;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    setDragIds(null);
    if (!over || dragged.id === over.id) return;
    const ids = active.map((r) => r.id);
    const from = ids.indexOf(Number(dragged.id));
    const to = ids.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displayed.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {displayed.map((record) => (
              <SortableRow
                key={record.id}
                record={record}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {archived.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-2 flex items-center gap-1.5 px-2 text-xs uppercase tracking-[0.14em] text-ink-muted">
            <Archive className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Missing from last sync
          </h3>
          <ul className="opacity-60">
            {archived.map((record) => (
              <li
                key={record.id}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 pl-9"
              >
                <RowContent record={record} onToggleFavorite={onToggleFavorite} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
