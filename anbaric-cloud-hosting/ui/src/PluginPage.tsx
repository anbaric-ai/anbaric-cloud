import type { CSSProperties } from 'react'

import { PageShell } from './PageShell'
import { PlatformNav } from './PlatformNav'
import type { RenderableWidget } from './plugins/loadPlugins'
import { registry } from './plugins/PluginRegistry'

const widgetHeading: CSSProperties = {
  margin: 0,
  marginBottom: 'var(--space-md)',
  fontFamily: 'var(--font-title)',
  fontSize: '1.15rem',
  textTransform: 'var(--title-transform)' as CSSProperties['textTransform'],
}

function dataFetcher(widget: RenderableWidget) {
  return async (parameters: Record<string, string> = {}) => {
    if (!widget.hasData) return null
    const query = new URLSearchParams({ plugin: widget.pluginName, widget: widget.id, ...parameters })
    const response = await fetch(`/plugins/data?${query}`)
    if (!response.ok) {
      throw new Error(`The data function of widget "${widget.id}" failed with status ${response.status}`)
    }
    return response.json()
  }
}

function PluginPage({ path }: { path: string }) {
  const page = registry().pageAt(path)
  const widgets = registry().widgetsFor(path)
  return (
    <PageShell title={page?.title ?? path} width="64rem" nav={<PlatformNav />}>
      {widgets.map((widget) => {
        const Widget = widget.component
        return (
          <section key={`${widget.pluginName} ${widget.id}`}>
            {widget.title ? <h2 style={widgetHeading}>{widget.title}</h2> : null}
            <Widget fetchData={dataFetcher(widget)} />
          </section>
        )
      })}
      {widgets.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--color-foreground-tint-2)' }}>
          No widgets are registered on this page.
        </p>
      ) : null}
    </PageShell>
  )
}

export { PluginPage }
