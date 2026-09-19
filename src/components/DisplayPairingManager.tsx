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
  last_seen_at:
    | string
    | null;
  revoked_at:
    | string
    | null;
};


function formatDate(
  value:
    | string
    | null
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
  value:
    | string
    | null
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  const time =
    date.getTime();

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
    difference <
    minute
  ) {
    return "Just now";
  }


  if (
    difference <
    hour
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
    difference <
    day
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


  return formatDate(
    value
  );
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


  /*
    ========================================================
    LOAD DISPLAY PAIRING STATE + DEVICE LIST
    ========================================================
  */

  const loadState =
    useCallback(
      async () => {
        setLoadingDevices(
          true
        );

        setError("");


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

          const actuallyEnabled =
            Boolean(
              displayResult
                .data
                ?.pairing_enabled
            ) &&
            Boolean(
              expires
            ) &&
            new Date(
              expires as string
            ).getTime() >
              Date.now();


          setPairingEnabled(
            actuallyEnabled
          );

          setPairingExpiresAt(
            actuallyEnabled
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
    REVOKE ONE DEVICE
    ========================================================
  */

  async function revokeDevice(
    pairing:
      PairingRow
  ) {
    const confirmed =
      window.confirm(
        `Revoke "${pairing.device_name}"?\n\nThis device will immediately lose access to the Family Display. Other paired devices will remain connected.`
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
    REVOKE ALL DEVICES
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
    REVOKE ALL + OPEN NEW PAIRING WINDOW
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
        Use this code on
        the display pairing
        page.
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
            disabled={
              busy
            }
            onClick={
              enablePairing
            }
            style={{
              padding:
                "10px 14px",

              borderRadius:
                "8px",

              border:
                "1px solid #b8c2c8",

              background:
                "#ffffff",

              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",

              fontWeight:
                600,
            }}
          >
            {busy
              ? "Please wait..."
              : "Enable Pairing for 10 Minutes"}
          </button>
        ) : (
          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              disablePairing
            }
            style={{
              padding:
                "10px 14px",

              borderRadius:
                "8px",

              border:
                "1px solid #b8c2c8",

              background:
                "#ffffff",

              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",

              fontWeight:
                600,
            }}
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
            style={{
              padding:
                "7px 10px",

              borderRadius:
                "7px",

              border:
                "1px solid #b8c2c8",

              background:
                "#ffffff",

              cursor:
                "pointer",

              fontSize:
                "12px",

              fontWeight:
                600,
            }}
          >
            {loadingDevices
              ? "Loading..."
              : "Refresh"}
          </button>
        </div>


        {loadingDevices ? (
          <div
            style={{
              padding:
                "14px 0",

              color:
                "#67727a",

              fontSize:
                "13px",
            }}
          >
            Loading paired
            devices...
          </div>
        ) : pairings.length ===
          0 ? (
          <div
            style={{
              padding:
                "14px",

              border:
                "1px dashed #cbd5da",

              borderRadius:
                "8px",

              color:
                "#67727a",

              fontSize:
                "13px",

              background:
                "#ffffff",
            }}
          >
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
                      <div
                        style={{
                          minWidth:
                            0,
                        }}
                      >
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

                              overflowWrap:
                                "anywhere",
                            }}
                          >
                            {
                              pairing.device_name
                            }
                          </div>


                          <span
                            style={{
                              display:
                                "inline-block",

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
                            padding:
                              "8px 11px",

                            borderRadius:
                              "7px",

                            border:
                              "1px solid #b42318",

                            background:
                              "#ffffff",

                            color:
                              "#b42318",

                            cursor:
                              busy
                                ? "not-allowed"
                                : "pointer",

                            fontWeight:
                              700,

                            fontSize:
                              "12px",
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
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

            lineHeight:
              1.5,

            color:
              "#67727a",

            marginBottom:
              "12px",
          }}
        >
          You can revoke one
          device above without
          affecting the others.
          Use these controls only
          when you want to revoke
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
            style={{
              padding:
                "10px 14px",

              borderRadius:
                "8px",

              border:
                "1px solid #b42318",

              background:
                "#ffffff",

              color:
                "#b42318",

              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",

              fontWeight:
                700,
            }}
          >
            Revoke All Devices
          </button>


          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              revokeAndRepair
            }
            style={{
              padding:
                "10px 14px",

              borderRadius:
                "8px",

              border:
                "1px solid #b42318",

              background:
                "#b42318",

              color:
                "#ffffff",

              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",

              fontWeight:
                700,
            }}
          >
            Revoke All & Re-pair
          </button>
        </div>
      </div>


      {/* SUCCESS */}

      {notice && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "10px 12px",

            borderRadius:
              "8px",

            background:
              "#ecfdf3",

            color:
              "#027a48",

            fontSize:
              "13px",

            fontWeight:
              600,
          }}
        >
          {notice}
        </div>
      )}


      {/* ERROR */}

      {error && (
        <div
          style={{
            marginTop:
              "14px",

            padding:
              "10px 12px",

            borderRadius:
              "8px",

            background:
              "#fef3f2",

            color:
              "#b42318",

            fontSize:
              "13px",

            fontWeight:
              600,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}