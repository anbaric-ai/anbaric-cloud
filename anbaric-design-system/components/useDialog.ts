import { useEffect, type RefObject } from 'react'

/**
 * Drives a native <dialog> as a modal from React state: opens/closes it to
 * match `open`, and routes Escape (the dialog's `cancel` event) through
 * `onClose` so React stays the source of truth.
 */
export function useDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [ref, open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [ref, onClose])
}
