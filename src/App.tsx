import { Compass } from 'lucide-react';
import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui';
import { Activity } from './pages/Activity';
import { Automations } from './pages/Automations';
import { Climate } from './pages/Climate';
import { Doorbell } from './pages/Doorbell';
import { Lighting } from './pages/Lighting';
import { Notifications } from './pages/Notifications';
import { Overview } from './pages/Overview';
import { RoomDetail, Rooms } from './pages/Rooms';
import { Scenes } from './pages/Scenes';
import { Security } from './pages/Security';
import { SettingsPage } from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="rooms/:roomId" element={<RoomDetail />} />
        <Route path="scenes" element={<Scenes />} />
        <Route path="lighting" element={<Lighting />} />
        <Route path="climate" element={<Climate />} />
        <Route path="security" element={<Security />} />
        <Route path="doorbell" element={<Doorbell />} />
        <Route path="automations" element={<Automations />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="*"
          element={
            <EmptyState icon={<Compass size={28} />} title="Page not found">
              <Link to="/">Back to the overview</Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
