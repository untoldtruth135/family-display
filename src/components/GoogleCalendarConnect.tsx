"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase-browser";

import styles from "./GoogleCalendarConnect.module.css";

type Props = {
  householdId: string;
};

export default function GoogleCalendarConnect({
  householdId,
}: Props) {
  const [
    connecting,
    setConnecting,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const status =
      params.get(
        "google"
      );

    if (
      status ===
      "connected"
    ) {
      setNotice(
        "Google Calendar connected successfully."
      );
    }

    if (
      status ===
      "error"
    ) {
      setError(
        params.get(
          "message"
        ) ??
          "Google Calendar connection failed."
      );
    }
  }, []);

  async function connectGoogle() {
    try {
      setConnecting(
        true
      );

      setNotice("");
      setError("");

      const {
        data,
        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

      if (
        sessionError ||
        !data.session
      ) {
        throw new Error(
          "Please sign in again before connecting Google Calendar."
        );
      }

      const response =
        await fetch(
          "/api/google/connect",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${data.session.access_token}`,
            },

            body:
              JSON.stringify({
                householdId,
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => null
          );

      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ??
            "Unable to start Google Calendar connection."
        );
      }

      if (!result?.url) {
        throw new Error(
          "Google authorization URL was not returned."
        );
      }

      window.location.href =
        result.url;
    } catch (
      connectError
    ) {
      console.error(
        "Google Calendar connection error:",
        connectError
      );

      setError(
        connectError instanceof
          Error
          ? connectError.message
          : "Unable to connect Google Calendar."
      );

      setConnecting(
        false
      );
    }
  }

  return (
    <div
      className={
        styles.container
      }
    >
      <button
        type="button"
        className={
          styles.button
        }
        onClick={
          connectGoogle
        }
        disabled={
          connecting
        }
      >
        {connecting
          ? "Connecting..."
          : "Connect Google Calendar"}
      </button>

      <p
        className={
          styles.note
        }
      >
        Family Display requests
        read-only access to your
        Google calendar list and
        calendar events.
      </p>

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