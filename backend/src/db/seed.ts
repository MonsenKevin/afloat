import { getDb, saveDb } from './index';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const QUESTIONS = JSON.stringify([
  'slider:Customer Obsession',
  'slider:Bias for Action',
  'slider:Earn Trust',
  'text:What technical work are you focused on this sprint, and where are you blocked?',
  'text:How connected do you feel to your team and company culture right now?',
]);

const PEER_REVIEW_QUESTIONS = JSON.stringify([
  'slider:Customer Obsession',
  'slider:Bias for Action',
  'slider:Earn Trust',
  'text:What are this person\'s greatest technical strengths and contributions?',
  'text:How well does this person collaborate with and support the team?',
]);

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function insertUser(db: any, id: string, email: string, name: string, pw: string, role: string, managerId: string | null, startDate: string) {
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, email, name, pw, role, managerId, startDate, daysAgo(0));
}

function insertCheckin(db: any, employeeId: string, daysAgoCompleted: number, score: number, struggle: string, sliders: string[], tech: string, culture: string) {
  const id = uuidv4();
  const routing = struggle === 'NONE'
    ? JSON.stringify({ struggleType: 'NONE', message: 'Keep it up!', kbAnswers: [], githubContacts: [] })
    : struggle === 'TECHNICAL'
    ? JSON.stringify({ struggleType: 'TECHNICAL', message: 'You have some technical blockers to work through.', kbAnswers: [], githubContacts: [] })
    : JSON.stringify({ struggleType: 'HUMAN', message: 'It sounds like you may be navigating some team dynamics.', cultureChampions: [], kbAnswers: [] });
  db.prepare(`INSERT INTO checkins (id, employee_id, status, due_at, completed_at, sentiment_score, struggle_type, questions, responses, routing, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, employeeId, 'completed', daysAgo(daysAgoCompleted + 1), daysAgo(daysAgoCompleted), score, struggle,
      QUESTIONS,
      JSON.stringify([...sliders, tech, culture]),
      routing,
      daysAgo(daysAgoCompleted + 1));
  return id;
}

function insertPeerReview(db: any, managerId: string, reviewerId: string, subjectId: string, status: string, responses?: string[], managerNotes?: string) {
  const id = uuidv4();
  const now = daysAgo(0);
  const completedAt = responses ? daysAgo(3) : null;
  const approvedAt = status === 'approved' ? daysAgo(1) : null;
  db.prepare(`INSERT INTO peer_reviews (id, manager_id, reviewer_id, subject_id, status, questions, responses, manager_notes, created_at, completed_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, managerId, reviewerId, subjectId, status, PEER_REVIEW_QUESTIONS,
      responses ? JSON.stringify(responses) : null,
      managerNotes || null,
      now, completedAt, approvedAt);
  return id;
}

export async function runSeed() {
  const db = getDb();

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding database...');

  const pw = await bcrypt.hash('password123', 10);

  // ── Managers ──────────────────────────────────────────────────────────────
  const sarahId = uuidv4();
  const marcusId = uuidv4();
  const linaId = uuidv4();

  insertUser(db, sarahId, 'sarah@acme.com', 'Sarah Chen', pw, 'Manager', null, '2021-03-15');
  insertUser(db, marcusId, 'marcus@acme.com', 'Marcus Webb', pw, 'Manager', null, '2020-06-01');
  insertUser(db, linaId, 'lina@acme.com', 'Lina Osei', pw, 'Manager', null, '2022-01-10');

  // ── Sarah's team ──────────────────────────────────────────────────────────
  const alexId = uuidv4();
  const jordanId = uuidv4();
  const priyankaId = uuidv4();
  const devonId = uuidv4();
  const taiId = uuidv4();

  insertUser(db, alexId,     'alex@acme.com',     'Alex Rivera',    pw, 'New_Employee', sarahId, daysAgo(30));
  insertUser(db, jordanId,   'jordan@acme.com',   'Jordan Kim',     pw, 'New_Employee', sarahId, daysAgo(14));
  insertUser(db, priyankaId, 'priyanka@acme.com', 'Priyanka Nair',  pw, 'New_Employee', sarahId, daysAgo(45));
  insertUser(db, devonId,    'devon@acme.com',    'Devon Okafor',   pw, 'New_Employee', sarahId, daysAgo(60));
  insertUser(db, taiId,      'tai@acme.com',      'Tai Nguyen',     pw, 'New_Employee', sarahId, daysAgo(75));

  // ── Marcus's team ─────────────────────────────────────────────────────────
  const sashaId = uuidv4();
  const milesId = uuidv4();
  const rosaId = uuidv4();
  const benId = uuidv4();

  insertUser(db, sashaId, 'sasha@acme.com', 'Sasha Petrov',    pw, 'New_Employee', marcusId, daysAgo(21));
  insertUser(db, milesId, 'miles@acme.com', 'Miles Thompson',  pw, 'New_Employee', marcusId, daysAgo(7));
  insertUser(db, rosaId,  'rosa@acme.com',  'Rosa Delgado',    pw, 'New_Employee', marcusId, daysAgo(50));
  insertUser(db, benId,   'ben@acme.com',   'Ben Hartley',     pw, 'New_Employee', marcusId, daysAgo(90));

  // ── Lina's team ───────────────────────────────────────────────────────────
  const yemiId = uuidv4();
  const chloeId = uuidv4();
  const omarId = uuidv4();

  insertUser(db, yemiId,  'yemi@acme.com',  'Yemi Adeyemi',   pw, 'New_Employee', linaId, daysAgo(35));
  insertUser(db, chloeId, 'chloe@acme.com', 'Chloe Marchand', pw, 'New_Employee', linaId, daysAgo(55));
  insertUser(db, omarId,  'omar@acme.com',  'Omar Shaikh',    pw, 'New_Employee', linaId, daysAgo(10));

  // ── Culture values ────────────────────────────────────────────────────────
  const cv1Id = uuidv4();
  const cv2Id = uuidv4();
  const cv3Id = uuidv4();

  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`)
    .run(cv1Id, 'Customer Obsession', 'Leaders start with the customer and work backwards.');
  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`)
    .run(cv2Id, 'Bias for Action', 'Speed matters in business. Many decisions are reversible and do not need extensive study.');
  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`)
    .run(cv3Id, 'Earn Trust', 'Leaders listen attentively, speak candidly, and treat others respectfully.');

  // ── Culture champions ─────────────────────────────────────────────────────
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), sarahId, cv1Id, 'Sarah has led multiple customer-facing initiatives and is passionate about customer-centric design.');
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), sarahId, cv3Id, 'Sarah is known for her candid feedback and creating psychological safety in her teams.');
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), marcusId, cv2Id, 'Marcus ships fast and teaches his team to make reversible decisions quickly rather than over-analyzing.');
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), linaId, cv3Id, 'Lina runs the most psychologically safe team in the company — her retrospectives are legendary.');
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`)
    .run(uuidv4(), priyankaId, cv1Id, 'Priyanka consistently advocates for the end user in design reviews and has caught several UX regressions.');

  // ── Alex Rivera — at-risk trajectory, then recovering ────────────────────
  insertCheckin(db, alexId, 56, 2.1, 'TECHNICAL', ['2', '2', '2'],
    'Completely lost on the auth service refactor. No documentation and the original author left the company.',
    'Feeling isolated. Everyone seems busy and I don\'t want to bother them.');
  insertCheckin(db, alexId, 42, 2.4, 'BOTH', ['2', '3', '2'],
    'Still blocked on auth. Tried reading the code but it\'s very complex. Opened a PR but got no reviews for 5 days.',
    'Had a 1:1 with Sarah which helped. Still feel like I\'m behind everyone else.');
  insertCheckin(db, alexId, 28, 2.8, 'TECHNICAL', ['3', '3', '2'],
    'Finally got unblocked on auth after pairing with Sasha. Now working on ENG-4460 rate limiter.',
    'Team lunch helped a lot. Starting to feel more comfortable asking questions.');
  insertCheckin(db, alexId, 14, 3.2, 'NONE', ['3', '4', '3'],
    'Good progress on ENG-4460. Rate limiter middleware is almost done. Waiting on Redis config from infra.',
    'Feeling much better. Joined the #new-employees Slack channel and it\'s been great.');
  // Pending check-in for Alex
  db.prepare(`INSERT INTO checkins (id, employee_id, status, due_at, questions, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), alexId, 'pending', daysAgo(0), QUESTIONS, daysAgo(0));

  // ── Jordan Kim — steady performer ─────────────────────────────────────────
  insertCheckin(db, jordanId, 12, 3.8, 'NONE', ['4', '4', '3'],
    'Working on ENG-4460 search integration. Good progress, should be done by end of sprint.',
    'Team is great. Really enjoying the work.');

  // ── Priyanka Nair — high performer ────────────────────────────────────────
  insertCheckin(db, priyankaId, 70, 4.0, 'NONE', ['4', '4', '4'],
    'Finished DS-112 card components v1. Starting mobile responsive work.',
    'Loving the team. Had a great 1:1 with Sarah.');
  insertCheckin(db, priyankaId, 56, 4.2, 'NONE', ['4', '5', '4'],
    'DS-112 mobile components shipped. Starting DS-115 data table.',
    'Presented at all-hands. Got great feedback from the product team.');
  insertCheckin(db, priyankaId, 42, 4.3, 'NONE', ['5', '4', '4'],
    'DS-115 data table is 80% done. Collaborating with Devon on the search integration.',
    'Feel very connected. Mentoring Jordan on component architecture.');
  insertCheckin(db, priyankaId, 28, 4.5, 'NONE', ['5', '5', '4'],
    'DS-115 shipped. Starting DS-118 form components. Also reviewing PRD-001 designs.',
    'Best sprint yet. Team is firing on all cylinders.');
  insertCheckin(db, priyankaId, 14, 4.4, 'NONE', ['4', '5', '5'],
    'DS-118 form components done. Helping Marcus\'s team with WebSocket UI integration.',
    'Really proud of the design system work. Getting recognition from other teams.');

  // ── Devon Okafor — human struggle, then resolved ──────────────────────────
  insertCheckin(db, devonId, 56, 3.0, 'HUMAN', ['3', '3', '2'],
    'Technical work is fine — making progress on PRD-002 search spec.',
    'Struggling with the feedback culture. It feels very blunt and I\'m not used to it.');
  insertCheckin(db, devonId, 42, 3.3, 'HUMAN', ['3', '3', '3'],
    'Search spec approved. Starting implementation.',
    'Had a good conversation with Sarah. Still adjusting but feeling better.');
  insertCheckin(db, devonId, 28, 3.7, 'NONE', ['4', '3', '4'],
    'Search backend is 60% done. Unblocked on the Elasticsearch query structure.',
    'Feeling much more comfortable. The feedback culture is starting to make sense.');
  insertCheckin(db, devonId, 14, 4.0, 'NONE', ['4', '4', '4'],
    'Search feature is in code review. Should ship next sprint.',
    'Really enjoying the team now. Gave my first code review feedback and it went well.');

  // ── Tai Nguyen — new, struggling technically ──────────────────────────────
  insertCheckin(db, taiId, 60, 2.5, 'TECHNICAL', ['3', '2', '3'],
    'Trying to understand the monorepo structure. The build system is very complex and I keep breaking things.',
    'Everyone is nice but I feel like I\'m slowing the team down.');
  insertCheckin(db, taiId, 46, 2.8, 'TECHNICAL', ['3', '3', '3'],
    'Getting better with the build system. Still confused about the deployment pipeline.',
    'Had coffee with Priyanka which helped a lot. Starting to feel more settled.');
  insertCheckin(db, taiId, 32, 3.2, 'NONE', ['3', '3', '4'],
    'First PR merged! Working on DS-119 icon library.',
    'Feeling much more confident. The team is very supportive.');
  insertCheckin(db, taiId, 18, 3.5, 'NONE', ['4', '3', '4'],
    'DS-119 icon library is 70% done. Learning a lot from Priyanka\'s code reviews.',
    'Really enjoying the design system work. Found my niche.');

  // ── Sasha Petrov — solid mid-level ────────────────────────────────────────
  insertCheckin(db, sashaId, 42, 3.5, 'TECHNICAL', ['4', '3', '3'],
    'Working on ENG-4398 Slack duplicate notifications. Redis idempotency approach is clear.',
    'Team is great. Marcus is very supportive and gives clear direction.');
  insertCheckin(db, sashaId, 28, 3.8, 'NONE', ['4', '4', '3'],
    'ENG-4398 fix is in review. Also started looking at ENG-4455 JWT migration.',
    'Good sprint. Helped Alex get unblocked on the rate limiter.');
  insertCheckin(db, sashaId, 14, 4.1, 'NONE', ['4', '4', '4'],
    'ENG-4398 shipped. ENG-4455 JWT migration design doc is done.',
    'Really enjoying the technical depth of the work. Feeling very engaged.');

  // ── Miles Thompson — brand new, no check-ins yet ──────────────────────────
  // (intentionally no completed check-ins — tests the empty state)
  db.prepare(`INSERT INTO checkins (id, employee_id, status, due_at, questions, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), milesId, 'pending', daysAgo(0), QUESTIONS, daysAgo(0));

  // ── Rosa Delgado — high performer on Marcus's team ────────────────────────
  insertCheckin(db, rosaId, 42, 4.2, 'NONE', ['4', '5', '4'],
    'Shipped the WebSocket auth layer. Working on reconnection logic.',
    'Love the team energy. Marcus runs great sprint planning sessions.');
  insertCheckin(db, rosaId, 28, 4.4, 'NONE', ['5', '4', '4'],
    'WebSocket reconnection done. Load testing shows we can handle 12k concurrent connections.',
    'Feeling very productive. Presented the WebSocket architecture to the whole eng team.');
  insertCheckin(db, rosaId, 14, 4.5, 'NONE', ['5', '5', '4'],
    'ENG-4421 is basically done. Waiting on DATA-88 SLA confirmation before we can ship.',
    'Best sprint of my career so far. Really proud of the WebSocket work.');

  // ── Ben Hartley — struggling, at-risk ────────────────────────────────────
  db.prepare(`UPDATE users SET is_at_risk = 1, checkin_interval_days = 7 WHERE id = ?`).run(benId);
  insertCheckin(db, benId, 70, 1.8, 'BOTH', ['2', '2', '1'],
    'Completely overwhelmed. Three tickets assigned to me and I don\'t understand any of them.',
    'Feeling very disconnected. I don\'t know who to ask for help without looking incompetent.');
  insertCheckin(db, benId, 56, 2.0, 'BOTH', ['2', '2', '2'],
    'Made some progress on DATA-88 benchmarking but the results are confusing.',
    'Had a 1:1 with Marcus. He was helpful but I still feel behind.');
  insertCheckin(db, benId, 42, 1.9, 'BOTH', ['2', '2', '2'],
    'DATA-88 benchmark results show P95 latency of 8s. Not sure how to present this to the product team.',
    'Still struggling. The team moves very fast and I can\'t keep up.');
  insertCheckin(db, benId, 28, 2.2, 'TECHNICAL', ['2', '3', '2'],
    'Wrote up the DATA-88 findings. Marcus reviewed and said it was good but I\'m not confident.',
    'Slightly better after the team offsite. At least I know people\'s names now.');

  // ── Yemi Adeyemi — Lina's team, solid ────────────────────────────────────
  insertCheckin(db, yemiId, 28, 3.9, 'NONE', ['4', '4', '4'],
    'Working on the analytics export feature (PRD-007). Good progress on the CSV generation.',
    'Lina\'s team has a great culture. Retrospectives are really useful.');
  insertCheckin(db, yemiId, 14, 4.1, 'NONE', ['4', '4', '5'],
    'CSV export is done. Starting on the Excel format.',
    'Really enjoying the work. Lina gives great feedback.');

  // ── Chloe Marchand — Lina's team, human struggle ─────────────────────────
  insertCheckin(db, chloeId, 42, 3.1, 'HUMAN', ['3', '3', '3'],
    'Technical work is fine. Working on the analytics dashboard.',
    'Feeling a bit left out of decisions. Not sure if it\'s intentional or just how things work here.');
  insertCheckin(db, chloeId, 28, 3.4, 'HUMAN', ['3', '3', '3'],
    'Analytics dashboard is 50% done.',
    'Had a good conversation with Lina. She explained the decision-making process better.');
  insertCheckin(db, chloeId, 14, 3.7, 'NONE', ['4', '3', '4'],
    'Analytics dashboard shipped. Starting on the filter components.',
    'Feeling much more included. Lina added me to the product sync meetings.');

  // ── Omar Shaikh — brand new to Lina's team ────────────────────────────────
  insertCheckin(db, omarId, 8, 3.3, 'TECHNICAL', ['3', '3', '4'],
    'Still getting set up. Dev environment took 2 days to configure. Docker issues.',
    'Team is very welcoming. Lina checked in on me every day this week.');

  // ── Peer Reviews ──────────────────────────────────────────────────────────

  // Sarah's team peer reviews
  // 1. Approved: Jordan reviewed Priyanka (high scores)
  insertPeerReview(db, sarahId, jordanId, priyankaId, 'approved',
    ['5', '4', '5', 'Priyanka is an exceptional engineer. Her design system work has unblocked the entire frontend team. She writes incredibly clean, well-documented code.', 'Priyanka is the most collaborative person on the team. She always makes time to help others and her code reviews are thorough but kind.'],
    'Great feedback — well articulated.');

  // 2. Approved: Devon reviewed Alex (encouraging scores)
  insertPeerReview(db, sarahId, devonId, alexId, 'approved',
    ['3', '4', '3', 'Alex has grown a lot since joining. The rate limiter work shows real technical depth. Still ramping up but trajectory is very positive.', 'Alex asks great questions and is never afraid to admit when he\'s stuck. That kind of honesty makes the whole team better.'],
    undefined);

  // 3. Pending manager approval: Priyanka reviewed Devon
  insertPeerReview(db, sarahId, priyankaId, devonId, 'pending_manager',
    ['4', '3', '4', 'Devon\'s search feature is technically solid. The Elasticsearch query optimization was impressive.', 'Devon has really come into his own on the team. His feedback in code reviews has gotten much more direct and useful.'],
    undefined);

  // 4. Awaiting reviewer: Alex to review Tai (pending_reviewer — Alex has a pending review)
  insertPeerReview(db, sarahId, alexId, taiId, 'pending_reviewer', undefined, undefined);

  // 5. Sent back for revision: Jordan reviewed Tai, manager sent back
  insertPeerReview(db, sarahId, jordanId, taiId, 'pending_reviewer',
    ['3', '3', '3', 'Tai is doing okay.', 'Fine to work with.'],
    'This feedback is too vague to be useful. Please add specific examples of Tai\'s technical contributions and collaboration. What has Tai worked on? What did they do well?');

  // Marcus's team peer reviews
  // 6. Approved: Rosa reviewed Sasha (high scores)
  insertPeerReview(db, marcusId, rosaId, sashaId, 'approved',
    ['4', '5', '4', 'Sasha\'s work on ENG-4398 was excellent. The Redis idempotency solution was elegant and well-tested. He also helped me understand the notification worker architecture.', 'Sasha is incredibly collaborative. He proactively shared context about the codebase that saved me hours of investigation.'],
    'Excellent feedback, very specific.');

  // 7. Approved: Sasha reviewed Rosa (very high scores)
  insertPeerReview(db, marcusId, sashaId, rosaId, 'approved',
    ['5', '5', '5', 'Rosa\'s WebSocket implementation is the best code I\'ve seen at this company. The load testing methodology was rigorous and the reconnection logic handles every edge case.', 'Rosa elevates everyone around her. She ran a knowledge-sharing session on WebSocket architecture that was incredibly valuable for the whole team.'],
    undefined);

  // 8. Pending reviewer: Miles to review Ben (Miles has a pending review to complete)
  insertPeerReview(db, marcusId, milesId, benId, 'pending_reviewer', undefined, undefined);

  // 9. Pending manager: Ben reviewed Rosa
  insertPeerReview(db, marcusId, benId, rosaId, 'pending_manager',
    ['5', '4', '5', 'Rosa is amazing. The WebSocket work is incredible and she\'s always willing to help.', 'Rosa is the most helpful person on the team. I would not have survived my first month without her.'],
    undefined);

  // Lina's team peer reviews
  // 10. Approved: Yemi reviewed Chloe
  insertPeerReview(db, linaId, yemiId, chloeId, 'approved',
    ['4', '3', '4', 'Chloe\'s analytics dashboard work is solid. The filter architecture she designed is clean and extensible.', 'Chloe has grown a lot in terms of speaking up in meetings. She raised a really important concern about the data model in sprint planning that saved us a week of rework.'],
    'Good feedback.');

  // 11. Pending reviewer: Chloe to review Yemi
  insertPeerReview(db, linaId, chloeId, yemiId, 'pending_reviewer', undefined, undefined);

  // ── Manager notifications ─────────────────────────────────────────────────
  db.prepare(`INSERT INTO manager_notifications (id, manager_id, employee_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), marcusId, benId, 'Ben Hartley has had two consecutive check-in scores below 2. Immediate attention may be needed.', 0, daysAgo(28));
  db.prepare(`INSERT INTO manager_notifications (id, manager_id, employee_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), sarahId, alexId, 'Alex Rivera has had two consecutive check-in scores below 3. Consider checking in.', 1, daysAgo(42));

  console.log('Seed complete. Demo credentials (all passwords: password123):');
  console.log('');
  console.log('  Managers:');
  console.log('    sarah@acme.com    — Sarah Chen  (manages Alex, Jordan, Priyanka, Devon, Tai)');
  console.log('    marcus@acme.com   — Marcus Webb (manages Sasha, Miles, Rosa, Ben)');
  console.log('    lina@acme.com     — Lina Osei   (manages Yemi, Chloe, Omar)');
  console.log('');
  console.log('  Sarah\'s team:');
  console.log('    alex@acme.com     — Alex Rivera    (30d, recovering from at-risk, pending check-in)');
  console.log('    jordan@acme.com   — Jordan Kim     (14d, steady performer)');
  console.log('    priyanka@acme.com — Priyanka Nair  (45d, high performer, culture champion)');
  console.log('    devon@acme.com    — Devon Okafor   (60d, resolved human struggle)');
  console.log('    tai@acme.com      — Tai Nguyen     (75d, resolved technical struggle)');
  console.log('');
  console.log('  Marcus\'s team:');
  console.log('    sasha@acme.com    — Sasha Petrov   (21d, solid mid-level)');
  console.log('    miles@acme.com    — Miles Thompson (7d, brand new, pending check-in, pending peer review)');
  console.log('    rosa@acme.com     — Rosa Delgado   (50d, high performer)');
  console.log('    ben@acme.com      — Ben Hartley    (90d, at-risk, struggling)');
  console.log('');
  console.log('  Lina\'s team:');
  console.log('    yemi@acme.com     — Yemi Adeyemi   (35d, solid performer)');
  console.log('    chloe@acme.com    — Chloe Marchand (55d, resolved human struggle, pending peer review)');
  console.log('    omar@acme.com     — Omar Shaikh    (10d, brand new)');

  saveDb();
}
