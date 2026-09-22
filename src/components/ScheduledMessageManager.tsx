"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase-browser";


type ScheduledMessageRow = {
  id: string;
  household_id: string;
  message: string;
  starts_at: string;
  ends_at:
    | string
    | null;
  enabled: boolean;
  priority: number;
  created_at: string;
};


type Props = {
  householdId: string;
};


function toLocalInput(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() -
      offset
  )
    .toISOString()
    .slice(
      0,
      16
    );
}


function formatDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return "No end time";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    new Date(
      value
    )
  );
}


export default function ScheduledMessageManager({
  householdId,
}: Props) {
  const [
    messages,
    setMessages,
  ] =
    useState<
      ScheduledMessageRow[]
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

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    startsAt,
    setStartsAt,
  ] =
    useState("");

  const [
    endsAt,
    setEndsAt,
  ] =
    useState("");

  const [
    priority,
    setPriority,
  ] =
    useState(0);


  useEffect(() => {
    void loadMessages();
  }, [
    householdId,
  ]);


  async function loadMessages() {
    setLoading(
      true
    );

    setError("");

    const {
      data,
      error:
        loadError,
    } =
      await supabase
        .from(
          "scheduled_messages"
        )
        .select(
          `
          id,
          household_id,
          message,
          starts_at,
          ends_at,
          enabled,
          priority,
          created_at
          `
        )
        .eq(
          "household_id",
          householdId
        )
        .order(
          "starts_at",
          {
            ascending:
              true,
          }
        );


    if (loadError) {
      console.error(
        "Scheduled message load error:",
        loadError
      );

      setError(
        `Unable to load scheduled messages: ${loadError.message}`
      );

      setLoading(
        false
      );

      return;
    }


    setMessages(
      (
        data ??
        []
      ) as
        ScheduledMessageRow[]
    );

    setLoading(
      false
    );
  }


  function resetForm() {
    setEditingId(
      null
    );

    setMessage(
      ""
    );

    setStartsAt(
      ""
    );

    setEndsAt(
      ""
    );

    setPriority(
      0
    );
  }


  function editMessage(
    row:
      ScheduledMessageRow
  ) {
    setEditingId(
      row.id
    );

    setMessage(
      row.message
    );

    setStartsAt(
      toLocalInput(
        row.starts_at
      )
    );

    setEndsAt(
      toLocalInput(
        row.ends_at
      )
    );

    setPriority(
      row.priority
    );

    setError("");
    setNotice("");
  }


  async function saveMessage() {
    if (saving) {
      return;
    }

    setError("");
    setNotice("");

    const cleanedMessage =
      message.trim();


    if (!cleanedMessage) {
      setError(
        "Please enter a message."
      );

      return;
    }


    if (!startsAt) {
      setError(
        "Please choose a start date and time."
      );

      return;
    }


    const startDate =
      new Date(
        startsAt
      );


    if (
      Number.isNaN(
        startDate.getTime()
      )
    ) {
      setError(
        "The start date is invalid."
      );

      return;
    }


    let endDate:
      Date | null =
      null;


    if (endsAt) {
      endDate =
        new Date(
          endsAt
        );

      if (
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        setError(
          "The end date is invalid."
        );

        return;
      }


      if (
        endDate.getTime() <=
        startDate.getTime()
      ) {
        setError(
          "The end time must be after the start time."
        );

        return;
      }
    }


    setSaving(
      true
    );


    const values = {
      household_id:
        householdId,

      message:
        cleanedMessage,

      starts_at:
        startDate
          .toISOString(),

      ends_at:
        endDate
          ? endDate
              .toISOString()
          : null,

      priority,

      enabled:
        true,
    };


    if (editingId) {
      const {
        error:
          updateError,
      } =
        await supabase
          .from(
            "scheduled_messages"
          )
          .update({
            message:
              values.message,

            starts_at:
              values.starts_at,

            ends_at:
              values.ends_at,

            priority:
              values.priority,
          })
          .eq(
            "id",
            editingId
          );


      if (updateError) {
        console.error(
          "Scheduled message update error:",
          updateError
        );

        setError(
          `Unable to update message: ${updateError.message}`
        );

        setSaving(
          false
        );

        return;
      }


      setNotice(
        "Scheduled message updated."
      );
    } else {
      const {
        error:
          insertError,
      } =
        await supabase
          .from(
            "scheduled_messages"
          )
          .insert(
            values
          );


      if (insertError) {
        console.error(
          "Scheduled message insert error:",
          insertError
        );

        setError(
          `Unable to add message: ${insertError.message}`
        );

        setSaving(
          false
        );

        return;
      }


      setNotice(
        "Scheduled message added."
      );
    }


    resetForm();

    await loadMessages();

    setSaving(
      false
    );
  }


  async function toggleMessage(
    row:
      ScheduledMessageRow
  ) {
    setError("");
    setNotice("");

    const enabled =
      !row.enabled;


    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "scheduled_messages"
        )
        .update({
          enabled,
        })
        .eq(
          "id",
          row.id
        );


    if (updateError) {
      setError(
        `Unable to update message: ${updateError.message}`
      );

      return;
    }


    setMessages(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            row.id
              ? {
                  ...item,
                  enabled,
                }
              : item
        )
    );


    setNotice(
      enabled
        ? "Scheduled message enabled."
        : "Scheduled message disabled."
    );
  }


  async function deleteMessage(
    row:
      ScheduledMessageRow
  ) {
    const confirmed =
      window.confirm(
        "Delete this scheduled message?"
      );


    if (!confirmed) {
      return;
    }


    const {
      error:
        deleteError,
    } =
      await supabase
        .from(
          "scheduled_messages"
        )
        .delete()
        .eq(
          "id",
          row.id
        );


    if (deleteError) {
      setError(
        `Unable to delete message: ${deleteError.message}`
      );

      return;
    }


    setMessages(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.id !==
            row.id
        )
    );


    if (
      editingId ===
      row.id
    ) {
      resetForm();
    }


    setNotice(
      "Scheduled message deleted."
    );
  }


  return (
    <div className="scheduledMessageManager">
      <div className="scheduledMessageForm">
        <label className="scheduledMessageTextField">
          Message

          <textarea
            value={
              message
            }
            maxLength={
              500
            }
            rows={
              3
            }
            placeholder="Good luck at your game tonight!"
            onChange={(
              event
            ) =>
              setMessage(
                event
                  .target
                  .value
              )
            }
          />
        </label>


        <label>
          Starts

          <input
            type="datetime-local"
            value={
              startsAt
            }
            onChange={(
              event
            ) =>
              setStartsAt(
                event
                  .target
                  .value
              )
            }
          />
        </label>


        <label>
          Ends

          <input
            type="datetime-local"
            value={
              endsAt
            }
            onChange={(
              event
            ) =>
              setEndsAt(
                event
                  .target
                  .value
              )
            }
          />

          <small>
            Optional
          </small>
        </label>


        <label>
          Priority

          <input
            type="number"
            min={
              -100
            }
            max={
              100
            }
            value={
              priority
            }
            onChange={(
              event
            ) =>
              setPriority(
                Number(
                  event
                    .target
                    .value
                )
              )
            }
          />
        </label>


        <div className="scheduledMessageFormButtons">
          <button
            type="button"
            className="scheduleAddButton"
            disabled={
              saving
            }
            onClick={
              saveMessage
            }
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save Changes"
                : "Add Scheduled Message"}
          </button>


          {editingId && (
            <button
              type="button"
              className="photoToggleButton"
              onClick={
                resetForm
              }
            >
              Cancel
            </button>
          )}
        </div>
      </div>


      <div className="scheduleHelp">
        Scheduled messages temporarily replace your normal family message.

        {" "}

        If schedules overlap, the message with the higher priority wins.

        {" "}

        With equal priority, the most recently started message wins.
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
          Loading scheduled messages...
        </div>
      ) : messages.length ===
        0 ? (
        <div className="scheduleEmpty">
          No scheduled messages yet.
        </div>
      ) : (
        <div className="scheduledMessageList">
          {messages.map(
            (
              row
            ) => (
              <div
                className={`scheduledMessageRow ${
                  row.enabled
                    ? ""
                    : "scheduleDisabled"
                }`}
                key={
                  row.id
                }
              >
                <div className="scheduledMessageBody">
                  <div className="scheduledMessageCopy">
                    {
                      row.message
                    }
                  </div>

                  <div className="scheduledMessageDates">
                    {formatDateTime(
                      row.starts_at
                    )}

                    {" → "}

                    {formatDateTime(
                      row.ends_at
                    )}
                  </div>

                  <div className="scheduledMessagePriority">
                    Priority{" "}
                    {
                      row.priority
                    }
                  </div>
                </div>


                <div className="scheduleButtons">
                  <button
                    type="button"
                    className="photoToggleButton"
                    onClick={() =>
                      editMessage(
                        row
                      )
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="photoToggleButton"
                    onClick={() =>
                      toggleMessage(
                        row
                      )
                    }
                  >
                    {row.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </button>

                  <button
                    type="button"
                    className="photoDeleteButton"
                    onClick={() =>
                      deleteMessage(
                        row
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
