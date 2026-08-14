import './Modal.css'
import { useRef, type MouseEvent, type ReactNode } from 'react'
import { useDialog } from '../useDialog'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Footer content, typically actions. */
  footer?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Modal — a blocking dialog at elevation 4, on the native <dialog> element:
 * top layer, focus trap, Escape and a dimmed backdrop come for free. Closes on
 * Escape, backdrop click, or the close button.
 */
export function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useDialog(ref, open, onClose)

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={['ds-modal', className].filter(Boolean).join(' ')}
      onClick={onBackdropClick}
    >
      <div className="ds-modal__panel">
        {title ? (
          <div className="ds-modal__head">
            <h2 className="ds-modal__title">{title}</h2>
            <button
              type="button"
              className="ds-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        ) : null}
        <div className="ds-modal__body">{children}</div>
        {footer ? <div className="ds-modal__footer">{footer}</div> : null}
      </div>
    </dialog>
  )
}
