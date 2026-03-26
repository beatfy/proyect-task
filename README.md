# Xnote 📝

App de notas moderna y elegante. Organiza tus ideas con carpetas, etiquetas y búsqueda potente.

![Xnote](https://xnote.app/og-image.png)

## ✨ Características

- 📝 **Editor Rich-Text** - Editor moderno con Tiptap (formato, listas, código, destacados)
- 📁 **Organización** - Carpetas y etiquetas para mantener todo ordenado
- ⭐ **Favoritos** - Marca tus notas importantes para acceso rápido
- 🔍 **Búsqueda** - Búsqueda full-text en todas tus notas
- 🗑️ **Papelera** - Soft delete con restauración
- 🌙 **Modo Oscuro** - Toggle entre modo claro y oscuro
- 📱 **Responsive** - Mobile-first, funciona perfecto en móvil
- ⌨️ **Atajos** - Productividad para power users

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- PostgreSQL (local o Supabase/Neon)
- Cuenta en [Clerk](https://clerk.com) para autenticación

### Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/beatsfy/xnote.git
cd xnote
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita `.env` con tus valores:
```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

4. **Configurar la base de datos**
```bash
npx prisma generate
npx prisma db push
```

5. **Iniciar el servidor de desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 🗄️ Base de Datos

### Modelos

- **User** - Usuarios (gestionado por Clerk)
- **Note** - Notas con título, contenido, favoritos, archivado
- **Folder** - Carpetas para organizar notas
- **Tag** - Etiquetas para clasificar notas
- **NoteTag** - Relación muchos-a-muchos entre notas y etiquetas

### Migraciones

```bash
# Crear migración
npx prisma migrate dev --name init

# Aplicar migraciones
npx prisma migrate deploy

# Ver datos
npx prisma studio
```

## 🔐 Autenticación

Xnote usa [Clerk](https://clerk.com) para autenticación:

- Email/contraseña
- Google OAuth
- GitHub OAuth
- Verificación de email
- Gestión de sesiones

### Configurar Webhook de Clerk

1. Ve al [Dashboard de Clerk](https://dashboard.clerk.com)
2. Selecciona tu aplicación → Webhooks
3. Añade endpoint: `https://tu-dominio.com/api/webhooks/clerk`
4. Selecciona eventos: `user.created`, `user.updated`, `user.deleted`
5. Copia el secreto a `CLERK_WEBHOOK_SECRET`

## 🎨 Personalización

### Tema

El tema se configura en `src/app/globals.css`. Modifica las variables CSS:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  /* ... */
}
```

### Componentes

Los componentes UI están en `src/components/ui/` (shadcn/ui). Puedes personalizarlos o añadir nuevos.

## 📦 Deployment

### Vercel (Recomendado)

1. Push a GitHub
2. Importa el proyecto en [Vercel](https://vercel.com)
3. Añade las variables de entorno
4. Deploy 🎉

### Variables de entorno en producción

```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org) (App Router)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com)
- **Componentes**: [shadcn/ui](https://ui.shadcn.com)
- **ORM**: [Prisma](https://prisma.io)
- **Base de datos**: [PostgreSQL](https://www.postgresql.org)
- **Auth**: [Clerk](https://clerk.com)
- **Editor**: [Tiptap](https://tiptap.dev)
- **Iconos**: [Lucide](https://lucide.dev)

## 📝 Licencia

MIT © 2024 Xnote

---

Hecho con ❤️ por el equipo de Xnote