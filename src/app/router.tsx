import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { TransactionsScreen } from '../features/transactions/TransactionsScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { InsightsScreen } from '../features/insights/InsightsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { CategoriesManager } from '../features/settings/CategoriesManager';
import { TemplatesManager } from '../features/templates/TemplatesManager';

// Hosted under a sub-path on GitHub Pages; Vite injects the base here.
const basename =
  import.meta.env.BASE_URL === '/'
    ? undefined
    : import.meta.env.BASE_URL.replace(/\/$/, '');

// Tab routes per §10.
export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/', element: <DashboardScreen /> },
        { path: '/islemler', element: <TransactionsScreen /> },
        { path: '/butce', element: <BudgetsScreen /> },
        { path: '/icgoru', element: <InsightsScreen /> },
        { path: '/ayarlar', element: <SettingsScreen /> },
        { path: '/ayarlar/kategoriler', element: <CategoriesManager /> },
        { path: '/ayarlar/kisayollar', element: <TemplatesManager /> },
      ],
    },
  ],
  { basename },
);
