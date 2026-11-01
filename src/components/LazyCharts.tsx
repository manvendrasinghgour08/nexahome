import { lazy, Suspense, type ComponentProps } from 'react';
import { Loading } from './ui';

// The chart library is large, so it is only downloaded when someone opens a chart.
const ClimateChartImpl = lazy(() => import('./Charts').then((m) => ({ default: m.ClimateChart })));
const ActivityChartImpl = lazy(() => import('./Charts').then((m) => ({ default: m.ActivityChart })));

export function ClimateChart(props: ComponentProps<typeof ClimateChartImpl>) {
  return (
    <Suspense fallback={<Loading label="Loading chart…" height={props.height} />}>
      <ClimateChartImpl {...props} />
    </Suspense>
  );
}

export function ActivityChart(props: ComponentProps<typeof ActivityChartImpl>) {
  return (
    <Suspense fallback={<Loading label="Loading chart…" height={props.height} />}>
      <ActivityChartImpl {...props} />
    </Suspense>
  );
}
