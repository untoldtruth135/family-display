"use client";

import {
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
    pairing,
    setPairing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  async function pairDisplay() {
    const code =
      deviceCode
        .trim()
        .toUpperCase();

    if (!code) {
      setError(
        "Enter the display code."
      );

      return;
    }

    setPairing(
      true
    );

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
                  code,
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
            "Unable to pair display."
        );
      }

      router.replace(
        "/"
      );

      router.refresh();
    } catch (
      pairError
    ) {
      console.error(
        "Pair display error:",
        pairError
      );

      setError(
        pairError instanceof Error
          ? pairError.message
          : "Unable to pair display."
      );

      setPairing(
        false
      );
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
          "#eef3f6",
      }}
    >
      <section
        style={{
          width:
            "100%",

          maxWidth:
            "440px",

          padding:
            "32px",

          borderRadius:
            "18px",

          background:
            "#ffffff",

          boxShadow:
            "0 12px 40px rgba(0, 0, 0, 0.12)",
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
              "#66717a",

            fontSize:
              "14px",

            lineHeight:
              1.5,
          }}
        >
          Enable pairing from
          Settings, then enter the
          device code for this display.
        </p>

        <label
          style={{
            display:
              "block",

            marginBottom:
              "7px",

            color:
              "#3c454b",

            fontSize:
              "13px",

            fontWeight:
              700,
          }}
        >
          Display code
        </label>

        <input
          type="text"
          value={
            deviceCode
          }
          onChange={(
            event
          ) =>
            setDeviceCode(
              event
                .target
                .value
                .toUpperCase()
            )
          }
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
                "Enter" &&
              !pairing
            ) {
              pairDisplay();
            }
          }}
          placeholder="FD1234567890"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={
            false
          }
          disabled={
            pairing
          }
          style={{
            width:
              "100%",

            boxSizing:
              "border-box",

            padding:
              "14px 16px",

            border:
              "1px solid #cbd3d8",

            borderRadius:
              "10px",

            background:
              "#ffffff",

            color:
              "#252b2f",

            fontSize:
              "20px",

            fontFamily:
              "monospace",

            fontWeight:
              700,

            letterSpacing:
              "0.08em",

            outline:
              "none",
          }}
        />

        <button
          type="button"
          onClick={
            pairDisplay
          }
          disabled={
            pairing
          }
          style={{
            width:
              "100%",

            marginTop:
              "14px",

            padding:
              "13px 16px",

            border:
              "none",

            borderRadius:
              "10px",

            background:
              "#169fe8",

            color:
              "#ffffff",

            fontSize:
              "14px",

            fontWeight:
              700,

            cursor:
              pairing
                ? "wait"
                : "pointer",

            opacity:
              pairing
                ? 0.65
                : 1,
          }}
        >
          {pairing
            ? "Pairing..."
            : "Pair Display"}
        </button>

        {error && (
          <div
            style={{
              marginTop:
                "14px",

              padding:
                "11px 12px",

              borderRadius:
                "8px",

              background:
                "#fff0f0",

              color:
                "#a52f2f",

              fontSize:
                "13px",

              lineHeight:
                1.4,
            }}
          >
            {
              error
            }
          </div>
        )}
      </section>
    </main>
  );
}