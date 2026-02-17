/**
 * Data Migration Script
 * Migrates existing scores from db.json to Supabase
 * Run with: npx tsx scripts/migrate-data.ts
 */

import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface OldScore {
  id: string;
  username: string;
  score: number;
  timestamp: string;
}

interface OldDatabase {
  scores: OldScore[];
  users: unknown[];
}

async function migrateData() {
  console.log('🚀 Starting data migration from db.json to Supabase...\n');

  // Read old database
  const dbPath = path.join(process.cwd(), 'db.json');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ db.json not found!');
    process.exit(1);
  }

  const oldData: OldDatabase = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  
  console.log(`📊 Found ${oldData.scores.length} scores to migrate`);

  if (oldData.scores.length === 0) {
    console.log('✅ No scores to migrate. Database is ready!');
    return;
  }

  // Get unique usernames
  const uniqueUsernames = [...new Set(oldData.scores.map(s => s.username))];
  console.log(`👥 Found ${uniqueUsernames.length} unique users\n`);

  let migratedUsers = 0;
  let migratedScores = 0;
  let errors = 0;

  // Create users and scores
  for (const username of uniqueUsernames) {
    try {
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        user = await prisma.user.create({
          data: { username }
        });
        migratedUsers++;
        console.log(`✓ Created user: ${username}`);
      } else {
        console.log(`✓ User exists: ${username}`);
      }

      // Get all scores for this user
      const userScores = oldData.scores.filter(s => s.username === username);

      // Create scores
      for (const oldScore of userScores) {
        try {
          await prisma.score.create({
            data: {
              score: oldScore.score,
              userId: user.id,
              createdAt: new Date(oldScore.timestamp)
            }
          });
          migratedScores++;
          console.log(`  ✓ Migrated score: ${oldScore.score} (${oldScore.timestamp})`);
        } catch (error) {
          errors++;
          console.error(`  ✗ Error migrating score for ${username}:`, error);
        }
      }

      console.log('');
    } catch (error) {
      errors++;
      console.error(`✗ Error creating user ${username}:`, error);
    }
  }

  // Summary
  console.log('\n📈 Migration Summary:');
  console.log(`  ✅ Users migrated: ${migratedUsers}`);
  console.log(`  ✅ Scores migrated: ${migratedScores}`);
  if (errors > 0) {
    console.log(`  ⚠️  Errors: ${errors}`);
  }

  // Verify
  const totalUsers = await prisma.user.count();
  const totalScores = await prisma.score.count();
  
  console.log('\n🔍 Database Status:');
  console.log(`  Total Users: ${totalUsers}`);
  console.log(`  Total Scores: ${totalScores}`);

  console.log('\n✨ Migration complete!');
  console.log('💡 You can now archive db.json and use Supabase exclusively.\n');
}

// Run migration
migrateData()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
