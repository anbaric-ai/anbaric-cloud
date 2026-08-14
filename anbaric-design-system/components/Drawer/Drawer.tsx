import './Drawer.css'
import { useRef, type MouseEvent, type ReactNode } from 'react'
import { Card } from '../Card'
import { useDialog } from '../useDialog'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Panel width. Defaults to 28rem. */
  width?: string
  className?: string
}

/**
 * Drawer — a large Card that slides in from the right over a fully transparent
 * (but still modal) curtain. Built on the native <dialog>, so it traps focus
 * and closes on Escape; clicking the transparent curtain also closes it.
 */
export function Drawer({ open, onClose, children, width, className }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useDialog(ref, open, onClose)

  const onCurtainClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      className="ds-drawer"
      onClick={onCurtainClick}
      style={width ? { width } : undefined}
    >
      <Card className={['ds-drawer__panel', className].filter(Boolean).join(' ')}>
        <button
          type="button"
          className="ds-drawer__close"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            close
          </span>
        </button>
        {children}
      </Card>
    </dialog>
  )
}
