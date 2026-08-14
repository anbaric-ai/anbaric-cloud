import './Form.css'
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

interface FieldState {
  touched: boolean
  valid: boolean
  filled: boolean
  message: string
}

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children?: ReactNode
  /** Force the whole-form green "complete" styling (e.g. after a save). */
  success?: boolean
}

const CONTROL_TAGS = new Set(['input', 'select', 'textarea'])

const readField = (el: Control, touched: boolean): FieldState => ({
  touched,
  valid: el.checkValidity(),
  filled: el.value.trim() !== '',
  message: el.validationMessage,
})

/**
 * Form — wraps plain HTML inputs and buttons and governs their look and
 * behaviour:
 *
 * • Styles every contained input/button (see Form.css).
 * • Runs native constraint validation; while any field is invalid, every
 *   submit button inside the form is disabled.
 * • A field turns green the moment it becomes valid (and non-empty) — live, as
 *   you type, not on submit.
 * • An invalid field shows a warning beneath it once blurred (or on submit),
 *   from its `data-warning` attribute (falling back to the browser's message).
 */
export function Form({
  className,
  children,
  onSubmit,
  success = false,
  ...rest
}: FormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [fields, setFields] = useState<Record<number, FieldState>>({})
  const [valid, setValid] = useState(true)

  const refreshValidity = useCallback(() => {
    setValid(formRef.current?.checkValidity() ?? true)
  }, [])

  // Reflect validity on first paint (and whenever the children change) so
  // submit buttons start disabled if the form opens invalid.
  useEffect(() => {
    refreshValidity()
  }, [refreshValidity, children])

  const updateField = useCallback(
    (index: number, el: Control, touch: boolean) => {
      setFields((prev) => ({
        ...prev,
        [index]: readField(el, touch || Boolean(prev[index]?.touched)),
      }))
      refreshValidity()
    },
    [refreshValidity],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = formRef.current
    if (form && !form.checkValidity()) {
      event.preventDefault()
      // Surface every invalid field's warning at once.
      const next: Record<number, FieldState> = {}
      form
        .querySelectorAll<Control>('input, select, textarea')
        .forEach((el, i) => {
          next[i] = readField(el, true)
        })
      setFields(next)
      setValid(false)
      return
    }
    onSubmit?.(event)
  }

  // Walk the children, styling/validating controls and disabling submit
  // buttons. Indices follow document order, matching querySelectorAll above.
  let controlIndex = 0
  const transform = (node: ReactNode): ReactNode => {
    if (!isValidElement(node)) return node
    const element = node as ReactElement<Record<string, any>>
    const { type, props } = element

    if (typeof type === 'string' && CONTROL_TAGS.has(type)) {
      const index = controlIndex++
      const state = fields[index]
      const isValid = Boolean(state?.valid && state?.filled)
      const showError = Boolean(state?.touched && state && !state.valid)
      const warning =
        (props['data-warning'] as string | undefined) ?? state?.message

      const control = cloneElement(element, {
        'aria-invalid': showError || undefined,
        className: [
          'ds-form__control',
          props.className,
          isValid && 'ds-form__control--valid',
          showError && 'ds-form__control--invalid',
        ]
          .filter(Boolean)
          .join(' '),
        onBlur: (event: any) => {
          updateField(index, event.currentTarget as Control, true)
          props.onBlur?.(event)
        },
        onInput: (event: any) => {
          updateField(index, event.currentTarget as Control, false)
          props.onInput?.(event)
        },
      })

      return (
        <Fragment key={index}>
          {control}
          {showError && warning ? (
            <small className="ds-form__warning">{warning}</small>
          ) : null}
        </Fragment>
      )
    }

    if (type === 'button') {
      const buttonType = props.type as string | undefined
      const isSubmit = buttonType === undefined || buttonType === 'submit'
      return isSubmit
        ? cloneElement(element, { disabled: props.disabled || !valid })
        : node
    }

    if (props.children) {
      return cloneElement(element, {
        children: Children.map(props.children, transform),
      })
    }
    return node
  }

  return (
    <form
      ref={formRef}
      noValidate
      className={['ds-form', success && 'ds-form--complete', className]
        .filter(Boolean)
        .join(' ')}
      onSubmit={handleSubmit}
      {...rest}
    >
      {Children.map(children, transform)}
    </form>
  )
}
