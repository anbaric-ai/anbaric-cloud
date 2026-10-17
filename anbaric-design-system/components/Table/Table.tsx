import './Table.css'
import type { ReactNode } from 'react'
import { useMediaQuery } from '../useMediaQuery'

export interface TableColumn<Row> {
  /** Names the column; also the key React needs. */
  id: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  align?: 'left' | 'right'
  /** Sets the column in the mono face: ids, counts, codes. */
  mono?: boolean
  /** Quietens the column: a timestamp, a note. */
  muted?: boolean
  /** A fixed width, as CSS. */
  width?: string
  /** The column that identifies the row. Stacked, it leads the block with no
      label; the others follow, labelled by their header. */
  primary?: boolean
  /** Left out of the stacked form, for what a phone can do without. */
  hideWhenStacked?: boolean
}

export interface TableProps<Row> {
  columns: Array<TableColumn<Row>>
  rows: Row[]
  rowKey: (row: Row) => string
  /** What a row does when clicked, if anything. */
  onRowClick?: (row: Row) => void
  /** Rows the reader may tick; with `onSelect`, the table grows a checkbox column. */
  selectable?: (row: Row) => boolean
  selected?: Set<string>
  onSelect?: (keys: Set<string>) => void
  /** Shown in place of rows when there are none. */
  empty?: ReactNode
  /** The width below which rows stack. Defaults to the navigation's own fold. */
  stackBelow?: string
  /** Names the table to assistive technology. */
  label?: string
  className?: string
}

/**
 * Table — rows on the canvas, parted by hairlines, with mono uppercase
 * headers. Columns say how a cell is set; the table says nothing about
 * what is in it. Below `stackBelow` each row becomes a block led by its
 * primary column, so the same table reads on a phone.
 */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectable,
  selected = new Set<string>(),
  onSelect,
  empty = 'Nothing here yet.',
  stackBelow = '40rem',
  label,
  className,
}: TableProps<Row>) {
  const stacked = useMediaQuery(`(max-width: ${stackBelow})`)
  const selecting = Boolean(onSelect)
  const canSelect = (row: Row) => selecting && (selectable ? selectable(row) : true)
  const selectableKeys = rows.filter(canSelect).map(rowKey)
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key))

  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelect?.(next)
  }
  const toggleAll = () =>
    onSelect?.(allSelected ? new Set([...selected].filter((key) => !selectableKeys.includes(key))) : new Set([...selected, ...selectableKeys]))

  const cellClass = (column: TableColumn<Row>) =>
    ['ds-table__td', column.align === 'right' && 'ds-table__td--right', column.mono && 'ds-table__td--mono', column.muted && 'ds-table__td--muted']
      .filter(Boolean)
      .join(' ')

  const selectBox = (row: Row) =>
    canSelect(row) ? (
      <input
        type="checkbox"
        checked={selected.has(rowKey(row))}
        onChange={() => toggle(rowKey(row))}
        onClick={(event) => event.stopPropagation()}
        aria-label="Select row"
      />
    ) : null

  if (rows.length === 0) {
    return <div className={['ds-table__empty', className].filter(Boolean).join(' ')}>{empty}</div>
  }

  if (stacked) {
    const primary = columns.find((column) => column.primary) ?? columns[0]
    const rest = columns.filter((column) => column !== primary && !column.hideWhenStacked)
    return (
      <div className={['ds-table-stack', className].filter(Boolean).join(' ')} role="table" aria-label={label}>
        {selecting && selectableKeys.length > 0 ? (
          <label className="ds-table-stack__all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} /> Select all
          </label>
        ) : null}
        {rows.map((row) => {
          const key = rowKey(row)
          return (
            <div
              key={key}
              role="row"
              className={['ds-table-stack__row', selected.has(key) && 'ds-table-stack__row--selected'].filter(Boolean).join(' ')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="ds-table-stack__lead">
                {selecting ? selectBox(row) : null}
                <div>{primary.cell(row)}</div>
              </div>
              {rest.map((column) => (
                <div key={column.id} className="ds-table-stack__cell">
                  <span className="ds-table-stack__label">{column.header}</span>
                  <span className={column.mono ? 'ds-table__td--mono' : undefined}>{column.cell(row)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={['ds-table-wrap', className].filter(Boolean).join(' ')}>
      <table className="ds-table" aria-label={label}>
        <thead>
          <tr>
            {selecting ? (
              <th className="ds-table__th ds-table__select">
                <input type="checkbox" checked={allSelected} disabled={selectableKeys.length === 0} onChange={toggleAll} aria-label="Select all" />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.id}
                className={['ds-table__th', column.align === 'right' && 'ds-table__th--right'].filter(Boolean).join(' ')}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            return (
              <tr
                key={key}
                className={[onRowClick && 'ds-table__row--clickable', selected.has(key) && 'ds-table__row--selected'].filter(Boolean).join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selecting ? <td className="ds-table__td ds-table__select">{selectBox(row)}</td> : null}
                {columns.map((column) => (
                  <td key={column.id} className={cellClass(column)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
