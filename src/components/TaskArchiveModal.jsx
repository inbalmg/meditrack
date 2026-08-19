import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Archive, X, Search, Zap, User, Undo2, ListChecks, ChevronUp, ChevronDown } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Badge, Button, Avatar, Empty } from './ui.jsx'
import { friendlyDate, hhmm } from '../lib/format.js'
import { clsx } from './clsx.js'

// Task Archive — a spacious centered modal over the whole COMPLETED backlog, laid out
// as a high-density data table. Nothing loads until it's opened; every page, filter and
// the sort order is resolved server-side (see store.fetchArchivedTasks) so paging stays
// authoritative. Restore is optimistic: the row leaves the table at once while the store
// persists. Only real task columns (title / completion time) sort server-side.
const SORT_DEFAULT_ASC = { completed_at: false, title: true }

// `personal` = a practitioner's own archive: the row set is already scoped to them by
// RLS, so the staff filter is meaningless and hidden; the subtitle reflects the scope.
export default function TaskArchiveModal({ onClose, personal = false }) {
  const { fetchArchivedTasks, restoreTask, assignees, assigneeById, patientById } = useData()

  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)      // first page / after a filter change
  const [loadingMore, setLoadingMore] = useState(false)

  // Filters. `search` is debounced into `debouncedSearch`; the date/assignee filters
  // apply immediately. Date inputs are day-granular and inclusive on both ends.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fromStr, setFromStr] = useState('')
  const [toStr, setToStr] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  // Sort: default newest-completed first.
  const [sort, setSort] = useState({ key: 'completed_at', asc: false })

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const therapists = assignees.filter((a) => a.kind === 'therapist')
  const office = assignees.filter((a) => a.kind !== 'therapist')

  // Turn the filter/sort UI into the store query.
  const buildQuery = useCallback((pageArg) => ({
    page: pageArg,
    search: debouncedSearch,
    from: fromStr ? new Date(`${fromStr}T00:00:00`) : null,
    to: toStr ? new Date(`${toStr}T23:59:59.999`) : null,
    assigneeId: assigneeId || null,
    sortKey: sort.key,
    sortAsc: sort.asc,
  }), [debouncedSearch, fromStr, toStr, assigneeId, sort])

  const reqToken = useRef(0)
  // fetchArchivedTasks gets a fresh identity on every store render; keep it in a ref so
  // the load effect keys only off filter/sort changes (buildQuery) and doesn't refire —
  // and reset pagination — whenever the store updates (e.g. after a restore).
  const fetchRef = useRef(fetchArchivedTasks)
  fetchRef.current = fetchArchivedTasks

  // (Re)load page 0 whenever a filter or the sort changes.
  useEffect(() => {
    const token = ++reqToken.current
    setLoading(true)
    fetchRef.current(buildQuery(0)).then((res) => {
      if (token !== reqToken.current) return // a newer request superseded this one
      setItems(res.tasks)
      setHasMore(res.hasMore)
      setPage(0)
      setLoading(false)
    })
  }, [buildQuery])

  function loadMore() {
    const next = page + 1
    const token = ++reqToken.current
    setLoadingMore(true)
    fetchRef.current(buildQuery(next)).then((res) => {
      if (token !== reqToken.current) return
      setItems((prev) => [...prev, ...res.tasks])
      setHasMore(res.hasMore)
      setPage(next)
      setLoadingMore(false)
    })
  }

  // Click a sortable header: toggle direction on the active column, else switch column
  // to its natural default direction (dates newest-first, names A→Z).
  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: SORT_DEFAULT_ASC[key] }))
  }

  function handleRestore(task) {
    setItems((prev) => prev.filter((t) => t.id !== task.id)) // optimistic — drop it now
    restoreTask(task)
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inputCls = 'h-9 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500'
  const colCount = 5

  // Portal to <body>: the board's page wrapper keeps a persistent transform (animate-fade
  // with fill-mode: both), which would otherwise make it the containing block for this
  // fixed overlay and pin inset-0 to the board box instead of the viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ארכיון משימות"
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-teal-300">
              <Archive size={17} />
            </span>
            <div>
              <h3 className="font-semibold text-white">ארכיון משימות</h3>
              <p className="text-xs text-slate-300">{personal ? 'המשימות שהושלמו שלי' : 'כל המשימות שהושלמו'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="סגירה"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2.5 px-5 py-3 border-b border-slate-200 bg-slate-50/60 shrink-0">
          <div className="relative flex-1 min-w-56">
            <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי כותרת, מטופל או תגית…"
              className={clsx(inputCls, 'w-full pr-9')}
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">מתאריך</span>
            <input type="date" value={fromStr} max={toStr || undefined} onChange={(e) => setFromStr(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">עד תאריך</span>
            <input type="date" value={toStr} min={fromStr || undefined} onChange={(e) => setToStr(e.target.value)} className={inputCls} />
          </label>
          {!personal && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-500">אחראי/ת</span>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={clsx(inputCls, 'bg-white')}>
                <option value="">כל האחראים</option>
                <optgroup label="מטפלים">
                  {therapists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
                {office.length > 0 && (
                  <optgroup label="מזכירות והנהלה">
                    {office.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-xs font-medium text-slate-500 [&>th]:border-b [&>th]:border-slate-200">
                <SortHeader label="שם המשימה וסוג" col="title" sort={sort} onSort={toggleSort} className="pr-5" />
                <PlainHeader label="מטופל/ת" />
                <SortHeader label="תאריך ושעת השלמה" col="completed_at" sort={sort} onSort={toggleSort} />
                <PlainHeader label="בוצע על ידי" />
                <th className="px-3 py-2.5 pl-5 text-left font-medium w-px whitespace-nowrap">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <SkeletonRows cols={colCount} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-12">
                    <Empty icon={ListChecks} title="לא נמצאו משימות בארכיון" hint="נסו לשנות את מסנני החיפוש" />
                  </td>
                </tr>
              ) : (
                <>
                  {items.map((t) => {
                    const assignee = t.assigneeId ? assigneeById[t.assigneeId] : null
                    const patient = t.patientId ? patientById[t.patientId] : null
                    const done = t.completedAt ?? t.due
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2.5 pr-5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-slate-800 truncate">{t.title}</span>
                            {t.source === 'אוטומציה' ? (
                              <Badge tone="purple" className="shrink-0"><Zap size={11} /> אוטומציה</Badge>
                            ) : (
                              <Badge tone="slate" className="shrink-0"><User size={11} /> ידני</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                          {patient ? patient.name : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-500 whitespace-nowrap">
                          {done ? `${friendlyDate(done)} · ${hhmm(done)}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {assignee ? (
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                              <Avatar initials={assignee.initials} color={assignee.color} size={22} />
                              {assignee.name}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 pl-5 text-left whitespace-nowrap">
                          <Button variant="soft" size="sm" onClick={() => handleRestore(t)}>
                            <Undo2 size={14} /> החזר לאקטיבי
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {loadingMore && <SkeletonRows cols={colCount} count={2} />}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer — pager */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50/60 shrink-0">
            <span className="text-xs text-slate-500">{items.length} משימות בתצוגה</span>
            {hasMore ? (
              <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? 'טוען…' : 'טען עוד'}
              </Button>
            ) : (
              <span className="text-xs text-slate-400">אלו כל המשימות בטווח</span>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// A non-sortable column header cell.
function PlainHeader({ label }) {
  return <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{label}</th>
}

// A sortable column header: clickable, shows the active sort direction with an arrow.
function SortHeader({ label, col, sort, onSort, className = '' }) {
  const active = sort.key === col
  const Arrow = sort.asc ? ChevronUp : ChevronDown
  return (
    <th className={clsx('px-3 py-2.5 text-right font-medium whitespace-nowrap', className)} aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={clsx('inline-flex items-center gap-1 rounded transition hover:text-slate-800', active ? 'text-teal-700' : 'text-slate-500')}
      >
        {label}
        <Arrow size={14} className={clsx('transition', active ? 'opacity-100' : 'opacity-30')} />
      </button>
    </th>
  )
}

// Skeleton placeholder rows shown while a page is loading, so the table never flashes empty.
function SkeletonRows({ cols, count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse" aria-hidden="true">
          <td className="px-3 py-2.5 pr-5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-44 rounded bg-slate-200" />
              <div className="h-5 w-16 rounded-full bg-slate-100" />
            </div>
          </td>
          <td className="px-3 py-2.5"><div className="h-4 w-24 rounded bg-slate-100" /></td>
          <td className="px-3 py-2.5"><div className="h-4 w-32 rounded bg-slate-100" /></td>
          <td className="px-3 py-2.5"><div className="h-6 w-28 rounded-full bg-slate-100" /></td>
          <td className="px-3 py-2.5 pl-5"><div className="h-8 w-28 rounded-xl bg-slate-100 ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}
