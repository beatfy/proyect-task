// Initialize database tables on startup
const { execSync } = require('child_process');

try {
  console.log('🔄 Running prisma db push to ensure tables exist...');
  execSync('npx prisma db push --accept-data-loss --skip-generate', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  console.log('✅ Database tables initialized');
} catch (error) {
  console.error('⚠️ Database initialization warning:', error.message);
  // Continue anyway - tables might already exist
}