import { PawPrint } from 'lucide-react';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { initData, useData } from './data/store';
import { Billing } from './pages/Billing';
import { Book } from './pages/Book';
import { ClientDetail } from './pages/ClientDetail';
import { Clients } from './pages/Clients';
import { Dashboard } from './pages/Dashboard';
import { DoctorDay } from './pages/DoctorDay';
import { DriverRun } from './pages/DriverRun';
import { Messages } from './pages/Messages';
import { NotFound } from './pages/NotFound';
import { Reports } from './pages/Reports';
import { RoutesPage } from './pages/Routes';
import { Schedule } from './pages/Schedule';
import { Settings } from './pages/Settings';

export function App() {
  const ready = useData((s) => s.ready);
  useEffect(() => {
    void initData();
  }, []);

  if (!ready)
    return (
      <div className="grid h-full place-items-center">
        <div className="flex items-center gap-3 text-slate-500">
          <PawPrint className="size-6 animate-pulse text-brand-700" /> Loading VetSet Manager…
        </div>
      </div>
    );

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="book" element={<Book />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="billing" element={<Billing />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="doctor" element={<DoctorDay />} />
          <Route path="driver" element={<DriverRun />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
