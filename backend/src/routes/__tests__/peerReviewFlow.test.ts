import request from 'supertest';
import express, { Express } from 'express';
import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { signToken } from '../../services/auth';
import checkinsRouter from '../checkins';
import managerRouter from '../manager';

// Mock the db module
let testDb: Database;
let SQL: any;

jest.mock('../../db/index', () => {
  const actual = jest.requireActual('../../db/index');
  return {
    ...actual,
    getDb: () => ({
      prepare: (sql: string) => {
        const stmt = testDb.prepare(sql);
        return {
          run: (...args: any[]) => {
            stmt.bind(args.flat());
            stmt.step();
            stmt.free();
          },
          get: (...args: any[]) => {
            stmt.bind(args.flat());
            if (stmt.step()) {
              const row = stmt.getAsObject();
              stmt.free();
              return row;
            }
            stmt.free();
            return undefined;
          },
          all: (...args: any[]) => {
            stmt.bind(args.flat());
            const rows: any[] = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
          },
        };
      },
      exec: (sql: string) => testDb.run(sql),
    }),
    saveDb: jest.fn(),
  };
});

// Mock LLM and vector store services
jest.mock('../../services/llm', () => ({
  generateCheckInQuestions: jest.fn().mockResolvedValue([]),
  classifyCheckIn: jest.fn().mockResolvedValue({
    sentimentScore: 4,
    struggleType: 'NONE',
    implicatedValues: [],
    summary: 'Test summary',
  }),
}));

jest.mock('../../services/vectorStore', () => ({
  queryKB: jest.fn().mockResolvedValue(null),
}));

describe('Peer Review Flow', () => {
  let app: Express;
  let managerToken: string;
  let reviewerToken: string;
  let subjectToken: string;
  let managerId: string;
  let reviewerId: string;
  let subjectId: string;
  let peerReviewId: string;

  beforeAll(async () => {
    SQL = await initSqlJs();
  });

  beforeEach(async () => {
    // Create fresh in-memory database
    testDb = new SQL.Database();

    // Load schema
    const schemaPath = path.join(__dirname, '../../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    testDb.run(schema);

    // Seed test data
    managerId = 'manager-1';
    reviewerId = 'reviewer-1';
    subjectId = 'subject-1';
    peerReviewId = 'peer-review-1';

    testDb.run(`
      INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at)
      VALUES
        ('${managerId}', 'manager@test.com', 'Manager', 'hash', 'Manager', NULL, '2024-01-01', '2024-01-01T00:00:00Z'),
        ('${reviewerId}', 'reviewer@test.com', 'Reviewer', 'hash', 'New_Employee', '${managerId}', '2024-01-01', '2024-01-01T00:00:00Z'),
        ('${subjectId}', 'subject@test.com', 'Subject', 'hash', 'New_Employee', '${managerId}', '2024-01-01', '2024-01-01T00:00:00Z')
    `);

    testDb.run(`
      INSERT INTO peer_reviews (id, manager_id, reviewer_id, subject_id, status, questions, created_at)
      VALUES ('${peerReviewId}', '${managerId}', '${reviewerId}', '${subjectId}', 'pending_reviewer', '["Q1", "Q2"]', '2024-01-01T00:00:00Z')
    `);

    // Generate tokens
    managerToken = signToken({ id: managerId, role: 'Manager', managerId: null });
    reviewerToken = signToken({ id: reviewerId, role: 'New_Employee', managerId });
    subjectToken = signToken({ id: subjectId, role: 'New_Employee', managerId });

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/checkins', checkinsRouter);
    app.use('/api/manager', managerRouter);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('Task 5.1: Reviewer submit sets status to pending_manager', () => {
    it('should transition peer review from pending_reviewer to pending_manager when reviewer submits', async () => {
      const responses = ['Response 1', 'Response 2'];

      const res = await request(app)
        .post(`/api/checkins/peer-reviews/${peerReviewId}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ responses });

      expect(res.status).toBe(200);
      expect(res.body.peerReview).toBeDefined();
      expect(res.body.peerReview.status).toBe('pending_manager');
      expect(res.body.peerReview.responses).toEqual(responses);

      // Verify in DB
      const stmt = testDb.prepare('SELECT status FROM peer_reviews WHERE id = ?');
      stmt.bind([peerReviewId]);
      stmt.step();
      const row = stmt.getAsObject();
      stmt.free();
      expect(row.status).toBe('pending_manager');
    });

    it('should set completed_at timestamp when reviewer submits', async () => {
      const responses = ['Response 1', 'Response 2'];

      await request(app)
        .post(`/api/checkins/peer-reviews/${peerReviewId}/submit`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ responses });

      const stmt = testDb.prepare('SELECT completed_at FROM peer_reviews WHERE id = ?');
      stmt.bind([peerReviewId]);
      stmt.step();
      const row = stmt.getAsObject();
      stmt.free();
      expect(row.completed_at).toBeTruthy();
    });
  });

  describe('Task 6.1: Manager reject sets status to pending_reviewer and records manager_notes', () => {
    beforeEach(() => {
      // Set peer review to pending_manager state
      testDb.run(`
        UPDATE peer_reviews
        SET status = 'pending_manager', responses = '["R1", "R2"]', completed_at = '2024-01-02T00:00:00Z'
        WHERE id = '${peerReviewId}'
      `);
    });

    it('should transition peer review from pending_manager to pending_reviewer when manager rejects', async () => {
      const feedback = 'Please provide more detail';

      const res = await request(app)
        .post(`/api/manager/peer-reviews/${peerReviewId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ feedback });

      expect(res.status).toBe(200);
      expect(res.body.peerReview).toBeDefined();
      expect(res.body.peerReview.status).toBe('pending_reviewer');

      // Verify in DB
      const stmt = testDb.prepare('SELECT status FROM peer_reviews WHERE id = ?');
      stmt.bind([peerReviewId]);
      stmt.step();
      const row = stmt.getAsObject();
      stmt.free();
      expect(row.status).toBe('pending_reviewer');
    });

    it('should record manager_notes when manager rejects', async () => {
      const feedback = 'Please provide more detail';

      await request(app)
        .post(`/api/manager/peer-reviews/${peerReviewId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ feedback });

      const stmt = testDb.prepare('SELECT manager_notes FROM peer_reviews WHERE id = ?');
      stmt.bind([peerReviewId]);
      stmt.step();
      const row = stmt.getAsObject();
      stmt.free();
      expect(row.manager_notes).toBe(feedback);
    });

    it('should require feedback parameter', async () => {
      const res = await request(app)
        .post(`/api/manager/peer-reviews/${peerReviewId}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('feedback is required');
    });
  });
});
