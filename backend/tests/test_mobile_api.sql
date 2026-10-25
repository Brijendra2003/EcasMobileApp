-- Mobile API contract (§7.3, §19): each persona's endpoints return only
-- in-scope data, and the write RPCs behave as the app expects. LOCAL ONLY.
-- Needs the demo data and Webapp/supabase/tests/test_00_helpers.sql.
-- Everything runs in one transaction and is rolled back.
begin;

create temp table fx as
select
  (select id from public.profiles where email = 'professor@sjcem.edu.in') as prof_uid,
  (select id from public.staff where user_id = (select id from public.profiles where email = 'professor@sjcem.edu.in')) as prof_staff,
  (select id from public.students where user_id = (select id from public.profiles where email = 'student@sjcem.edu.in')) as student_id,
  (select g.id from public.guardians g join public.profiles p on p.id = g.user_id and p.email = 'parent@sjcem.edu.in') as guardian_id,
  null::uuid as live_session,
  null::uuid as other_student,
  null::uuid as student_record,
  null::uuid as leave_id,
  null::uuid as dispute_id;

-- A session of the professor that is happening now (moved from the future).
update fx set live_session = (
  select s.id from public.class_sessions s
  join public.session_staff ss on ss.session_id = s.id and ss.staff_id = fx.prof_staff
  join public.attendance_registers g on g.session_id = s.id and g.state = 'pending'
  where s.status = 'scheduled' order by s.starts_at limit 1);
update public.class_sessions set starts_at = now() - interval '10 minutes', ends_at = now() + interval '50 minutes',
  session_date = (now() at time zone 'Asia/Kolkata')::date
where id = (select live_session from fx);
update fx set other_student = (select s.id from public.students s where s.id <> fx.student_id and s.status = 'active' limit 1);
update fx set student_record = (select r.id from public.attendance_records r where r.student_id = fx.student_id order by r.session_date desc limit 1);
grant select, update on fx to authenticated;

-- ── Professor ──────────────────────────────────────────────────────────────
select tests.login('professor@sjcem.edu.in');
set role authenticated;

select tests.ok((select (public.my_capabilities() ->> 'staff_id')::uuid) = (select prof_staff from fx), 'capabilities carry the staff id');
select tests.ok((select count(*) from public.v_my_sessions) > 0, 'professor sees own sessions');
select tests.ok(not exists (
  select 1 from public.v_my_sessions v
  where not exists (select 1 from public.session_staff ss where ss.session_id = v.id and ss.staff_id = (select prof_staff from fx))),
  'v_my_sessions holds only sessions the professor is staffed on');
select tests.ok((select count(*) from public.v_my_teaching_groups) > 0, 'professor sees teaching groups');
select tests.ok((select count(*) from public.my_rosters_for_window(app.today() - 2, app.today() + 7)) > 0, 'window prefetch returns rosters');
select tests.raises($$select public.my_rosters_for_window(app.today(), app.today() + 30)$$, 'VALIDATION', 'prefetch window is capped');
select tests.ok((select count(*) from public.session_roster_for_marking((select live_session from fx))) > 0, 'roster for marking');

-- Submit: ok, then an idempotent retry, then a stale edit conflicts.
create temp table sub as
select gen_random_uuid() as cid, gen_random_uuid() as cid2, null::jsonb as first, null::jsonb as retry, null::jsonb as stale;
grant all on sub to authenticated;
update sub set first = public.submit_attendance(
  (select live_session from fx), sub.cid, 0,
  (select jsonb_agg(jsonb_build_object('student_id', student_id, 'status', 'P'))
     from (select student_id from public.session_roster_for_marking((select live_session from fx)) offset 1) x),
  now(), 'test-device');
select tests.ok((select first ->> 'result' from sub) = 'ok', 'first submission ok');
select tests.ok(jsonb_array_length((select first -> 'defaulted_students' from sub)) = 1, 'unmarked student reported as defaulted');
update sub set retry = public.submit_attendance((select live_session from fx), sub.cid, 0, '[]'::jsonb, now(), 'test-device');
select tests.ok((select retry ->> 'result' from sub) = 'duplicate', 'retry with the same client_submission_id is a duplicate');
update sub set stale = public.submit_attendance((select live_session from fx), sub.cid2, 0, '[]'::jsonb, now(), 'test-device');
select tests.ok((select stale ->> 'result' from sub) = 'conflict', 'edit from a stale base version conflicts');
select tests.ok(jsonb_array_length((select stale -> 'records' from sub)) > 0, 'conflict returns the server copy');

select tests.ok((select count(*) from public.v_register_detail where session_id = (select live_session from fx)) > 0, 'register detail visible to the professor');
select tests.ok((select public.class_attendance_stats((select teaching_group_id from public.class_sessions where id = (select live_session from fx))) -> 'students') is not null,
                'class stats for a taught group');
select tests.raises($$select public.class_attendance_stats((select g.id from public.teaching_groups g where not exists (
  select 1 from public.teaching_assignments ta where ta.teaching_group_id = g.id and ta.staff_id = (select prof_staff from fx))
  and not exists (select 1 from public.class_teacher_assignments ct where ct.division_id = g.division_id and ct.staff_id = (select prof_staff from fx)) limit 1))$$,
  'FORBIDDEN', 'class stats refused for a group the professor does not teach');
select tests.ok(public.request_attendance_correction((select live_session from fx),
  (select jsonb_agg(jsonb_build_object('student_id', student_id, 'to_status', 'A')) from (
     select student_id from public.v_register_detail where session_id = (select live_session from fx) and status_code = 'P' limit 2) x),
  'Marked present by mistake') = 2, 'correction request for two students');
select tests.raises($$select public.request_attendance_correction((select live_session from fx), '[]', 'no')$$, 'REASON_REQUIRED', 'correction needs a reason');
select tests.ok(public.apply_staff_leave('casual', app.today() + 40, app.today() + 41, 'Family function') is not null, 'staff leave applied');
select tests.raises($$select public.apply_staff_leave('casual', app.today() + 41, app.today() + 42, 'Overlapping leave')$$, 'LEAVE_OVERLAP', 'overlapping staff leave refused');
select tests.ok((select count(*) from public.v_my_staff_leave) = 1, 'staff leave listed');
-- (demo students mostly have no login, so the recipient count may be 0)
select tests.ok((public.create_class_announcement(
  (select division_id from public.class_sessions where id = (select live_session from fx)), 'Lab moved', 'Tomorrow''s lab moves to room 304.') ->> 'id') is not null,
  'class announcement created for a taught division');
select tests.raises($$select public.create_class_announcement((select dv.id from public.divisions dv where not exists (
  select 1 from public.teaching_assignments ta join public.teaching_groups g on g.id = ta.teaching_group_id
  where ta.staff_id = (select prof_staff from fx) and g.division_id = dv.id)
  and not exists (select 1 from public.class_teacher_assignments ct where ct.division_id = dv.id and ct.staff_id = (select prof_staff from fx)) limit 1),
  'Hello there', 'Announcement to a division I do not teach.')$$, 'FORBIDDEN', 'announcement refused for an untaught division');
reset role;

-- ── Student ────────────────────────────────────────────────────────────────
select tests.login('student@sjcem.edu.in');
set role authenticated;
select tests.ok((select count(*) from public.v_my_attendance_summary) > 0, 'student sees own summary');
select tests.ok(not exists (select 1 from public.v_my_attendance_summary where student_id <> (select student_id from fx)), 'summary is self only');
select tests.ok((select count(*) from public.v_my_sessions) = 0, 'student has no professor sessions');
select tests.ok((select count(*) from public.v_my_timetable where session_date between app.today() and app.today() + 6) > 0, 'student timetable for the week');
select tests.ok(not exists (select 1 from public.v_my_timetable where student_id <> (select student_id from fx)), 'timetable is self only');
select tests.ok(jsonb_array_length(public.my_subject_attendance((select offering_id from public.v_my_attendance_summary limit 1)) -> 'sessions') > 0,
                'subject detail lists sessions');
select tests.raises($$select public.my_subject_attendance((select offering_id from public.v_my_attendance_summary limit 1), (select other_student from fx))$$,
                    'FORBIDDEN', 'subject detail refused for another student');
select tests.ok((select count(*) from public.v_my_profile) = 1, 'profile row');
select tests.ok(jsonb_array_length((select subjects from public.v_my_profile)) > 0, 'profile lists enrolled subjects');
select tests.ok((select count(*) from public.v_my_faculty) > 0, 'faculty list');
select tests.ok((select count(*) from public.v_academic_calendar) >= 0, 'calendar readable');
update fx set leave_id = public.apply_leave(jsonb_build_object('leave_type', 'full_day', 'from_date', app.today() + 10,
                                                               'to_date', app.today() + 11, 'reason', 'Cousin''s wedding'));
select tests.ok((select count(*) from public.v_my_leave where id = (select leave_id from fx)) = 1, 'leave listed');
select tests.raises($$select public.apply_leave(jsonb_build_object('leave_type', 'half_day', 'from_date', app.today() + 11,
                       'half', 'second', 'reason', 'Overlapping half day'))$$, 'LEAVE_OVERLAP', 'overlapping leave refused');
select tests.raises($$select public.apply_leave(jsonb_build_object('leave_type', 'full_day', 'from_date', app.today() + 12, 'reason', 'no'))$$,
                    'REASON_REQUIRED', 'leave needs a reason');
update fx set dispute_id = public.raise_attendance_dispute((select student_record from fx), 'I was present in this lecture.');
select tests.raises($$select public.raise_attendance_dispute((select student_record from fx), 'Again, I was present.')$$, 'DUPLICATE', 'one open dispute per record');
select tests.ok((select count(*) from public.v_my_disputes) = 1, 'student sees own dispute');
reset role;

-- ── Professor sees the student's leave and dispute when relevant ──────────
-- Recipients are the session's staff and the class teacher who have logins.
select tests.ok((select count(*) from public.notifications n where n.kind = 'attendance_dispute') = (
  select count(distinct u) from (
    select st.user_id as u from public.attendance_records r join public.session_staff ss on ss.session_id = r.session_id
    join public.staff st on st.id = ss.staff_id where r.id = (select student_record from fx)
    union select app.class_teacher_user((select student_id from fx))) x where u is not null),
  'dispute notifies the session staff and class teacher');

-- ── Parent ─────────────────────────────────────────────────────────────────
select tests.login('parent@sjcem.edu.in');
set role authenticated;
select tests.ok((select count(*) from public.v_my_children) >= 1, 'parent sees linked child');
select tests.ok((select bool_and(student_id = (select student_id from fx)) from public.v_my_children), 'only the verified child');
select tests.ok((select count(*) from public.v_my_attendance_summary where student_id = (select student_id from fx)) > 0, 'parent reads child summary');
select tests.ok(not exists (select 1 from public.v_my_attendance_summary where student_id <> (select student_id from fx)), 'parent sees no other student');
select tests.ok((select count(*) from public.v_my_leave where id = (select leave_id from fx)) = 1, 'parent sees child leave');
select tests.ok(public.raise_guardian_query((select student_id from fx), (select student_record from fx), 'Why was he marked absent?') is not null,
                'guardian query raised');
select tests.raises($$select public.raise_guardian_query((select other_student from fx), null, 'Not my child at all')$$, 'FORBIDDEN', 'query refused for unlinked student');
select tests.raises($$select public.cancel_leave((select leave_id from fx))$$, 'ALREADY_DECIDED', 'parent cannot cancel the student''s leave');
select tests.ok(public.mark_notifications_read() >= 0, 'mark notifications read');
reset role;

-- ── Student cancels; device registration moves tokens between users ──────
select tests.login('student@sjcem.edu.in');
set role authenticated;
select public.cancel_leave((select leave_id from fx));
select tests.ok((select status from public.v_my_leave where id = (select leave_id from fx)) = 'cancelled', 'student cancels pending leave');
select public.register_device('token-abcdefghijk', 'android', '1.0.0');
reset role;
select tests.login('parent@sjcem.edu.in');
set role authenticated;
select public.register_device('token-abcdefghijk', 'android', '1.0.0');
select tests.ok((select count(*) from public.device_tokens) = 1, 'token re-registered to the new user');
reset role;

rollback;
