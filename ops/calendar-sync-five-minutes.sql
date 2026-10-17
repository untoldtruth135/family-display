-- MANUAL ONLY: review and apply separately after the web change is released.
-- This file is not a Supabase migration and GitHub validation never runs it.
-- Abort if the existing HTTP cron target is missing or ambiguous.
begin;
do $$
declare
  matching_jobs bigint;
  target_job bigint;
begin
  select count(*), min(jobid) into matching_jobs, target_job
  from cron.job
  where active and command like '%/functions/v1/calendar-sync%';
  if matching_jobs <> 1 then
    raise exception 'Expected one active calendar-sync HTTP job, found %', matching_jobs;
  end if;
  perform cron.alter_job(job_id := target_job, schedule := '*/5 * * * *');
end
$$;
commit;
-- Verify the schedule and internal per-household success, then persisted synced_at.
-- Roll back using the same guarded selection and schedule := '* * * * *'.

