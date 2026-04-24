import { getDb, saveDb } from './index';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function runSeed() {
  const db = getDb();

  // Check if already seeded
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding database...');

  const managerId = uuidv4();
  const employee1Id = uuidv4();
  const employee2Id = uuidv4();

  const managerHash = await bcrypt.hash('password123', 10);
  const empHash = await bcrypt.hash('password123', 10);

  // Insert manager
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    managerId, 'manager@acme.com', 'Sarah Chen', managerHash,
    'Manager', null, '2023-01-01', new Date().toISOString()
  );

  // Insert employees
  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    employee1Id, 'alex@acme.com', 'Alex Rivera', empHash,
    'New_Employee', managerId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString()
  );

  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    employee2Id, 'jordan@acme.com', 'Jordan Kim', empHash,
    'New_Employee', managerId, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    new Date().toISOString()
  );

  // Culture values
  const cv1Id = uuidv4();
  const cv2Id = uuidv4();
  const cv3Id = uuidv4();

  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`).run(
    cv1Id, 'Customer Obsession',
    'Leaders start with the customer and work backwards. They work vigorously to earn and keep customer trust.'
  );
  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`).run(
    cv2Id, 'Bias for Action',
    'Speed matters in business. Many decisions and actions are reversible and do not need extensive study.'
  );
  db.prepare(`INSERT INTO culture_values (id, name, description) VALUES (?, ?, ?)`).run(
    cv3Id, 'Earn Trust',
    'Leaders listen attentively, speak candidly, and treat others respectfully. They are vocally self-critical.'
  );

  // Culture champions
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`).run(
    uuidv4(), managerId, cv1Id,
    'Sarah has led multiple customer-facing initiatives and is passionate about customer-centric design.'
  );
  db.prepare(`INSERT INTO culture_champions (id, user_id, culture_value_id, bio) VALUES (?, ?, ?, ?)`).run(
    uuidv4(), managerId, cv3Id,
    'Sarah is known for her candid feedback and creating psychological safety in her teams.'
  );

  // Seed a past check-in for employee1 (completed, low score to trigger at-risk)
  const pastCheckinId = uuidv4();
  db.prepare(`INSERT INTO checkins (id, employee_id, status, due_at, completed_at, sentiment_score, struggle_type, questions, responses, routing, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    pastCheckinId, employee1Id, 'completed',
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    2.5, 'TECHNICAL',
    JSON.stringify(['How are you connecting with the Customer Obsession value?', 'How is your technical progress this sprint?', 'How connected do you feel to your team?']),
    JSON.stringify(['I am still learning the codebase and finding it hard to see how my work connects to customers.', 'I am blocked on the auth service and not sure who to ask.', 'The team is great but I feel a bit lost technically.']),
    JSON.stringify({ struggleType: 'TECHNICAL', message: 'You seem to be facing some technical blockers. Here are some resources to help.', kbAnswers: [], githubContacts: [] }),
    new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  );

  // Seed a pending check-in for employee1 (due now)
  db.prepare(`INSERT INTO checkins (id, employee_id, status, due_at, questions, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    uuidv4(), employee1Id, 'pending',
    new Date(Date.now() - 1000).toISOString(), // due 1 second ago
    JSON.stringify([
      'How are you connecting with the Customer Obsession value this sprint?',
      'How is your sense of belonging and connection with your team?',
      'What technical work are you most proud of this sprint, and where are you blocked?',
      'How are you embodying Bias for Action in your day-to-day work?',
      'Is there anything you wish you understood better about how the team operates?'
    ]),
    new Date().toISOString()
  );

  console.log('Seed complete. Demo credentials:');
  console.log('  New_Employee: alex@acme.com / password123');
  console.log('  New_Employee: jordan@acme.com / password123');
  console.log('  Manager:      manager@acme.com / password123');
  saveDb();
}
