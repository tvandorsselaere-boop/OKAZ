/**
 * OKAZ - Script de test de pertinence des résultats
 *
 * Usage: npm run test:relevance
 *
 * Ce script teste la qualité des résultats de recherche en :
 * 1. Chargeant des fixtures de données réalistes
 * 2. Appelant l'API Gemini pour analyser la pertinence
 * 3. Comparant avec les résultats attendus
 * 4. Générant un rapport de qualité
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration des tests
const TEST_CASES = [
  {
    query: 'PS5',
    fixture: 'ps5.json',
    expectedKeywords: ['ps5', 'playstation 5', 'playstation5'],
    excludeKeywords: ['volant', 'manette', 'casque', 'support', 'skin', 'coque', 'station'],
    description: 'Console PS5 - doit exclure les accessoires',
  },
  {
    query: 'iPhone 13',
    fixture: 'iphone13.json',
    expectedKeywords: ['iphone 13', 'iphone13'],
    excludeKeywords: ['coque', 'protection', 'chargeur', 'cable', 'câble', 'film'],
    description: 'iPhone 13 - doit exclure les accessoires',
  },
  {
    query: 'Nike Dunk',
    fixture: 'nikedunk.json',
    expectedKeywords: ['nike', 'dunk'],
    excludeKeywords: ['iphone', 'samsung', 'apple', 'watch', 'galaxy'],
    description: 'Sneakers Nike Dunk - doit exclure tech',
  },
  {
    query: 'MacBook Pro',
    fixture: 'macbook.json',
    expectedKeywords: ['macbook'],
    excludeKeywords: ['coque', 'housse', 'chargeur', 'adaptateur'],
    description: 'MacBook Pro - doit exclure accessoires',
  },
  {
    query: 'Nintendo Switch',
    fixture: 'switch.json',
    expectedKeywords: ['switch', 'nintendo'],
    excludeKeywords: ['manette', 'joy-con', 'joycon', 'dock', 'housse', 'protection'],
    description: 'Console Switch - doit exclure accessoires',
  },
];

interface FixtureResult {
  id: string;
  title: string;
  price: number;
  site: string;
}

interface TestResult {
  query: string;
  description: string;
  totalResults: number;
  relevantResults: number;
  accessoryResults: number;
  wrongCategoryResults: number;
  precisionScore: number; // % de résultats pertinents parmi ceux affichés
  recallScore: number; // % de vrais pertinents trouvés
  details: Array<{
    title: string;
    expectedRelevant: boolean;
    reason: string;
  }>;
}

function loadFixture(filename: string): FixtureResult[] {
  const filepath = path.join(__dirname, 'fixtures', filename);
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  Fixture manquante: ${filepath}`);
    return [];
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  return data.results || [];
}

function checkRelevance(
  title: string,
  expectedKeywords: string[],
  excludeKeywords: string[]
): { isRelevant: boolean; isAccessory: boolean; isWrongCategory: boolean; reason: string } {
  const titleLower = title.toLowerCase();

  // Vérifier si contient un mot-clé attendu
  const hasExpected = expectedKeywords.some(kw => titleLower.includes(kw.toLowerCase()));

  // Vérifier si mauvaise catégorie (pas le mot-clé principal)
  const isWrongCategory = !hasExpected;

  if (isWrongCategory) {
    return {
      isRelevant: false,
      isAccessory: false,
      isWrongCategory: true,
      reason: `Mauvaise catégorie (ne contient pas: ${expectedKeywords.join('/')})`,
    };
  }

  // Vérifier si c'est un accessoire SEUL (pas un bundle)
  // Un bundle = produit principal + accessoire mentionné (ex: "PS5 avec manettes")
  // Un accessoire seul = commence par le mot accessoire ou ne contient pas le produit principal
  const accessoryFound = excludeKeywords.find(kw => titleLower.includes(kw.toLowerCase()));

  if (accessoryFound) {
    // Si le titre COMMENCE par le mot accessoire, c'est un accessoire seul
    // Ex: "Manette PS5", "Coque iPhone", "Housse MacBook"
    const startsWithAccessory = excludeKeywords.some(kw => {
      const kwLower = kw.toLowerCase();
      return titleLower.startsWith(kwLower) || titleLower.startsWith(kwLower.charAt(0).toUpperCase() + kwLower.slice(1));
    });

    // Si le produit principal est mentionné APRES l'accessoire, c'est un accessoire
    // Ex: "Protection écran iPhone 13" → accessoire
    // Ex: "iPhone 13 avec coque" → bundle (pertinent)
    const accessoryIndex = titleLower.indexOf(accessoryFound.toLowerCase());
    const productIndex = expectedKeywords.reduce((min, kw) => {
      const idx = titleLower.indexOf(kw.toLowerCase());
      return idx >= 0 && (min < 0 || idx < min) ? idx : min;
    }, -1);

    // C'est un accessoire si:
    // 1. Le titre commence par le mot accessoire, OU
    // 2. L'accessoire apparaît AVANT le produit principal
    const isAccessoryOnly = startsWithAccessory || (accessoryIndex < productIndex);

    if (isAccessoryOnly) {
      return {
        isRelevant: false,
        isAccessory: true,
        isWrongCategory: false,
        reason: `Accessoire (${accessoryFound})`,
      };
    }
  }

  return {
    isRelevant: true,
    isAccessory: false,
    isWrongCategory: false,
    reason: 'Pertinent',
  };
}

function runTest(testCase: typeof TEST_CASES[0]): TestResult {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🧪 ${testCase.description}`);
  console.log(`   Query: "${testCase.query}"`);

  const results = loadFixture(testCase.fixture);

  const testResult: TestResult = {
    query: testCase.query,
    description: testCase.description,
    totalResults: results.length,
    relevantResults: 0,
    accessoryResults: 0,
    wrongCategoryResults: 0,
    precisionScore: 0,
    recallScore: 0,
    details: [],
  };

  if (results.length === 0) {
    console.log(`   ⚠️  Pas de données`);
    return testResult;
  }

  let trueRelevantCount = 0;

  for (const r of results) {
    const check = checkRelevance(r.title, testCase.expectedKeywords, testCase.excludeKeywords);

    testResult.details.push({
      title: r.title,
      expectedRelevant: check.isRelevant,
      reason: check.reason,
    });

    if (check.isRelevant) {
      testResult.relevantResults++;
      trueRelevantCount++;
    } else if (check.isAccessory) {
      testResult.accessoryResults++;
    } else if (check.isWrongCategory) {
      testResult.wrongCategoryResults++;
    }
  }

  // Calculer les scores
  testResult.precisionScore = Math.round((testResult.relevantResults / testResult.totalResults) * 100);

  console.log(`   📊 Résultats: ${testResult.relevantResults}/${testResult.totalResults} pertinents (${testResult.precisionScore}%)`);
  console.log(`   🎯 Accessoires: ${testResult.accessoryResults}`);
  console.log(`   ❌ Mauvaise catégorie: ${testResult.wrongCategoryResults}`);

  return testResult;
}

function printReport(results: TestResult[]) {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          RAPPORT DE TEST - PERTINENCE DES FIXTURES             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Ce rapport montre la répartition des données de test.');
  console.log('Un bon système OKAZ devrait garder les "Pertinents" et filtrer le reste.');
  console.log('');

  console.log('┌─────────────────┬───────┬───────────┬─────────────┬──────────────┐');
  console.log('│ Recherche       │ Total │ Pertinent │ Accessoires │ Hors-catég.  │');
  console.log('├─────────────────┼───────┼───────────┼─────────────┼──────────────┤');

  let totalAll = 0;
  let totalRelevant = 0;
  let totalAccessory = 0;
  let totalWrongCat = 0;

  for (const r of results) {
    const query = r.query.padEnd(15).slice(0, 15);
    const total = String(r.totalResults).padStart(5);
    const relevant = String(r.relevantResults).padStart(9);
    const accessory = String(r.accessoryResults).padStart(11);
    const wrongCat = String(r.wrongCategoryResults).padStart(12);

    console.log(`│ ${query} │ ${total} │ ${relevant} │ ${accessory} │ ${wrongCat} │`);

    totalAll += r.totalResults;
    totalRelevant += r.relevantResults;
    totalAccessory += r.accessoryResults;
    totalWrongCat += r.wrongCategoryResults;
  }

  console.log('├─────────────────┼───────┼───────────┼─────────────┼──────────────┤');
  console.log(`│ TOTAL           │ ${String(totalAll).padStart(5)} │ ${String(totalRelevant).padStart(9)} │ ${String(totalAccessory).padStart(11)} │ ${String(totalWrongCat).padStart(12)} │`);
  console.log('└─────────────────┴───────┴───────────┴─────────────┴──────────────┘');

  const avgPrecision = Math.round((totalRelevant / totalAll) * 100);
  console.log('');
  console.log(`📈 Taux de pertinence des fixtures: ${avgPrecision}%`);
  console.log(`   → ${totalAll - totalRelevant} résultats non pertinents à filtrer`);
  console.log('');

  // Détails des résultats non pertinents
  console.log('📋 Exemples de résultats à FILTRER:');
  for (const r of results) {
    const toFilter = r.details.filter(d => !d.expectedRelevant).slice(0, 2);
    for (const d of toFilter) {
      console.log(`   ❌ [${r.query}] "${d.title}" → ${d.reason}`);
    }
  }
  console.log('');
}

function main() {
  console.log('🧪 OKAZ - Test de pertinence');
  console.log('   Ce script analyse les fixtures pour vérifier la qualité des données de test.');
  console.log('');

  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    const result = runTest(testCase);
    results.push(result);
  }

  printReport(results);

  console.log('💡 Pour tester avec Gemini, lancez:');
  console.log('   npm run dev (dans un terminal)');
  console.log('   Puis testez manuellement dans le navigateur');
  console.log('');
}

main();
