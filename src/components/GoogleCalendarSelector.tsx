"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase-browser";

import styles from "./GoogleCalendarSelector.module.css";

type GoogleCalendar = {
  id: string;
  name: string;
  color: string;
  foregroundColor: string;
  primary: boolean;
  selected: boolean;
};

type Props = {
  householdId: string;
};

export default function GoogleCalendarSelector({
  householdId,
}: Props) {
  const [
    calendars,
    setCalendars,
  ] =
    useState<
      GoogleCalendar[]
    >([]);

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

  useEffect(() => {
    loadCalendars();
  }, [householdId]);

  async function getAccessToken() {
    const {
      data,
      error:
        sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !data.session
    ) {
      throw new Error(
        "Please sign in again."
      );
    }

    return data.session.access_token;
  }

  async function loadCalendars() {
    setLoading(
      true
    );

    setError("");
    setNotice("");

    try {
      const accessToken =
        await getAccessToken();

      const response =
        await fetch(
          `/api/google/calendars?householdId=${encodeURIComponent(
            householdId
          )}`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },

            cache:
              "no-store",
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => null
          );

      if (!response.ok) {
        throw new Error(
          result?.error ??
            "Unable to load Google calendars."
        );
      }

      setCalendars(
        result?.calendars ??
          []
      );
    } catch (
      loadError
    ) {
      console.error(
        "Calendar list error:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load Google calendars."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function toggleCalendar(
    calendarId: string
  ) {
    setCalendars(
      (
        current
      ) =>
        current.map(
          (
            calendar
          ) =>
            calendar.id ===
            calendarId
              ? {
                  ...calendar,

                  selected:
                    !calendar.selected,
                }
              : calendar
        )
    );

    setNotice("");
  }

  async function saveCalendars() {
    setSaving(
      true
    );

    setError("");
    setNotice("");

    try {
      const accessToken =
        await getAccessToken();

      const selectedCalendars =
        calendars
          .filter(
            (
              calendar
            ) =>
              calendar.selected
          )
          .map(
            (
              calendar
            ) => ({
              id:
                calendar.id,

              name:
                calendar.name,
            })
          );

      const response =
        await fetch(
          "/api/google/calendars",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                householdId,

                calendars:
                  selectedCalendars,
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => null
          );

      if (!response.ok) {
        throw new Error(
          result?.error ??
            "Unable to save calendar selections."
        );
      }

      await loadCalendars();

      setNotice(
        "Calendar selections and Google colors saved successfully."
      );
    } catch (
      saveError
    ) {
      console.error(
        "Calendar save error:",
        saveError
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save calendar selections."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  if (loading) {
    return (
      <div
        className={
          styles.loading
        }
      >
        Loading Google calendars...
      </div>
    );
  }

  if (
    error &&
    calendars.length ===
      0
  ) {
    return (
      <div
        className={
          styles.error
        }
      >
        {error}
      </div>
    );
  }

  if (
    calendars.length ===
    0
  ) {
    return (
      <div
        className={
          styles.empty
        }
      >
        No Google calendars were found.
      </div>
    );
  }

  const selectedCount =
    calendars.filter(
      (
        calendar
      ) =>
        calendar.selected
    ).length;

  return (
    <div
      className={
        styles.container
      }
    >
      <div
        className={
          styles.header
        }
      >
        <div>
          <strong>
            Calendars
          </strong>

          <div
            className={
              styles.subtext
            }
          >
            Colors are imported
            directly from Google Calendar.
          </div>
        </div>

        <div
          className={
            styles.count
          }
        >
          {
            selectedCount
          }{" "}
          selected
        </div>
      </div>

      <div
        className={
          styles.list
        }
      >
        {calendars.map(
          (
            calendar
          ) => (
            <div
              className={
                styles.row
              }
              key={
                calendar.id
              }
            >
              <label
                className={
                  styles.calendarLabel
                }
              >
                <input
                  type="checkbox"
                  checked={
                    calendar.selected
                  }
                  onChange={() =>
                    toggleCalendar(
                      calendar.id
                    )
                  }
                />

                <span
                  className={
                    styles.googleColorDot
                  }
                  style={{
                    backgroundColor:
                      calendar.color,
                  }}
                />

                <span
                  className={
                    styles.calendarName
                  }
                >
                  {
                    calendar.name
                  }

                  {calendar.primary && (
                    <span
                      className={
                        styles.primary
                      }
                    >
                      Primary
                    </span>
                  )}
                </span>
              </label>

              <div
                className={
                  styles.googleColorInfo
                }
              >
                <span
                  className={
                    styles.googleColorPreview
                  }
                  style={{
                    backgroundColor:
                      calendar.color,

                    color:
                      calendar.foregroundColor,
                  }}
                >
                  Google
                </span>

                <span
                  className={
                    styles.colorValue
                  }
                >
                  {
                    calendar.color
                  }
                </span>
              </div>
            </div>
          )
        )}
      </div>

      <div
        className={
          styles.actions
        }
      >
        <button
          type="button"
          className={
            styles.saveButton
          }
          onClick={
            saveCalendars
          }
          disabled={
            saving
          }
        >
          {saving
            ? "Saving..."
            : "Save Calendar Selections"}
        </button>

        <button
          type="button"
          className={
            styles.refreshButton
          }
          onClick={
            loadCalendars
          }
          disabled={
            saving
          }
        >
          Refresh from Google
        </button>
      </div>

      {notice && (
        <div
          className={
            styles.success
          }
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          className={
            styles.error
          }
        >
          {error}
        </div>
      )}
    </div>
  );
}