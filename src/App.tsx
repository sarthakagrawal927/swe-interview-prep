import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { CategoryProvider } from './contexts/CategoryContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Patterns from './pages/Patterns';
import ProblemView from './pages/ProblemView';
import AnkiReview from './pages/AnkiReview';
import ImportProblem from './pages/ImportProblem';
import Library from './pages/Library';
import RepoView from './pages/RepoView';
import Playground from './pages/Playground';
import Login from './pages/Login';
import VibeLearning from './pages/VibeLearning';

function CategoryRoutes() {
  return (
    <CategoryProvider>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="patterns" element={<Patterns />} />
        <Route path="problem/:id" element={<ProblemView />} />
        <Route path="review" element={<AnkiReview />} />
        <Route path="import" element={<ImportProblem />} />
      </Routes>
    </CategoryProvider>
  );
}

function App() {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-400" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:repoSlug" element={<RepoView />} />
        <Route path="playground" element={<Playground />} />
        <Route path="vibe-learning" element={<VibeLearning />} />
        <Route path=":category/*" element={<CategoryRoutes />} />
        {/* Legacy routes redirect to DSA */}
        <Route path="patterns" element={<Navigate to="/dsa/patterns" replace />} />
        <Route path="problem/:id" element={<Navigate to="/dsa/problem/:id" replace />} />
        <Route path="anki" element={<Navigate to="/dsa/review" replace />} />
        <Route path="import" element={<Navigate to="/dsa/import" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
