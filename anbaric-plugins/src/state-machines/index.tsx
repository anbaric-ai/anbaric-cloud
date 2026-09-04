import type { Plugin } from 'anbaric-cloud-hosting'

import { RecentJobsWidget } from './RecentJobsWidget'
import { StateMachinesWidget } from './StateMachinesWidget'

const plugin: Plugin = {
  name: 'state-machines',
  pages: [{ path: '/', title: 'Dashboard', icon: 'dashboard', navOrder: 0 }],
  widgets: [
    { page: '/', id: 'recent-jobs', component: RecentJobsWidget },
    { page: '/', id: 'state-machines', component: StateMachinesWidget },
  ],
}

export { plugin }
