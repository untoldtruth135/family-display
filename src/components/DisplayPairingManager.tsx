"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase-browser";

type Props = {
  displayId: string;
  deviceCode: string;
};

type PairingRow = {
  id: string;
  display_id: string;
  device_name: string;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

function formatDate(
  value: string | null
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function formatLastSeen(
  value: string | null
) {
  if (!value) {
    return "Never";
  }

  const time =
    new Date(value).getTime();

  if (
    Number.isNaN(time)
  ) {
    return "Unknown";
  }

  const difference =
    Date.now() - time;

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  if (
    difference < minute
  ) {
    return "Just now";
  }

  if (
    difference < hour
  ) {
    const minutes =
      Math.floor(
        difference /
          minute
      );

    return `${minutes} minute${
      minutes === 1
        ? ""
        : "s"
    } ago`;
  }

  if (
    difference < day
  ) {
    const hours =
      Math.floor(
        difference /
          hour
      );

    return `${hours} hour${
      hours === 1
        ? ""
        : "s"
    } ago`;
  }

  const days =
    Math.floor(
      difference /
        day
    );

  if (days <= 7) {
    return `${days} day${
      days === 1
        ? ""
        : "s"
    } ago`;
  }

  return formatDate(value);
}

export default function DisplayPairingManager({
  displayId,
  deviceCode,
}: Props) {
  const [
    pairingEnabled,
    setPairingEnabled,
  ] =
    useState(false);

  const [
    pairingExpiresAt,
    setPairingExpiresAt,
  ] =
    useState<
      string | null
    >(null);

  const [
    pairings,
    setPairings,
  ] =
    useState<
      PairingRow[]
    >([]);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    loadingDevices,
    setLoadingDevices,
  ] =
    useState(true);

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

  const [
    renamingId,
    setRenamingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    renameValue,
    setRenameValue,
  ] =
    useState("");

  /*
    ========================================================
    LOAD STATE
    ========================================================
  */

  const loadState =
    useCallback(
      async () => {
        setLoadingDevices(
          true
        );

        const [
          displayResult,
          pairingResult,
        ] =
          await Promise.all(
            [
              supabase
                .from(
                  "displays"
                )
                .select(
                  `
                  pairing_enabled,
                  pairing_expires_at
                  `
                )
                .eq(
                  "id",
                  displayId
                )
                .maybeSingle(),

              supabase
                .from(
                  "display_pairings"
                )
                .select(
                  `
                  id,
                  display_id,
                  device_name,
                  paired_at,
                  last_seen_at,
                  revoked_at
                  `
                )
                .eq(
                  "display_id",
                  displayId
                )
                .order(
                  "paired_at",
                  {
                    ascending:
                      false,
                  }
                ),
            ]
          );

        if (
          displayResult.error
        ) {
          setError(
            displayResult
              .error
              .message
          );
        } else {
          const expires =
            displayResult
              .data
              ?.pairing_expires_at ??
            null;

          const active =
            Boolean(
              displayResult
                .data
                ?.pairing_enabled
            ) &&
            Boolean(expires) &&
            new Date(
              expires as string
            ).getTime() >
              Date.now();

          setPairingEnabled(
            active
          );

          setPairingExpiresAt(
            active
              ? expires
              : null
          );
        }

        if (
          pairingResult.error
        ) {
          setError(
            pairingResult
              .error
              .message
          );

          setPairings([]);
        } else {
          setPairings(
            (
              pairingResult.data ??
              []
            ) as PairingRow[]
          );
        }

        setLoadingDevices(
          false
        );
      },
      [
        displayId,
      ]
    );

  useEffect(
    () => {
      void loadState();
    },
    [
      loadState,
    ]
  );

  /*
    ========================================================
    ENABLE PAIRING
    ========================================================
  */

  async function enablePairing() {
    setBusy(true);
    setNotice("");
    setError("");

    const expiresAt =
      new Date(
        Date.now() +
          10 *
            60 *
            1000
      ).toISOString();

    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "displays"
        )
        .update({
          pairing_enabled:
            true,

          pairing_expires_at:
            expiresAt,
        })
        .eq(
          "id",
          displayId
        );

    if (updateError) {
      setError(
        updateError.message
      );

      setBusy(false);

      return;
    }

    setPairingEnabled(
      true
    );

    setPairingExpiresAt(
      expiresAt
    );

    setNotice(
      "Pairing enabled for 10 minutes."
    );

    setBusy(false);
  }

  /*
    ========================================================
    DISABLE PAIRING
    ========================================================
  */

  async function disablePairing() {
    setBusy(true);
    setNotice("");
    setError("");

    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "displays"
        )
        .update({
          pairing_enabled:
            false,

          pairing_expires_at:
            null,
        })
        .eq(
          "id",
          displayId
        );

    if (updateError) {
      setError(
        updateError.message
      );

      setBusy(false);

      return;
    }

    setPairingEnabled(
      false
    );

    setPairingExpiresAt(
      null
    );

    setNotice(
      "Pairing disabled."
    );

    setBusy(false);
  }

  /*
    ========================================================
    RENAME DEVICE
    ========================================================
  */

  function beginRename(
    pairing:
      PairingRow
  ) {
    setRenamingId(
      pairing.id
    );

    setRenameValue(
      pairing.device_name
    );

    setNotice("");
    setError("");
  }

  function cancelRename() {
    setRenamingId(
      null
    );

    setRenameValue("");
  }

  async function saveRename(
    pairing:
      PairingRow
  ) {
    const cleanedName =
      renameValue
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (!cleanedName) {
      setError(
        "Device name cannot be empty."
      );

      return;
    }

    if (
      cleanedName.length >
      80
    ) {
      setError(
        "Device name cannot exceed 80 characters."
      );

      return;
    }

    setBusy(true);
    setNotice("");
    setError("");

    const {
      error:
        renameError,
    } =
      await supabase.rpc(
        "rename_display_pairing_device",
        {
          target_pairing_id:
            pairing.id,

          new_device_name:
            cleanedName,
        }
      );

    if (renameError) {
      setError(
        renameError.message
      );

      setBusy(false);

      return;
    }

    setRenamingId(
      null
    );

    setRenameValue("");

    setNotice(
      `Device renamed to "${cleanedName}".`
    );

    await loadState();

    setBusy(false);
  }

  /*
    ========================================================
    REVOKE ONE DEVICE
    ========================================================
  */

  async function revokeDevice(
    pairing:
      PairingRow
  ) {
    const confirmed =
      window.confirm(
        `Revoke "${pairing.device_name}"?\n\nThis device will immediately lose access. Other paired devices will remain connected.`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice("");
    setError("");

    const {
      error:
        revokeError,
    } =
      await supabase.rpc(
        "revoke_display_pairing_device",
        {
          target_pairing_id:
            pairing.id,
        }
      );

    if (revokeError) {
      setError(
        revokeError.message
      );

      setBusy(false);

      return;
    }

    setNotice(
      `${pairing.device_name} was revoked.`
    );

    await loadState();

    setBusy(false);
  }

  /*
    ========================================================
    REVOKE ALL
    ========================================================
  */

  async function revokeDisplay() {
    const confirmed =
      window.confirm(
        "Revoke all paired devices?\n\nEvery TV, tablet, and browser currently paired with this display will immediately lose access."
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice("");
    setError("");

    const {
      error:
        revokeError,
    } =
      await supabase.rpc(
        "revoke_display_pairing",
        {
          target_display_id:
            displayId,
        }
      );

    if (revokeError) {
      setError(
        revokeError.message
      );

      setBusy(false);

      return;
    }

    setPairingEnabled(
      false
    );

    setPairingExpiresAt(
      null
    );

    setNotice(
      "All paired devices have been revoked."
    );

    await loadState();

    setBusy(false);
  }

  /*
    ========================================================
    REVOKE ALL + REPAIR
    ========================================================
  */

  async function revokeAndRepair() {
    const confirmed =
      window.confirm(
        "Revoke all devices and start over?\n\nEvery currently paired device will immediately lose access. A new 10-minute pairing window will then open."
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setNotice("");
    setError("");

    const {
      error:
        repairError,
    } =
      await supabase.rpc(
        "repair_display",
        {
          target_display_id:
            displayId,
        }
      );

    if (repairError) {
      setError(
        repairError.message
      );

      setBusy(false);

      return;
    }

    setPairingEnabled(
      true
    );

    setPairingExpiresAt(
      new Date(
        Date.now() +
          10 *
            60 *
            1000
      ).toISOString()
    );

    setNotice(
      "All previous devices were revoked. Pairing is enabled for 10 minutes."
    );

    await loadState();

    setBusy(false);
  }

  const activePairings =
    pairings.filter(
      (pairing) =>
        !pairing.revoked_at
    );

  return (
    <div
      style={{
        marginTop:
          "18px",

        padding:
          "16px",

        border:
          "1px solid #dce2e6",

        borderRadius:
          "10px",

        background:
          "#f8fafb",
      }}
    >
      {/* DEVICE CODE */}

      <div
        style={{
          fontSize:
            "13px",

          color:
            "#67727a",

          marginBottom:
            "6px",
        }}
      >
        Device pairing code
      </div>

      <div
        style={{
          fontFamily:
            "monospace",

          fontSize:
            "22px",

          fontWeight:
            700,

          letterSpacing:
            ".06em",

          marginBottom:
            "6px",
        }}
      >
        {deviceCode}
      </div>

      <div
        style={{
          fontSize:
            "12px",

          color:
            "#67727a",

          marginBottom:
            "16px",
        }}
      >
        Use this code on the
        display pairing page.
      </div>

      {/* PAIRING WINDOW */}

      <div
        style={{
          display:
            "flex",

          flexWrap:
            "wrap",

          gap:
            "10px",

          alignItems:
            "center",
        }}
      >
        {!pairingEnabled ? (
          <button
            type="button"
            disabled={busy}
            onClick={
              enablePairing
            }
          >
            {busy
              ? "Please wait..."
              : "Enable Pairing for 10 Minutes"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={
              disablePairing
            }
          >
            {busy
              ? "Please wait..."
              : "Disable Pairing"}
          </button>
        )}

        {pairingEnabled &&
          pairingExpiresAt && (
            <span
              style={{
                fontSize:
                  "12px",

                color:
                  "#027a48",

                fontWeight:
                  600,
              }}
            >
              Pairing window
              active
            </span>
          )}
      </div>

      {/* PAIRED DEVICES */}

      <div
        style={{
          marginTop:
            "24px",

          paddingTop:
            "18px",

          borderTop:
            "1px solid #dce2e6",
        }}
      >
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            flexWrap:
              "wrap",

            gap:
              "10px",

            marginBottom:
              "12px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight:
                  700,

                fontSize:
                  "16px",
              }}
            >
              Paired Devices
            </div>

            <div
              style={{
                fontSize:
                  "12px",

                color:
                  "#67727a",

                marginTop:
                  "3px",
              }}
            >
              {
                activePairings.length
              }{" "}
              active device
              {activePairings.length ===
              1
                ? ""
                : "s"}
            </div>
          </div>

          <button
            type="button"
            disabled={
              loadingDevices ||
              busy
            }
            onClick={() =>
              void loadState()
            }
          >
            {loadingDevices
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>

        {loadingDevices ? (
          <div>
            Loading paired
            devices...
          </div>
        ) : pairings.length ===
          0 ? (
          <div>
            No devices have
            been paired yet.
          </div>
        ) : (
          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                "10px",
            }}
          >
            {pairings.map(
              (
                pairing
              ) => {
                const active =
                  !pairing.revoked_at;

                const isRenaming =
                  renamingId ===
                  pairing.id;

                return (
                  <div
                    key={
                      pairing.id
                    }
                    style={{
                      padding:
                        "13px",

                      border:
                        "1px solid #dce2e6",

                      borderRadius:
                        "9px",

                      background:
                        "#ffffff",

                      opacity:
                        active
                          ? 1
                          : 0.65,
                    }}
                  >
                    {isRenaming ? (
                      <div>
                        <div
                          style={{
                            fontSize:
                              "12px",

                            fontWeight:
                              700,

                            marginBottom:
                              "6px",
                          }}
                        >
                          Device name
                        </div>

                        <input
                          type="text"
                          value={
                            renameValue
                          }
                          maxLength={
                            80
                          }
                          autoFocus
                          onChange={(
                            event
                          ) =>
                            setRenameValue(
                              event
                                .target
                                .value
                            )
                          }
                          onKeyDown={(
                            event
                          ) => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();

                              void saveRename(
                                pairing
                              );
                            }

                            if (
                              event.key ===
                              "Escape"
                            ) {
                              cancelRename();
                            }
                          }}
                          style={{
                            width:
                              "100%",

                            maxWidth:
                              "420px",

                            boxSizing:
                              "border-box",

                            padding:
                              "9px 10px",

                            border:
                              "1px solid #b8c2c8",

                            borderRadius:
                              "7px",

                            marginBottom:
                              "9px",
                          }}
                        />

                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              "8px",
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void saveRename(
                                pairing
                              )
                            }
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={
                              cancelRename
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display:
                            "flex",

                          justifyContent:
                            "space-between",

                          alignItems:
                            "flex-start",

                          gap:
                            "12px",

                          flexWrap:
                            "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap:
                                "8px",

                              flexWrap:
                                "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                pairing.device_name
                              }
                            </div>

                            <span
                              style={{
                                padding:
                                  "3px 7px",

                                borderRadius:
                                  "999px",

                                fontSize:
                                  "11px",

                                fontWeight:
                                  700,

                                background:
                                  active
                                    ? "#ecfdf3"
                                    : "#f2f4f7",

                                color:
                                  active
                                    ? "#027a48"
                                    : "#667085",
                              }}
                            >
                              {active
                                ? "Active"
                                : "Revoked"}
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop:
                                "8px",

                              fontSize:
                                "12px",

                              lineHeight:
                                1.6,

                              color:
                                "#67727a",
                            }}
                          >
                            <div>
                              Paired:{" "}
                              {formatDate(
                                pairing.paired_at
                              )}
                            </div>

                            <div>
                              Last seen:{" "}
                              {formatLastSeen(
                                pairing.last_seen_at
                              )}
                            </div>

                            {pairing.revoked_at && (
                              <div>
                                Revoked:{" "}
                                {formatDate(
                                  pairing.revoked_at
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              "8px",

                            flexWrap:
                              "wrap",
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              beginRename(
                                pairing
                              )
                            }
                          >
                            Rename
                          </button>

                          {active && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void revokeDevice(
                                  pairing
                                )
                              }
                              style={{
                                color:
                                  "#b42318",

                                fontWeight:
                                  700,
                              }}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* DISPLAY SECURITY */}

      <div
        style={{
          marginTop:
            "24px",

          paddingTop:
            "18px",

          borderTop:
            "1px solid #dce2e6",
        }}
      >
        <div
          style={{
            fontWeight:
              700,

            marginBottom:
              "6px",
          }}
        >
          Display Security
        </div>

        <div
          style={{
            fontSize:
              "13px",

            color:
              "#67727a",

            marginBottom:
              "12px",
          }}
        >
          Revoke individual
          devices above, or revoke
          every device associated
          with this display.
        </div>

        <div
          style={{
            display:
              "flex",

            flexWrap:
              "wrap",

            gap:
              "10px",
          }}
        >
          <button
            type="button"
            disabled={
              busy ||
              activePairings.length ===
                0
            }
            onClick={
              revokeDisplay
            }
          >
            Revoke All Devices
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={
              revokeAndRepair
            }
          >
            Revoke All & Re-pair
          </button>
        </div>
      </div>

      {notice && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "10px",

            background:
              "#ecfdf3",

            color:
              "#027a48",

            borderRadius:
              "8px",
          }}
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "10px",

            background:
              "#fef3f2",

            color:
              "#b42318",

            borderRadius:
              "8px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}