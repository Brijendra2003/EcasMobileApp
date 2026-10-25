// Versioned SQLite migrations (§9.2), applied at startup in order.
// Never edit a shipped migration; append a new one.
export const MIGRATIONS: string[][] = [
  // 1: prefetched reference data, the professor's work, and the outbox
  [
    `create table local_sessions (
       id text primary key,
       session_date text not null,
       starts_at text not null,
       ends_at text not null,
       status text not null,
       register_state text,
       register_version integer,
       data text not null,              -- full v_my_sessions row (JSON)
       fetched_at text not null
     )`,
    'create index local_sessions_date on local_sessions (session_date)',
    `create table local_roster (
       session_id text not null,
       student_id text not null,
       roll_no integer,
       name text not null,
       batch_code text,
       photo_url text,
       suggested_status text,
       primary key (session_id, student_id)
     )`,
    `create table local_registers (
       session_id text primary key,
       state text not null,             -- draft | queued | syncing | synced | conflict | rejected
       client_submission_id text,
       base_version integer not null default 0,
       defaulted_students text,         -- JSON from the server
       defaulted_ack integer not null default 0,
       server_copy text,                -- JSON register + records on conflict
       reject_code text,
       last_error text,
       updated_at text not null
     )`,
    `create table local_marks (
       session_id text not null,
       student_id text not null,
       status_code text,                -- null = not marked (Pending, or suggested leave)
       marked_at text,
       primary key (session_id, student_id)
     )`,
    `create table outbox (
       id integer primary key autoincrement,
       kind text not null,
       session_id text not null,
       client_submission_id text not null,
       payload text not null,
       attempts integer not null default 0,
       next_attempt_at text not null,
       last_error text,
       created_at text not null
     )`,
  ],
];
