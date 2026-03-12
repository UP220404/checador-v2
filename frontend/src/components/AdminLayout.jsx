import Sidebar from './Sidebar';
import { motion } from 'framer-motion';
import '../styles/AdminLayout.css';

function AdminLayout({ children }) {
  return (
    <div className="d-flex admin-layout">
      <Sidebar />
      <motion.div 
        className="content"
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export default AdminLayout;
