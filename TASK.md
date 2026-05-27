## Task: Add "Forgot Password" flow to Leadfy

### Context
- Next.js app with NextAuth (credentials provider, bcrypt passwords, Prisma + PostgreSQL)
- Auth config in `lib/auth.ts`
- Prisma schema in `prisma/schema.prisma`
- Users already have email + hashed password

### What to build

#### 1. Prisma model - PasswordResetToken
Add to schema.prisma:
```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```
Add relation to User model: `resetTokens PasswordResetToken[]`

#### 2. Install Resend
`npm install resend`

#### 3. API route: /api/auth/forgot-password (POST)
- Receives { email }
- Find user by email
- Generate token (randomBytes 32, hex)
- Save PasswordResetToken with 1h expiry
- Send email via Resend with link: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
- Email template: simple HTML, "Reset your Leadfy password" with the link
- Return { success: true } always (don't reveal if email exists)
- Use `RESEND_API_KEY` env var

#### 4. API route: /api/auth/reset-password (POST)
- Receives { token, password }
- Find valid token (not expired, not used)
- Hash new password with bcrypt (12 rounds)
- Update user password
- Mark token as used
- Return { success: true }

#### 5. Frontend: /forgot-password page
- Simple form: email input + "Send reset link" button
- Show success message after submit
- Link to this page should be added to the login page ("Forgot password?")

#### 6. Frontend: /reset-password page
- Get token from URL params
- Form: new password + confirm password
- On submit, call /api/auth/reset-password
- Show success + redirect to login

#### 7. Update login page
- Add "Forgot password?" link pointing to /forgot-password

### Environment variables needed
- RESEND_API_KEY=re_8RRttMwi_7iXcR3ESxLViFSjNYrm1VKVh
- NEXT_PUBLIC_APP_URL (already exists)

### Important
- Use bcryptjs for hashing (already installed)
- Use existing prisma client from @/lib/prisma
- Follow existing code patterns in the project
- Make sure `npx prisma generate` runs after schema change
- Commit all changes with a descriptive message
