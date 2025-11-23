import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import PromoBanner from './components/PromoBanner';
import Home from './pages/Home';
import Checkout from './pages/Checkout';
import Identification from './pages/Identification';
import ProductDetails from './pages/ProductDetails';
import { useSearch } from './contexts/SearchContext';

// Páginas Admin
import AdminLogin from './pages/admin/Login';
import AdminRegister from './pages/admin/Register';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminSections from './pages/admin/Sections';
import AdminCustomization from './pages/admin/Customization';
import AdminSettings from './pages/admin/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

import './App.css';

// Componente para redirecionar /admin baseado no estado de autenticação
function AdminRedirect() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Aguardar um pouco para verificar autenticação
    if (!loading) {
      if (user) {
        // Usar window.location.href para forçar reload completo
        window.location.href = '/admin/dashboard';
      } else {
        // Usar window.location.href para forçar reload completo
        window.location.href = '/admin/login';
      }
    }
  }, [user, loading]);

  // Mostrar loading enquanto redireciona
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px',
      color: '#666',
    }}>
      Carregando...
    </div>
  );
}

function App() {
  const headerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { isSearchOpen } = useSearch();
  // Detectar rotas com ou sem slug da loja
  const isCheckoutPage = location.pathname.includes('/checkout') && !location.pathname.includes('/checkout/identification') && !location.pathname.includes('/sacola/identification') || location.pathname.includes('/sacola') && !location.pathname.includes('/sacola/identification') || location.pathname === '/cart';
  const isIdentificationPage = location.pathname.includes('/checkout/identification') || location.pathname.includes('/sacola/identification');
  const isProductDetailsPage = location.pathname.includes('/produto/') || location.pathname.includes('/product/');
  const isAdminPage = location.pathname.startsWith('/admin');

  // Manter flag de navegação ativa durante navegações internas
  // NOTA: NÃO criar a flag automaticamente baseado em posição salva,
  // pois pode ser uma posição antiga de sessão anterior.
  // A flag deve ser criada apenas durante navegações internas (no Home.tsx)
  useEffect(() => {
    // Se já existe uma flag de navegação ativa, manter ativa
    if (sessionStorage.getItem('navigationActive')) {
      // Flag já existe, garantir que continue ativa
      sessionStorage.setItem('navigationActive', 'true');
    }
    // Se não há flag, não fazer nada - deixar o Home.tsx gerenciar
    // (Home.tsx vai criar a flag após a primeira carga ser processada)
  }, [location.pathname]);

  useEffect(() => {
    // Não atualizar padding em páginas especiais
    if (isCheckoutPage || isProductDetailsPage || isAdminPage) {
      return;
    }

    const updatePadding = () => {
      if (headerRef.current) {
        const mainContent = document.querySelector('.main-content, .cart-content') as HTMLElement;
        if (mainContent) {
          // Verificar se estamos em resolução de desktop (>= 768px)
          const isDesktop = window.innerWidth >= 768;
          
          if (isDesktop) {
            // Em desktop, o header não é fixo, então não precisa de padding extra
            mainContent.style.paddingTop = '';
          } else {
            // Em mobile, o header é fixo, então precisa de padding
            const headerHeight = headerRef.current.offsetHeight;
          const paddingTop = isSearchOpen ? `${headerHeight + 10}px` : `${headerHeight + 30}px`;
          mainContent.style.paddingTop = paddingTop;
          }
        }
      }
    };

    // Executar imediatamente
    updatePadding();

    // Usar múltiplos métodos para garantir que seja aplicado
    requestAnimationFrame(updatePadding);
    setTimeout(updatePadding, 0);
    setTimeout(updatePadding, 50);
    setTimeout(updatePadding, 100);
    setTimeout(updatePadding, 200);

    window.addEventListener('resize', updatePadding);
    
    // Aguardar o carregamento da imagem da logo
    const logoImage = document.querySelector('.logo-image') as HTMLImageElement;
    if (logoImage) {
      if (logoImage.complete) {
        updatePadding();
      } else {
        logoImage.addEventListener('load', updatePadding);
      }
    }

    return () => {
      window.removeEventListener('resize', updatePadding);
      if (logoImage) {
        logoImage.removeEventListener('load', updatePadding);
      }
    };
  }, [isSearchOpen, location, isCheckoutPage]);

  return (
    <div className="app">
      {/* RÓTULO: Header com ícones e logo + Banner promocional */}
      {!isCheckoutPage && !isIdentificationPage && !isProductDetailsPage && !isAdminPage && (
        <div className="fixed-header" ref={headerRef}>
          <Header />
          {!isSearchOpen && <PromoBanner />}
        </div>
      )}
      
      {/* Rotas */}
      <Routes>
        {/* Rotas Públicas (Loja) - com slug da loja no path */}
        <Route path="/" element={<Home />} />
        <Route path="/:storeSlug" element={<Home />} />
        <Route path="/:storeSlug/sacola" element={<Checkout />} />
        <Route path="/:storeSlug/sacola/identification" element={<Identification />} />
        <Route path="/:storeSlug/produto/:productId" element={<ProductDetails />} />
        <Route path="/:storeSlug/checkout/identification" element={<Identification />} />
        <Route path="/:storeSlug/checkout/:productId?" element={<Checkout />} />
        
        {/* Rotas antigas (para compatibilidade) */}
        <Route path="/product/:productId" element={<ProductDetails />} />
        <Route path="/checkout/identification" element={<Identification />} />
        <Route path="/checkout/:productId?" element={<Checkout />} />
        <Route path="/cart" element={<Checkout />} />
        
        {/* Rotas Admin (Protegidas) */}
        <Route 
          path="/admin" 
          element={<AdminRedirect />} 
        />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/produtos"
          element={
            <ProtectedRoute>
              <AdminProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/secoes"
          element={
            <ProtectedRoute>
              <AdminSections />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/personalizacao"
          element={
            <ProtectedRoute>
              <AdminCustomization />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/configuracoes"
          element={
            <ProtectedRoute>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
