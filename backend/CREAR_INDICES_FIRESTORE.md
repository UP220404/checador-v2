# 🔥 Crear Índices de Firestore - URGENTE

## ⚠️ El backend está fallando porque Firestore necesita índices compuestos

**Abre estos links en tu navegador y haz clic en "Crear índice":**

### Índice 1: Asistencias del día (fecha + timestamp)
```
https://console.firebase.google.com/v1/r/project/qr-acceso-cielito-home/firestore/indexes?create_composite=Clhwcm9qZWN0cy9xci1hY2Nlc28tY2llbGl0by1ob21lL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9yZWdpc3Ryb3MvaW5kZXhlcy9fEAEaCQoFZmVjaGEQARoNCgl0aW1lc3RhbXAQAhoMCghfX25hbWVfXxAC
```

### Índice 2: Asistencias semanales (uid + fecha + timestamp)
```
https://console.firebase.google.com/v1/r/project/qr-acceso-cielito-home/firestore/indexes?create_composite=Clhwcm9qZWN0cy9xci1hY2Nlc28tY2llbGl0by1ob21lL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9yZWdpc3Ryb3MvaW5kZXhlcy9fEAEaBwoDdWlkEAEaCQoFZmVjaGEQARoNCgl0aW1lc3RhbXAQARoMCghfX25hbWVfXxAB
```

## 📝 Pasos:

1. **Abre cada URL** (te llevará a Firebase Console)
2. **Haz clic en "Create Index"** o "Crear índice"
3. **Espera 2-5 minutos** (Firebase construye los índices)
4. **Recarga la página del frontend** una vez que los índices estén listos

## ✅ Cómo saber si están listos:

Ve a Firebase Console → Firestore → Indexes (Índices)

Verás los índices con estado:
- 🟡 **Building** (construyendo) - Espera
- 🟢 **Enabled** (habilitado) - ¡Listo!

---

**IMPORTANTE:** Sin estos índices, el backend NO puede hacer queries complejas y seguirá dando errores 500.
