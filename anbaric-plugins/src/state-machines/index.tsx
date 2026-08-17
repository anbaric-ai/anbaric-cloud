import type { Plugin } from 'anbaric-cloud-hosting'

import { StateMachinesWidget } from './StateMachinesWidget'

const plugin: Plugin = {
  name: 'state-machines',
  pages: [{ path: '/', title: 'Dashboard', icon: 'dashboard', navOrder: 0 }],
  widgets: [{ page: '/', id: 'state-machines', component: StateMachinesWidget }],
}

export { plugin }
