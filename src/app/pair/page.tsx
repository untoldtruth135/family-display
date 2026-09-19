"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

export default function PairPage() {
  const router =
    useRouter();

  const [
    deviceCode,
    setDeviceCode,
  ] =
    useState("");

  const [
    deviceName,
    setDeviceName,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanedCode =
      deviceCode
        .trim()
        .toUpperCase();

    const cleanedName =
      deviceName
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (!cleanedCode) {
      setError(
        "Enter the display pairing code."
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
    setError("");

    try {
      const response =
        await fetch(
          "/api/display/pair",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                deviceCode:
                  cleanedCode,

                deviceName:
                  cleanedName ||
                  undefined,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to pair this display."
        );
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to pair this display."
      );

      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          "24px",

        background:
          "#f3f5f7",
      }}
    >
      <div
        style={{
          width:
            "100%",

          maxWidth:
            "440px",

          background:
            "#ffffff",

          border:
            "1px solid #dce2e6",

          borderRadius:
            "14px",

          padding:
            "28px",

          boxShadow:
            "0 12px 32px rgba(0, 0, 0, 0.08)",
        }}
      >
        <h1
          style={{
            margin:
              "0 0 8px",

            fontSize:
              "28px",

            lineHeight:
              1.2,
          }}
        >
          Pair Family Display
        </h1>

        <p
          style={{
            margin:
              "0 0 24px",

            color:
              "#67727a",

            lineHeight:
              1.5,
          }}
        >
          Enter the pairing
          code from Family
          Display Settings.
          You can also give
          this device a friendly
          name so it is easy to
          identify later.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
        >
          {/* DEVICE NAME */}

          <label
            htmlFor="deviceName"
            style={{
              display:
                "block",

              fontSize:
                "13px",

              fontWeight:
                700,

              marginBottom:
                "6px",
            }}
          >
            Device name
          </label>

          <input
            id="deviceName"
            type="text"
            value={
              deviceName
            }
            maxLength={
              80
            }
            disabled={
              busy
            }
            placeholder="Living Room TV"
            onChange={(
              event
            ) =>
              setDeviceName(
                event.target
                  .value
              )
            }
            style={{
              width:
                "100%",

              boxSizing:
                "border-box",

              padding:
                "12px 13px",

              marginBottom:
                "6px",

              border:
                "1px solid #b8c2c8",

              borderRadius:
                "8px",

              fontSize:
                "16px",
            }}
          />

          <div
            style={{
              fontSize:
                "12px",

              color:
                "#67727a",

              marginBottom:
                "18px",
            }}
          >
            Optional. If left
            blank, the display
            will use a name such
            as Chrome on Windows.
          </div>

          {/* DEVICE CODE */}

          <label
            htmlFor="deviceCode"
            style={{
              display:
                "block",

              fontSize:
                "13px",

              fontWeight:
                700,

              marginBottom:
                "6px",
            }}
          >
            Display code
          </label>

          <input
            id="deviceCode"
            type="text"
            value={
              deviceCode
            }
            disabled={
              busy
            }
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={
              false
            }
            placeholder="FD1234567890"
            onChange={(
              event
            ) =>
              setDeviceCode(
                event.target
                  .value
                  .toUpperCase()
              )
            }
            style={{
              width:
                "100%",

              boxSizing:
                "border-box",

              padding:
                "12px 13px",

              border:
                "1px solid #b8c2c8",

              borderRadius:
                "8px",

              fontFamily:
                "monospace",

              fontSize:
                "18px",

              fontWeight:
                700,

              letterSpacing:
                ".04em",

              textTransform:
                "uppercase",
            }}
          />

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

          <button
            type="submit"
            disabled={
              busy
            }
            style={{
              width:
                "100%",

              marginTop:
                "18px",

              padding:
                "12px 16px",

              border:
                "none",

              borderRadius:
                "8px",

              background:
                "#169FE8",

              color:
                "#ffffff",

              fontSize:
                "15px",

              fontWeight:
                700,

              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",

              opacity:
                busy
                  ? 0.7
                  : 1,
            }}
          >
            {busy
              ? "Pairing..."
              : "Pair Display"}
          </button>
        </form>
      </div>
    </main>
  );
}