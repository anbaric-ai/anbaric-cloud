import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'

import * as Accordion from '@anbaric/design-system/components/Accordion'
import * as Alert from '@anbaric/design-system/components/Alert'
import * as Annotation from '@anbaric/design-system/components/Annotation'
import * as Badge from '@anbaric/design-system/components/Badge'
import * as Button from '@anbaric/design-system/components/Button'
import * as Card from '@anbaric/design-system/components/Card'
import * as ColumnChart from '@anbaric/design-system/components/ColumnChart'
import * as Drawer from '@anbaric/design-system/components/Drawer'
import * as EmptyState from '@anbaric/design-system/components/EmptyState'
import * as Field from '@anbaric/design-system/components/Field'
import * as Form from '@anbaric/design-system/components/Form'
import * as LoadingBar from '@anbaric/design-system/components/LoadingBar'
import * as Modal from '@anbaric/design-system/components/Modal'
import * as OptionsMenu from '@anbaric/design-system/components/OptionsMenu'
import * as RadioGroup from '@anbaric/design-system/components/RadioGroup'
import * as Section from '@anbaric/design-system/components/Section'
import * as SideNav from '@anbaric/design-system/components/SideNav'
import * as Skeleton from '@anbaric/design-system/components/Skeleton'
import * as Slider from '@anbaric/design-system/components/Slider'
import * as SplitButton from '@anbaric/design-system/components/SplitButton'
import * as StackedAreaChart from '@anbaric/design-system/components/StackedAreaChart'
import * as Steps from '@anbaric/design-system/components/Steps'
import * as Table from '@anbaric/design-system/components/Table'
import * as Tabs from '@anbaric/design-system/components/Tabs'
import * as Toggle from '@anbaric/design-system/components/Toggle'
import * as Tooltip from '@anbaric/design-system/components/Tooltip'
import * as useMediaQuery from '@anbaric/design-system/components/useMediaQuery'
import anbaricLogo from '@anbaric/design-system/shared/assets/anbaric-logo.svg'

/**
 * The host runtime handed to server-compiled plugin bundles: their react,
 * react-dom and design-system imports resolve to these exact instances, so
 * plugin components render with the dashboard's React and styling. Chart
 * components built on recharts (Graph, ConcentrationCurve, ExposureBars) are
 * deliberately left out to keep the dashboard bundle free of it; ColumnChart
 * (plain CSS) and StackedAreaChart (plain SVG) are in.
 */
const DesignSystem = {
  ...Accordion,
  ...Alert,
  ...Annotation,
  ...Badge,
  ...Button,
  ...Card,
  ...ColumnChart,
  ...Drawer,
  ...EmptyState,
  ...Field,
  ...Form,
  ...LoadingBar,
  ...Modal,
  ...OptionsMenu,
  ...RadioGroup,
  ...Section,
  ...SideNav,
  ...Skeleton,
  ...Slider,
  ...SplitButton,
  ...StackedAreaChart,
  ...Steps,
  ...Table,
  ...Tabs,
  ...Toggle,
  ...Tooltip,
  ...useMediaQuery,
}

declare global {
  interface Window {
    AnbaricPluginRuntime: {
      React: typeof React
      ReactDOM: typeof ReactDOM & typeof ReactDOMClient
      jsxRuntime: typeof jsxRuntime
      DesignSystem: typeof DesignSystem
      assets: Record<string, string>
    }
  }
}

window.AnbaricPluginRuntime = {
  React,
  ReactDOM: { ...ReactDOM, ...ReactDOMClient },
  jsxRuntime,
  DesignSystem,
  // The design system's brand assets, by file name, for a plugin that shows the logo.
  assets: { 'anbaric-logo.svg': anbaricLogo },
}
