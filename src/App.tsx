import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import MainDashboard from './pages/dashboards/MainDashboard';
import TripsDashboard from './pages/dashboards/TripsDashboard';
import ExpensesDashboard from './pages/dashboards/ExpensesDashboard';
import CommissionsDashboard from './pages/dashboards/CommissionsDashboard';
import Motoristas from './pages/Motoristas';
import ControleCargas from './pages/ControleCargas';
import Comissoes from './pages/Comissoes';
import Despesas from './pages/Despesas';
import Conciliacao from './pages/Conciliacao';
import Perfil from './pages/Perfil';
import Login from './pages/Login';
import PrestacaoContas from './pages/PrestacaoContas';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<MainDashboard />} />
              <Route path="dashboards/viagens" element={<TripsDashboard />} />
              <Route path="dashboards/despesas" element={<ExpensesDashboard />} />
              <Route path="dashboards/comissoes" element={<CommissionsDashboard />} />
              <Route path="motoristas" element={<Motoristas />} />
              <Route path="cargas" element={<ControleCargas />} />
              <Route path="comissoes" element={<Comissoes />} />
              <Route path="despesas" element={<Despesas />} />
              <Route path="conciliacao" element={<Conciliacao />} />
              <Route path="perfil" element={<Perfil />} />
            </Route>
            <Route path="prestacao-contas" element={<PrestacaoContas />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
