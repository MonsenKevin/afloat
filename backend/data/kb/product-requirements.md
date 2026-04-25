# Product Requirements Documents

## PRD-001: Customer Dashboard v2

**Status:** In Development  
**Owner:** Priya Nair (Product)  
**Engineering Lead:** Marcus Webb  
**Target Launch:** Q3 2026

### Problem Statement

The current customer dashboard was built in 2022 and does not support real-time data updates, mobile viewports, or the new multi-account feature shipped in Q1 2026. Customer support tickets related to dashboard confusion have increased 34% YoY.

### Goals

- Reduce dashboard-related support tickets by 50%
- Support real-time data refresh (< 5s latency)
- Achieve WCAG 2.1 AA accessibility compliance
- Support mobile viewports down to 375px width

### Non-Goals

- This PRD does not cover the analytics export feature (tracked separately in PRD-007)
- We are not rebuilding the underlying data pipeline in this cycle

### User Stories

1. As a customer, I want to see my account balance update in real time so I don't need to refresh the page.
2. As a customer on mobile, I want the dashboard to be fully usable on my phone.
3. As a customer with multiple accounts, I want to switch between accounts without losing my current view state.

### Success Metrics

- P50 dashboard load time < 1.2s
- Mobile session duration increases by 20%
- Support ticket volume for dashboard issues decreases by 50% within 60 days of launch

### Technical Approach

Use WebSocket connections for real-time updates. Migrate from class components to React hooks. Implement responsive grid layout using CSS Grid. Store view state in URL params for shareability.

### Dependencies

- Backend team to expose WebSocket endpoint (tracked in JIRA: ENG-4421)
- Design system team to provide updated mobile components (DS-112)
- Data team to confirm real-time pipeline SLA (DATA-88)

---

## PRD-002: Unified Search

**Status:** Planning  
**Owner:** Devon Okafor (Product)  
**Engineering Lead:** Sasha Petrov  
**Target Launch:** Q4 2026

### Problem Statement

Users currently have to navigate to different sections of the product to find customers, transactions, and support tickets. There is no global search. This creates friction especially for support agents who need to quickly pull up customer records.

### Goals

- Single search bar accessible from any page via keyboard shortcut (Cmd+K / Ctrl+K)
- Search across customers, transactions, and support tickets
- Results appear within 300ms for cached queries

### Non-Goals

- Full-text search of document attachments (future phase)
- Search within analytics reports

### User Stories

1. As a support agent, I want to type a customer name and immediately see their account so I can resolve issues faster.
2. As an ops manager, I want to search for a transaction ID and jump directly to that transaction.

### Success Metrics

- 70% of users use global search at least once per week within 30 days of launch
- Average time-to-find-customer decreases from 45s to under 10s

---

## PRD-003: Notification Center

**Status:** Shipped (v1.4.2)  
**Owner:** Priya Nair (Product)

### Summary

Centralized notification center replacing the previous email-only notification system. Supports in-app, email, and Slack delivery channels. Users can configure notification preferences per event type.

### Key Features Shipped

- In-app notification bell with unread count badge
- Email digest (daily or weekly, user-configurable)
- Slack integration via webhook
- Notification preferences page under Settings > Notifications
- Mark all as read / archive actions

### Known Issues

- Slack notifications occasionally duplicate when webhook retries (ENG-4398, fix in progress)
- Email digest does not respect timezone for users outside UTC (ENG-4401, scheduled for v1.4.4)
