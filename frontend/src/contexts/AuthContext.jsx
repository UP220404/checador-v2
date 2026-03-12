/**
 * AuthContext — Fuente de verdad del rol del usuario.
 *
 * El rol se obtiene SIEMPRE del backend (GET /users/me/role) cada vez que
 * Firebase detecta una sesión activa. NUNCA se lee de sessionStorage.
 * Esto evita que alguien cambie su rol desde la consola del navegador (F12).
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../services/api';

const AuthContext = createContext(null);

const ROLES = {
  EMPLEADO: 'empleado',
  ADMIN_AREA: 'admin_area',
  ADMIN_RH: 'admin_rh'
};

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos entre refetches

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [userDepartamento, setUserDepartamento] = useState('');
  // true mientras verifica la sesión con el backend (evita flash de login)
  const [loading, setLoading] = useState(true);
  // Timestamp del último fetch exitoso (para cooldown en refreshUser)
  const lastFetchRef = useRef(null);

  const fetchUserData = useCallback(async (firebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken();
      sessionStorage.setItem('authToken', token);

      const response = await api.getCurrentUserRole();

      if (response.data?.success) {
        const roleData = response.data.data;
        setUser(firebaseUser);
        setUserRole(roleData.role || ROLES.EMPLEADO);
        setUserName(roleData.nombre || '');
        setUserDepartamento(roleData.departamento || '');

        sessionStorage.setItem('userEmail', firebaseUser.email || '');
        sessionStorage.setItem('userName', roleData.nombre || '');
        sessionStorage.setItem('userDepartamento', roleData.departamento || '');
        lastFetchRef.current = Date.now();
      } else {
        setUser(firebaseUser);
        setUserRole(ROLES.EMPLEADO);
        setUserName('');
        setUserDepartamento('');
      }
    } catch (error) {
      console.error('[AuthContext] Error al obtener rol:', error);
      setUser(firebaseUser);
      setUserRole(ROLES.EMPLEADO);
    }
  }, []);

  // Refresca datos del usuario — con cooldown de 5 min para no saturar el backend
  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (lastFetchRef.current && Date.now() - lastFetchRef.current < REFRESH_COOLDOWN_MS) return;
    await fetchUserData(currentUser);
  }, [fetchUserData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
        setUserName('');
        setUserDepartamento('');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userEmail');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('userDepartamento');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]);

  return (
    <AuthContext.Provider value={{ user, userRole, userName, userDepartamento, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}

export { ROLES };
