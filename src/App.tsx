import { useState } from 'react';
import { AppProvider } from '@/lib/store';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { UploadPage } from '@/pages/UploadPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AnomalyPage } from '@/pages/AnomalyPage';
import { InvestigatorPage } from '@/pages/InvestigatorPage';
import { ExportsPage } from '@/pages/ExportsPage';
import { AboutPage } from '@/pages/AboutPage';
import type { PageId } from '@/lib/types';

function App() {
  const [page, setPage] = useState<PageId>('dashboard');

  return (
    <AppProvider>
      <Layout currentPage={page} onNavigate={setPage}>
        {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
        {page === 'upload' && <UploadPage onNavigate={setPage} />}
        {page === 'pipeline' && <PipelinePage onNavigate={setPage} />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'anomaly' && <AnomalyPage />}
        {page === 'investigator' && <InvestigatorPage />}
        {page === 'exports' && <ExportsPage />}
        {page === 'about' && <AboutPage />}
      </Layout>
    </AppProvider>
  );
}

export default App;
