"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase-browser";

type ScheduleAction =
  | "active"
  | "dim"
  | "sleep";

type ScheduleRow = {
  id: string;
  display_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  action: ScheduleAction;
  enabled: boolean;
};

type Props = {
  displayId: string;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTimeForInput(
  value: string
) {
  return value.slice(0, 5);
}

export default function ScheduleManager({
  displayId,
}: Props) {
  const [
    schedules,
    setSchedules,
  ] =
    useState<ScheduleRow[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    dayOfWeek,
    setDayOfWeek,
  ] =
    useState(0);

  const [
    startTime,
    setStartTime,
  ] =
    useState("22:00");

  const [
    endTime,
    setEndTime,
  ] =
    useState("06:00");

  const [
    action,
    setAction,
  ] =
    useState<ScheduleAction>(
      "sleep"
    );

  useEffect(() => {
    loadSchedules();
  }, [displayId]);

  async function loadSchedules() {
    setLoading(true);
    setError("");

    const {
      data,
      error: scheduleError,
    } =
      await supabase
        .from(
          "display_schedules"
        )
        .select(
          `
          id,
          display_id,
          day_of_week,
          start_time,
          end_time,
          action,
          enabled
          `
        )
        .eq(
          "display_id",
          displayId
        )
        .order(
          "day_of_week",
          {
            ascending: true,
          }
        )
        .order(
          "start_time",
          {
            ascending: true,
          }
        );

    if (scheduleError) {
      console.error(
        "Schedule load error:",
        scheduleError
      );

      setError(
        `Unable to load schedules: ${scheduleError.message}`
      );

      setLoading(false);

      return;
    }

    setSchedules(
      (data ?? []) as
        ScheduleRow[]
    );

    setLoading(false);
  }

  async function addSchedule() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    if (
      !startTime ||
      !endTime
    ) {
      setError(
        "Please choose a start time and an end time."
      );

      setSaving(false);

      return;
    }

    const {
      data,
      error: insertError,
    } =
      await supabase
        .from(
          "display_schedules"
        )
        .insert({
          display_id:
            displayId,

          day_of_week:
            dayOfWeek,

          start_time:
            startTime,

          end_time:
            endTime,

          action,

          enabled:
            true,
        })
        .select(
          `
          id,
          display_id,
          day_of_week,
          start_time,
          end_time,
          action,
          enabled
          `
        )
        .single();

    if (insertError) {
      console.error(
        "Schedule insert error:",
        insertError
      );

      setError(
        `Unable to save schedule: ${insertError.message}`
      );

      setSaving(false);

      return;
    }

    if (data) {
      setSchedules(
        (
          current
        ) => [
          ...current,
          data as ScheduleRow,
        ].sort(
          (
            first,
            second
          ) => {
            if (
              first.day_of_week !==
              second.day_of_week
            ) {
              return (
                first.day_of_week -
                second.day_of_week
              );
            }

            return first.start_time.localeCompare(
              second.start_time
            );
          }
        )
      );
    }

    setNotice(
      "Schedule added successfully."
    );

    setSaving(false);
  }

  async function toggleSchedule(
    schedule: ScheduleRow
  ) {
    setError("");
    setNotice("");

    const newValue =
      !schedule.enabled;

    const {
      error: updateError,
    } =
      await supabase
        .from(
          "display_schedules"
        )
        .update({
          enabled:
            newValue,
        })
        .eq(
          "id",
          schedule.id
        );

    if (updateError) {
      console.error(
        "Schedule update error:",
        updateError
      );

      setError(
        `Unable to update schedule: ${updateError.message}`
      );

      return;
    }

    setSchedules(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            schedule.id
              ? {
                  ...item,
                  enabled:
                    newValue,
                }
              : item
        )
    );

    setNotice(
      newValue
        ? "Schedule enabled."
        : "Schedule disabled."
    );
  }

  async function deleteSchedule(
    schedule:
      ScheduleRow
  ) {
    const confirmed =
      window.confirm(
        `Delete the ${
          DAYS[
            schedule
              .day_of_week
          ]
        } schedule?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    const {
      error: deleteError,
    } =
      await supabase
        .from(
          "display_schedules"
        )
        .delete()
        .eq(
          "id",
          schedule.id
        );

    if (deleteError) {
      console.error(
        "Schedule delete error:",
        deleteError
      );

      setError(
        `Unable to delete schedule: ${deleteError.message}`
      );

      return;
    }

    setSchedules(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.id !==
            schedule.id
        )
    );

    setNotice(
      "Schedule deleted."
    );
  }

  return (
    <div className="scheduleManager">
      <div className="scheduleForm">
        <label>
          Day

          <select
            value={
              dayOfWeek
            }
            onChange={(
              event
            ) =>
              setDayOfWeek(
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          >
            {DAYS.map(
              (
                day,
                index
              ) => (
                <option
                  key={
                    day
                  }
                  value={
                    index
                  }
                >
                  {
                    day
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Start

          <input
            type="time"
            value={
              startTime
            }
            onChange={(
              event
            ) =>
              setStartTime(
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <label>
          End

          <input
            type="time"
            value={
              endTime
            }
            onChange={(
              event
            ) =>
              setEndTime(
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <label>
          Action

          <select
            value={
              action
            }
            onChange={(
              event
            ) =>
              setAction(
                event
                  .target
                  .value as
                  ScheduleAction
              )
            }
          >
            <option value="active">
              Active
            </option>

            <option value="dim">
              Dim
            </option>

            <option value="sleep">
              Sleep
            </option>
          </select>
        </label>

        <button
          type="button"
          className="scheduleAddButton"
          onClick={
            addSchedule
          }
          disabled={
            saving
          }
        >
          {saving
            ? "Saving..."
            : "Add Schedule"}
        </button>
      </div>

      <div className="scheduleHelp">
        <strong>
          Active
        </strong>
        {" "}
        shows the display normally.
        {" "}

        <strong>
          Dim
        </strong>
        {" "}
        lowers brightness and visual intensity.
        {" "}

        <strong>
          Sleep
        </strong>
        {" "}
        blanks the wall display until the schedule ends.
      </div>

      {error && (
        <div className="photoError">
          {error}
        </div>
      )}

      {notice && (
        <div className="photoSuccess">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="scheduleEmpty">
          Loading schedules...
        </div>
      ) : schedules.length ===
        0 ? (
        <div className="scheduleEmpty">
          No schedules configured.
          The display will remain
          active all day.
        </div>
      ) : (
        <div className="scheduleList">
          {schedules.map(
            (
              schedule
            ) => (
              <div
                className={`scheduleRow ${
                  schedule.enabled
                    ? ""
                    : "scheduleDisabled"
                }`}
                key={
                  schedule.id
                }
              >
                <div className="scheduleDay">
                  {
                    DAYS[
                      schedule
                        .day_of_week
                    ]
                  }
                </div>

                <div className="scheduleTime">
                  {formatTimeForInput(
                    schedule.start_time
                  )}

                  {" – "}

                  {formatTimeForInput(
                    schedule.end_time
                  )}
                </div>

                <div
                  className={`scheduleAction scheduleAction-${schedule.action}`}
                >
                  {
                    schedule.action
                  }
                </div>

                <div className="scheduleButtons">
                  <button
                    type="button"
                    className="photoToggleButton"
                    onClick={() =>
                      toggleSchedule(
                        schedule
                      )
                    }
                  >
                    {schedule.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </button>

                  <button
                    type="button"
                    className="photoDeleteButton"
                    onClick={() =>
                      deleteSchedule(
                        schedule
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}