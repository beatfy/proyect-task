# 📊 ANÁLISIS TaskX + Plan Integración Email

**Fecha:** 2026-03-30  
**Proyecto:** TaskX (xnote-app)  
**Ubicación:** `/home/ele/.openclaw/workspace/xnote-app`

---

## 🏗️ ARQUITECTURA ACTUAL

### Stack Tecnológico
| Componente | Tecnología |
|------------|------------|
| Framework | Next.js 15.5.14 |
| Database | PostgreSQL + Prisma 6 |
| Auth | Next Auth v5 (beta) |
| UI | Radix UI + TailwindCSS |
| Drag & Drop | @dnd-kit |
| Forms | React Hook Form + Zod |

### Modelos de Datos (Prisma)
- **User** - Usuarios con auth
- **Project** - Proyectos con miembros
- **Task** - Tareas con subtasks, comentarios, attachments
- **Notification** - Sistema de notificaciones interno
- **Invitation** - Invitaciones a proyectos

### Módulos Actuales
| Módulo | Ruta | Función |
|--------|------|---------|
| Dashboard | `/dashboard` | Estadísticas de tareas |
| Proyectos | `/projects` | Gestión de proyectos |
| Tareas | `/tasks` | Kanban/lista de tareas |
| Calendario | `/calendar` | Vista calendario |
| Invitaciones | `/invitations` | Gestión de invitaciones |
| Notificaciones | `/notifications` | Centro de notificaciones |
| Configuración | `/settings` | Settings de usuario |

---

## 🎯 PROPUESTA: Integración Email de Empresa

### Objetivo
Añadir una sección **"Correo"** donde el usuario pueda:
1. Ver su inbox de Gmail/Outlook de empresa
2. Leer emails sin salir de TaskX
3. Asociar emails a tareas (convertir email → tarea)
4. Buscar en historial de emails

---

## 📋 PLAN DE IMPLEMENTACIÓN

### Opción A: Gmail API (Google Workspace)

#### Requisitos
- Google Cloud Console project
- OAuth 2.0 credentials
- Gmail API enabled
- Scope: `https://www.googleapis.com/auth/gmail.readonly`

#### Pasos

**1. Configurar Google OAuth en Next Auth**
```typescript
// app/api/auth/[...nextauth]/route.ts
import Google from "next-auth/providers/google"

Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly"
    }
  }
})
```

**2. Añadir modelo EmailAccount en Prisma**
```prisma
model EmailAccount {
  id           String   @id
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  provider     String   // "gmail" | "outlook"
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
  email        String
  syncedAt     DateTime?
}
```

**3. Crear API endpoints**
- `GET /api/email/messages` - Lista emails
- `GET /api/email/messages/:id` - Detalle de email
- `POST /api/email/sync` - Sincronizar inbox
- `POST /api/email/to-task` - Convertir email a tarea

**4. Crear página `/app/(app)/email/page.tsx`**
```typescript
// Estructura similar al dashboard
// - Lista de folders (Inbox, Sent, Drafts)
// - Lista de messages
// - Vista de detalle
// - Botón "Crear tarea desde email"
```

**5. Añadir navegación**
```typescript
// En layout.tsx navigation array:
{ name: "Correo", href: "/email", icon: Mail },
```

---

### Opción B: Microsoft Graph API (Outlook/Office 365)

#### Requisitos
- Azure AD app registration
- Microsoft Graph API permissions
- Scope: `Mail.Read`

#### Pasos similares con diferente provider:
```typescript
// Next Auth Azure AD provider
import AzureAD from "next-auth/providers/azure-ad"

AzureAD({
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  tenantId: process.env.AZURE_TENANT_ID,
  authorization: {
    params: {
      scope: "openid email profile Mail.Read"
    }
  }
})
```

---

### Opción C: IMAP Generic ( cualquier servidor)

Para servidores de correo propios (no Google/Microsoft):
```typescript
// Usando node-imap o similar
import Imap from "imap"

// Config en .env:
EMAIL_IMAP_HOST=mail.company.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_USER=user@company.com
EMAIL_IMAP_PASSWORD=password
```

---

## 📊 COMPARATIVA DE OPCIONES

| Aspecto | Gmail API | Outlook API | IMAP |
|---------|-----------|-------------|------|
| Facilidad | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| OAuth | Ya en Next Auth | Separado | No |
| Features | Filtrado, labels | folders | Básico |
| Rate limits | 1M requests/day | Variable | Sin límite |
| Mejor para | Google Workspace | Office 365 | Servidores propios |

---

## 🛠️ ROADMAP DE IMPLEMENTACIÓN

### Semana 1: Setup OAuth + Modelo
- [ ] Añadir Gmail/Azure provider en Next Auth
- [ ] Crear modelo EmailAccount en Prisma
- [ ] Migrar database
- [ ] Testear conexión OAuth

### Semana 2: API + Sync
- [ ] Endpoint `/api/email/messages`
- [ ] Endpoint `/api/email/sync`
- [ ] Almacenar messages cache en DB (opcional)
- [ ] Rate limiting + error handling

### Semana 3: UI + Vista
- [ ] Página `/email` con layout
- [ ] Lista de folders
- [ ] Lista de messages (infinite scroll)
- [ ] Vista detalle de email

### Semana 4: Integración con Tasks
- [ ] Botón "Crear tarea desde email"
- [ ] Adjuntar email URL a tarea
- [ ] Buscar emails relacionados
- [ ] UI polish + testing

---

## 💡 MEJORAS ADICIONALES SUGERIDAS

### Para TaskX en general:
1. **Dark mode** - ya tienes next-themes, solo falta toggle en UI
2. **Exportar tareas a CSV/PDF**
3. **Time tracking** - tiempo dedicado a cada tarea
4. **Recurring tasks** - tareas recurrentes (RRULE)
5. **Mobile responsive** - sidebar como drawer en móvil
6. **Keyboard shortcuts** - para usuarios avanzados

### Para Email integration:
1. **Email → Comment** - añadir email como comentario en tarea
2. **Smart parsing** - detectar deadlines en emails
3. **Templates** - guardar emails como templates
4. **Quick reply** - responder desde TaskX (requiere write scope)

---

## 📁 ARCHIVOS A CREAR/MODIFICAR

### Nuevos:
```
app/(app)/email/
├── page.tsx          # Main email view
├── [id]/page.tsx     # Email detail
├── components/
│   ├── EmailList.tsx
│   ├── EmailDetail.tsx
│   ├── FolderList.tsx
│   └── EmailToTaskDialog.tsx

app/api/email/
├── messages/route.ts
├── sync/route.ts
├── to-task/route.ts
```

### Modificar:
```
prisma/schema.prisma       # + EmailAccount + EmailMessage
app/(app)/layout.tsx       # + Email en navigation
app/api/auth/[...nextauth] # + Gmail/Azure scopes
.env                       # + OAuth credentials
```

---

## 🔐 VARIABLES DE ENTORNO NECESARIAS

```env
# Gmail API
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Azure AD (Outlook)
AZURE_CLIENT_ID=xxx
AZURE_CLIENT_SECRET=xxx
AZURE_TENANT_ID=xxx

# IMAP (opcional)
EMAIL_IMAP_HOST=mail.company.com
EMAIL_IMAP_PORT=993
```

---

## ⚠️ CONSIDERACIONES

1. **Rate Limits:** Gmail API tiene límites - usar caching
2. **Security:** Tokens se guardan en DB - encrypt refresh tokens
3. **Privacy:** Solo leer, no modificar sin permiso explícito
4. **Multi-account:** Usuario puede tener varios emails conectados

---

**Próximo paso:** Confirmar qué opción prefieres (Gmail, Outlook, o IMAP) y proceder con setup OAuth.

---

*Análisis generado: 2026-03-30*