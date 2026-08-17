import type { LoadedUiPlugin, PluginPageDescriptor, RenderableWidget } from './loadPlugins'

class PluginRegistry {
  constructor(private plugins: LoadedUiPlugin[]) {}

  get pages(): PluginPageDescriptor[] {
    return this.plugins
      .flatMap((plugin) => plugin.pages)
      .sort(
        (left, right) =>
          (left.navOrder ?? 100) - (right.navOrder ?? 100) || left.title.localeCompare(right.title),
      )
  }

  pageAt(path: string): PluginPageDescriptor | undefined {
    return this.pages.find((page) => page.path === path)
  }

  widgetsFor(path: string): RenderableWidget[] {
    return this.plugins
      .flatMap((plugin) => plugin.widgets)
      .filter((widget) => widget.page === path)
      .sort((left, right) => (left.position ?? 100) - (right.position ?? 100))
  }
}

let current = new PluginRegistry([])

export function setRegistry(registry: PluginRegistry) {
  current = registry
}

export function registry(): PluginRegistry {
  return current
}

export { PluginRegistry }
