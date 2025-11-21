// Script to run all tests with proper setup and teardown
import { execSync } from 'child_process';
import { join } from 'path';

const API_DIR = join(__dirname, '..', '..');
const SCRIPTS_DIR = join(API_DIR, 'src', 'scripts');

function runCommand(command: string, cwd: string = API_DIR): string {
  try {
    console.log(`\n🔄 Running: ${command}`);
    const output = execSync(command, { cwd, encoding: 'utf8', stdio: 'inherit' });
    console.log(`✅ ${command} completed successfully`);
    return output;
  } catch (error: any) {
    console.error(`❌ ${command} failed:`, error.message);
    throw error;
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive test suite...\n');

  try {
    // Step 1: Clean database
    console.log('🧹 Cleaning database...');
    runCommand('npx tsx src/scripts/cleanDb.ts');

    // Step 2: Seed all data
    console.log('🌱 Seeding database...');
    runCommand('npx tsx src/scripts/seedAll.ts');

    // Step 3: Run verification
    console.log('🔍 Verifying seeding...');
    runCommand('npx tsx src/scripts/verifySeeding.ts');

    // Step 4: Run individual tests
    const tests = [
      'testTinyTankTransfer.ts',
      'testTransfer.ts',
      'testTransferDynamic.ts',
      'testTransferSequence.ts',
      'testInvariants.ts',
      'testSampleDataCreation.ts',
      'testGain.ts',
      'testLossTransfer.ts',
      'testGainLossSequence.ts',
      'testInventoryAdjustment.ts',
      'testComplexTransfer.ts',
      'testCypher.ts'
    ];

    console.log('\n🧪 Running individual tests...');
    for (const test of tests) {
      try {
        console.log(`\n📋 Running ${test}...`);
        runCommand(`npx tsx src/scripts/${test}`);
        console.log(`✅ ${test} passed`);
      } catch (error) {
        console.error(`❌ ${test} failed, continuing with other tests...`);
        // Continue with other tests even if one fails
      }
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();