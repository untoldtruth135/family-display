"use client";

import {
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase-browser";

type Props = {
  displayId: string;
  deviceCode: string;
};

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
    busy,
    setBusy,
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

  /*
    -------------------------------------------------------
    ENABLE PAIRING FOR 10 MINUTES
    -------------------------------------------------------
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
        .from("displays")
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

    setNotice(
      "Pairing enabled for 10 minutes."
    );

    setBusy(false);
  }

  /*
    -------------------------------------------------------
    DISABLE PAIRING
    -------------------------------------------------------
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
        .from("displays")
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

    setNotice(
      "Pairing disabled."
    );

    setBusy(false);
  }

  /*
    -------------------------------------------------------
    REVOKE CURRENT DISPLAY
    -------------------------------------------------------

    This rotates the display token immediately.

    Any browser / TV using the old token will receive
    HTTP 401 the next time it requests display data.
    -------------------------------------------------------
  */

  async function revokeDisplay() {
    const confirmed =
      window.confirm(
        "Revoke this display?\n\nThe currently paired TV or browser will immediately lose access and will need to be paired again."
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

    setNotice(
      "Display revoked. The previous display session is no longer valid."
    );

    setBusy(false);
  }

  /*
    -------------------------------------------------------
    REVOKE AND OPEN A NEW 10-MINUTE PAIRING WINDOW
    -------------------------------------------------------
  */

  async function revokeAndRepair() {
    const confirmed =
      window.confirm(
        "Revoke and re-pair this display?\n\nThe currently paired TV or browser will immediately lose access. Pairing will then be enabled for 10 minutes."
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

    setNotice(
      "Previous display revoked. Pairing is now enabled for 10 minutes."
    );

    setBusy(false);
  }

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

      {/* NORMAL PAIRING CONTROLS */}

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
      </div>

      {/* SECURITY SECTION */}

      <div
        style={{
          marginTop:
            "20px",

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
          Revoking a display
          immediately invalidates
          its current pairing
          token. Use this if a
          display is replaced,
          lost, sold, or should no
          longer have access to
          your family dashboard.
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
              busy
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
            Revoke Display
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
            Revoke & Re-pair
          </button>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}

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

      {/* ERROR MESSAGE */}

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