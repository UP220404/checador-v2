import { useState } from 'react';
import Sidebar from './Sidebar';
import { motion } from 'framer-motion';
import '../styles/AdminLayout.css';

function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      {/* Encabezado móvil - Solo visible en pantallas < 768px */}
      <div className="mobile-top-bar d-md-none">
        <button className="menu-toggle-btn" onClick={() => setIsSidebarOpen(true)}>
          <i className="bi bi-list"></i>
        </button>
        <span className="mobile-brand">
          <i className="bi bi-shield-lock-fill me-2"></i>
          CH Admin
        </span>
      </div>

      <div className="d-flex admin-wrapper">
        <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />
        
        {/* Overlay para cerrar sidebar al tocar fuera en móvil */}
        {isSidebarOpen && (
          <div className="sidebar-overlay d-md-none" onClick={() => setIsSidebarOpen(false)}></div>
        )}

        <motion.div 
          className="content"
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export default AdminLayout;
