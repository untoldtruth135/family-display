"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type { User } from "@supabase/supabase-js";

import DisplayPairingManager from "@/components/DisplayPairingManager";

import ScheduleManager from "@/components/ScheduleManager";
import ScheduledMessageManager from "@/components/ScheduledMessageManager";

import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

import GoogleCalendarSelector from "@/components/GoogleCalendarSelector";

import BackgroundPhotoManager from "@/components/BackgroundPhotoManager";

import { supabase } from "@/lib/supabase-browser";

import styles from "./settings.module.css";

type DisplayRecord = {
  id: string;
  name: string;
  device_code: string;

  orientation:
    | "landscape"
    | "portrait"
    | "auto";

  timezone: string;

  use_24_hour_clock: boolean;

  theme:
    | "light"
    | "dark"
    | "photo";

  font_family: string;

  accent_color: string;

  card_opacity: number;

  show_clock: boolean;
  show_weather: boolean;
  show_forecast: boolean;
  show_calendar: boolean;
  show_message: boolean;

  background_enabled: boolean;

  background_interval_seconds: number;

  background_shuffle: boolean;

  background_fit:
    | "cover"
    | "contain";

  background_overlay_opacity: number;

  touch_controls_enabled: boolean;
};

export default function SettingsPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [authMode, setAuthMode] =
    useState<"login" | "signup">(
      "login"
    );

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    householdId,
    setHouseholdId,
  ] =
    useState<string | null>(null);

  const [
    displayId,
    setDisplayId,
  ] =
    useState<string | null>(null);

  // -------------------------------------------------------
  // Household settings
  // -------------------------------------------------------

  const [
    householdName,
    setHouseholdName,
  ] =
    useState(
      "Family Display"
    );

  const [
    weatherLocation,
    setWeatherLocation,
  ] =
    useState(
      "Lynden, Washington"
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "Good will steer, but you must row."
    );

  // -------------------------------------------------------
  // Display settings
  // -------------------------------------------------------

  const [
    displayName,
    setDisplayName,
  ] =
    useState(
      "Living Room Display"
    );

  const [
    deviceCode,
    setDeviceCode,
  ] =
    useState("");

  const [
    orientation,
    setOrientation,
  ] =
    useState<
      "landscape" |
      "portrait" |
      "auto"
    >("landscape");

  const [
    timezone,
    setTimezone,
  ] =
    useState(
      "America/Los_Angeles"
    );

  const [
    use24HourClock,
    setUse24HourClock,
  ] =
    useState(false);

  const [
    theme,
    setTheme,
  ] =
    useState<
      "light" |
      "dark" |
      "photo"
    >("light");

  const [
    fontFamily,
    setFontFamily,
  ] =
    useState("Arial");

  const [
    accentColor,
    setAccentColor,
  ] =
    useState("#169FE8");

  const [
    cardOpacity,
    setCardOpacity,
  ] =
    useState(0.95);

  // -------------------------------------------------------
  // Content visibility
  // -------------------------------------------------------

  const [
    showClock,
    setShowClock,
  ] =
    useState(true);

  const [
    showWeather,
    setShowWeather,
  ] =
    useState(true);

  const [
    showForecast,
    setShowForecast,
  ] =
    useState(true);

  const [
    showCalendar,
    setShowCalendar,
  ] =
    useState(true);

  const [
    showMessage,
    setShowMessage,
  ] =
    useState(true);

  // -------------------------------------------------------
  // Background
  // -------------------------------------------------------

  const [
    backgroundEnabled,
    setBackgroundEnabled,
  ] =
    useState(false);

  const [
    backgroundIntervalMinutes,
    setBackgroundIntervalMinutes,
  ] =
    useState(10);

  const [
    backgroundShuffle,
    setBackgroundShuffle,
  ] =
    useState(true);

  const [
    backgroundFit,
    setBackgroundFit,
  ] =
    useState<
      "cover" |
      "contain"
    >("cover");

  const [
    backgroundOverlayOpacity,
    setBackgroundOverlayOpacity,
  ] =
    useState(0.72);

  // -------------------------------------------------------
  // Local controls
  // -------------------------------------------------------

  const [
    touchControlsEnabled,
    setTouchControlsEnabled,
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

  // =======================================================
  // INITIALIZATION
  // =======================================================

  useEffect(() => {
    async function initialize() {
      const {
        data: {
          user: currentUser,
        },
      } =
        await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        await loadHousehold(
          currentUser
        );
      } else {
        setLoading(false);
      }
    }

    initialize();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          session
        ) => {
          const currentUser =
            session?.user ??
            null;

          setUser(
            currentUser
          );

          if (
            currentUser
          ) {
            await loadHousehold(
              currentUser
            );
          } else {
            setHouseholdId(
              null
            );

            setDisplayId(
              null
            );

            setLoading(
              false
            );
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =======================================================
  // LOAD HOUSEHOLD + DISPLAY
  // =======================================================

  async function loadHousehold(
    currentUser: User
  ) {
    setLoading(true);

    setError("");

    const {
      data: membership,
      error:
        membershipError,
    } =
      await supabase
        .from(
          "household_members"
        )
        .select(
          "household_id"
        )
        .eq(
          "user_id",
          currentUser.id
        )
        .limit(1)
        .maybeSingle();

    if (
      membershipError
    ) {
      setError(
        membershipError.message
      );

      setLoading(false);

      return;
    }

    if (!membership) {
      setHouseholdId(
        null
      );

      setDisplayId(
        null
      );

      setLoading(false);

      return;
    }

    const currentHouseholdId =
      membership.household_id;

    setHouseholdId(
      currentHouseholdId
    );

    // -----------------------------------------------------
    // Household
    // -----------------------------------------------------

    const {
      data: household,
      error:
        householdError,
    } =
      await supabase
        .from("households")
        .select("name")
        .eq(
          "id",
          currentHouseholdId
        )
        .single();

    if (
      householdError
    ) {
      setError(
        householdError.message
      );
    } else if (
      household
    ) {
      setHouseholdName(
        household.name
      );
    }

    // -----------------------------------------------------
    // Display settings
    // -----------------------------------------------------

    const {
      data:
        displaySettings,
      error:
        settingsError,
    } =
      await supabase
        .from(
          "display_settings"
        )
        .select(
          `
          weather_location,
          current_message,
          timezone,
          use_24_hour_clock,
          theme
          `
        )
        .eq(
          "household_id",
          currentHouseholdId
        )
        .maybeSingle();

    if (
      settingsError
    ) {
      setError(
        settingsError.message
      );
    }

    if (
      displaySettings
    ) {
      setWeatherLocation(
        displaySettings
          .weather_location ??
          "Lynden, Washington"
      );

      setMessage(
        displaySettings
          .current_message ??
          ""
      );

      if (
        displaySettings
          .timezone
      ) {
        setTimezone(
          displaySettings
            .timezone
        );
      }

      setUse24HourClock(
        displaySettings
          .use_24_hour_clock ??
          false
      );

      if (
        displaySettings
          .theme
      ) {
        setTheme(
          displaySettings
            .theme as
            | "light"
            | "dark"
            | "photo"
        );
      }
    }

    // -----------------------------------------------------
    // Physical display
    // -----------------------------------------------------

    const {
      data:
        displayRecord,
      error:
        displayError,
    } =
      await supabase
        .from("displays")
        .select(
          `
          id,
          name,
          device_code,
          orientation,
          timezone,
          use_24_hour_clock,
          theme,
          font_family,
          accent_color,
          card_opacity,
          show_clock,
          show_weather,
          show_forecast,
          show_calendar,
          show_message,
          background_enabled,
          background_interval_seconds,
          background_shuffle,
          background_fit,
          background_overlay_opacity,
          touch_controls_enabled
          `
        )
        .eq(
          "household_id",
          currentHouseholdId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        )
        .limit(1)
        .maybeSingle();

    if (
      displayError
    ) {
      setError(
        displayError.message
      );
    }

    if (
      displayRecord
    ) {
      applyDisplayRecord(
        displayRecord as DisplayRecord
      );
    }

    setLoading(false);
  }

  function applyDisplayRecord(
    display:
      DisplayRecord
  ) {
    setDisplayId(
      display.id
    );

    setDisplayName(
      display.name
    );

    setDeviceCode(
      display.device_code
    );

    setOrientation(
      display.orientation
    );

    setTimezone(
      display.timezone
    );

    setUse24HourClock(
      display
        .use_24_hour_clock
    );

    setTheme(
      display.theme
    );

    setFontFamily(
      display.font_family
    );

    setAccentColor(
      display.accent_color
    );

    setCardOpacity(
      Number(
        display.card_opacity
      )
    );

    setShowClock(
      display.show_clock
    );

    setShowWeather(
      display.show_weather
    );

    setShowForecast(
      display.show_forecast
    );

    setShowCalendar(
      display.show_calendar
    );

    setShowMessage(
      display.show_message
    );

    setBackgroundEnabled(
      display
        .background_enabled
    );

    setBackgroundIntervalMinutes(
      Math.max(
        1,
        Math.round(
          display
            .background_interval_seconds /
            60
        )
      )
    );

    setBackgroundShuffle(
      display
        .background_shuffle
    );

    setBackgroundFit(
      display
        .background_fit
    );

    setBackgroundOverlayOpacity(
      Number(
        display
          .background_overlay_opacity
      )
    );

    setTouchControlsEnabled(
      display
        .touch_controls_enabled
    );
  }

  // =======================================================
  // AUTH
  // =======================================================

  async function handleAuth(
    event:
      FormEvent
  ) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (
      !email ||
      !password
    ) {
      setError(
        "Enter an email address and password."
      );

      return;
    }

    if (
      authMode ===
      "signup"
    ) {
      const {
        error:
          signUpError,
      } =
        await supabase
          .auth
          .signUp({
            email,
            password,

            options: {
              emailRedirectTo:
                `${window.location.origin}/settings`,
            },
          });

      if (
        signUpError
      ) {
        setError(
          signUpError.message
        );

        return;
      }

      setNotice(
        "Account created. Check your email and confirm your account, then return here to sign in."
      );

      return;
    }

    const {
      error:
        loginError,
    } =
      await supabase
        .auth
        .signInWithPassword({
          email,
          password,
        });

    if (
      loginError
    ) {
      setError(
        loginError.message
      );
    }
  }

  async function logout() {
    await supabase
      .auth
      .signOut();
  }

  // =======================================================
  // FIRST-TIME HOUSEHOLD SETUP
  // =======================================================

  async function createHousehold(
    event:
      FormEvent
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);

    const {
      data:
        household,
      error:
        householdError,
    } =
      await supabase
        .from("households")
        .insert({
          name:
            householdName.trim(),

          created_by:
            user.id,
        })
        .select("id")
        .single();

    if (
      householdError ||
      !household
    ) {
      setError(
        householdError
          ?.message ??
          "Unable to create household."
      );

      setLoading(false);

      return;
    }

    const {
      error:
        memberError,
    } =
      await supabase
        .from(
          "household_members"
        )
        .insert({
          household_id:
            household.id,

          user_id:
            user.id,

          role:
            "owner",
        });

    if (
      memberError
    ) {
      setError(
        memberError.message
      );

      setLoading(false);

      return;
    }

    const {
      error:
        settingsError,
    } =
      await supabase
        .from(
          "display_settings"
        )
        .insert({
          household_id:
            household.id,

          weather_location:
            weatherLocation.trim(),

          current_message:
            message.trim(),

          timezone,

          temperature_unit:
            "F",

          use_24_hour_clock:
            use24HourClock,

          theme,
        });

    if (
      settingsError
    ) {
      setError(
        settingsError.message
      );

      setLoading(false);

      return;
    }

    const {
      data:
        newDisplay,
      error:
        displayError,
    } =
      await supabase
        .from("displays")
        .insert({
          household_id:
            household.id,

          name:
            "Living Room Display",

          timezone,

          use_24_hour_clock:
            use24HourClock,

          theme,
        })
        .select(
          `
          id,
          name,
          device_code,
          orientation,
          timezone,
          use_24_hour_clock,
          theme,
          font_family,
          accent_color,
          card_opacity,
          show_clock,
          show_weather,
          show_forecast,
          show_calendar,
          show_message,
          background_enabled,
          background_interval_seconds,
          background_shuffle,
          background_fit,
          background_overlay_opacity,
          touch_controls_enabled
          `
        )
        .single();

    if (
      displayError ||
      !newDisplay
    ) {
      setError(
        displayError
          ?.message ??
          "Unable to create display."
      );

      setLoading(false);

      return;
    }

    setHouseholdId(
      household.id
    );

    applyDisplayRecord(
      newDisplay as
        DisplayRecord
    );

    setNotice(
      "Family Display has been created."
    );

    setLoading(false);
  }

  // =======================================================
  // SAVE EVERYTHING
  // =======================================================

  async function saveSettings(
    event:
      FormEvent
  ) {
    event.preventDefault();

    if (
      !householdId ||
      !displayId
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    // -----------------------------------------------------
    // Household
    // -----------------------------------------------------

    const {
      error:
        householdError,
    } =
      await supabase
        .from("households")
        .update({
          name:
            householdName.trim(),
        })
        .eq(
          "id",
          householdId
        );

    if (
      householdError
    ) {
      setError(
        householdError.message
      );

      setSaving(false);

      return;
    }

    // -----------------------------------------------------
    // Household-wide dashboard settings
    // -----------------------------------------------------

    const {
      error:
        settingsError,
    } =
      await supabase
        .from(
          "display_settings"
        )
        .update({
          weather_location:
            weatherLocation.trim(),

          current_message:
            message.trim(),

          timezone,

          use_24_hour_clock:
            use24HourClock,

          theme,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "household_id",
          householdId
        );

    if (
      settingsError
    ) {
      setError(
        settingsError.message
      );

      setSaving(false);

      return;
    }

    // -----------------------------------------------------
    // Physical display configuration
    // -----------------------------------------------------

    const {
      error:
        displayError,
    } =
      await supabase
        .from("displays")
        .update({
          name:
            displayName.trim(),

          orientation,

          timezone,

          use_24_hour_clock:
            use24HourClock,

          theme,

          font_family:
            fontFamily,

          accent_color:
            accentColor,

          card_opacity:
            cardOpacity,

          show_clock:
            showClock,

          show_weather:
            showWeather,

          show_forecast:
            showForecast,

          show_calendar:
            showCalendar,

          show_message:
            showMessage,

          background_enabled:
            backgroundEnabled,

          background_interval_seconds:
            Math.max(
              60,
              backgroundIntervalMinutes *
                60
            ),

          background_shuffle:
            backgroundShuffle,

          background_fit:
            backgroundFit,

          background_overlay_opacity:
            backgroundOverlayOpacity,

          touch_controls_enabled:
            touchControlsEnabled,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          displayId
        );

    if (
      displayError
    ) {
      setError(
        displayError.message
      );

      setSaving(false);

      return;
    }

    setNotice(
      "Settings saved successfully."
    );

    setSaving(false);
  }

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.card
          }
        >
          <h1>
            Family Display
          </h1>

          <p>
            Loading...
          </p>
        </div>
      </main>
    );
  }

  // =======================================================
  // LOGIN
  // =======================================================

  if (!user) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.authCard
          }
        >
          <h1>
            Family Display
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            Dashboard Settings
          </p>

          <form
            onSubmit={
              handleAuth
            }
            className={
              styles.form
            }
          >
            <label>
              Email

              <input
                type="email"
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event
                      .target
                      .value
                  )
                }
                autoComplete="email"
              />
            </label>

            <label>
              Password

              <input
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event
                      .target
                      .value
                  )
                }
                autoComplete={
                  authMode ===
                  "login"
                    ? "current-password"
                    : "new-password"
                }
              />
            </label>

            {error && (
              <div
                className={
                  styles.errorMessage
                }
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                className={
                  styles.successMessage
                }
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              className={
                styles.primaryButton
              }
            >
              {authMode ===
              "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <button
            type="button"
            className={
              styles.textButton
            }
            onClick={() => {
              setError("");
              setNotice("");

              setAuthMode(
                authMode ===
                  "login"
                  ? "signup"
                  : "login"
              );
            }}
          >
            {authMode ===
            "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    );
  }

  // =======================================================
  // FIRST-TIME SETUP
  // =======================================================

  if (
    !householdId
  ) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.card
          }
        >
          <div
            className={
              styles.headerRow
            }
          >
            <div>
              <h1>
                Create Family Display
              </h1>

              <p
                className={
                  styles.subtitle
                }
              >
                Initial household setup
              </p>
            </div>

            <button
              type="button"
              onClick={
                logout
              }
              className={
                styles.secondaryButton
              }
            >
              Sign Out
            </button>
          </div>

          <form
            onSubmit={
              createHousehold
            }
            className={
              styles.form
            }
          >
            <label>
              Household name

              <input
                value={
                  householdName
                }
                onChange={(
                  event
                ) =>
                  setHouseholdName(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              Weather location

              <input
                value={
                  weatherLocation
                }
                onChange={(
                  event
                ) =>
                  setWeatherLocation(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              Message / Quote

              <textarea
                rows={5}
                value={
                  message
                }
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

            {error && (
              <div
                className={
                  styles.errorMessage
                }
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className={
                styles.primaryButton
              }
            >
              Create Display
            </button>
          </form>
        </div>
      </main>
    );
  }

  // =======================================================
  // MAIN SETTINGS
  // =======================================================

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.card
        }
      >
        <div
          className={
            styles.headerRow
          }
        >
          <div>
            <h1>
              Family Display Settings
            </h1>

            <p
              className={
                styles.subtitle
              }
            >
              Configure your household
              and wall display.
            </p>
          </div>

          <div
            className={
              styles.headerButtons
            }
          >
            <a
              href="/"
              target="_blank"
              className={
                styles.secondaryLink
              }
            >
              Preview
            </a>

            <button
              type="button"
              onClick={
                logout
              }
              className={
                styles.secondaryButton
              }
            >
              Sign Out
            </button>
          </div>
        </div>

        <form
          onSubmit={
            saveSettings
          }
          className={
            styles.form
          }
        >
          {/* =================================================
              GENERAL
          ================================================= */}

          <section
            className={
              styles.settingsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <h2>
                General
              </h2>

              <p>
                Household-wide settings.
              </p>
            </div>

            <label>
              Household name

              <input
                value={
                  householdName
                }
                onChange={(
                  event
                ) =>
                  setHouseholdName(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              Weather location

              <input
                value={
                  weatherLocation
                }
                onChange={(
                  event
                ) =>
                  setWeatherLocation(
                    event
                      .target
                      .value
                  )
                }
                placeholder="City, State"
              />
            </label>

            <label>
              Message / Quote

              <textarea
                rows={5}
                value={
                  message
                }
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
          </section>

          {/* =================================================
              DISPLAY DEVICE
          ================================================= */}

          <section
            className={
              styles.settingsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <h2>
                Display Device
              </h2>

              <p>
                Settings for this physical
                screen.
              </p>
            </div>

            <label>
              Display name

              <input
                value={
                  displayName
                }
                onChange={(
                  event
                ) =>
                  setDisplayName(
                    event
                      .target
                      .value
                  )
                }
              />
            </label>

            <label>
              Device code

              <input
                value={
                  deviceCode
                }
                readOnly
                className={
                  styles.readOnlyInput
                }
              />
            </label>

            <p
              className={
                styles.helpText
              }
            >
              The device code will later be
              used to pair a new TV or
              browser with this display.
            </p>

            <div
              className={
                styles.twoColumn
              }
            >
              <label>
                Orientation

                <select
                  value={
                    orientation
                  }
                  onChange={(
                    event
                  ) =>
                    setOrientation(
                      event
                        .target
                        .value as
                        | "landscape"
                        | "portrait"
                        | "auto"
                    )
                  }
                >
                  <option value="landscape">
                    Landscape
                  </option>

                  <option value="portrait">
                    Portrait
                  </option>

                  <option value="auto">
                    Auto
                  </option>
                </select>
              </label>

              <label>
                Time zone

                <select
                  value={
                    timezone
                  }
                  onChange={(
                    event
                  ) =>
                    setTimezone(
                      event
                        .target
                        .value
                    )
                  }
                >
                  <option value="America/Los_Angeles">
                    Pacific
                  </option>

                  <option value="America/Denver">
                    Mountain
                  </option>

                  <option value="America/Chicago">
                    Central
                  </option>

                  <option value="America/New_York">
                    Eastern
                  </option>

                  <option value="America/Anchorage">
                    Alaska
                  </option>

                  <option value="Pacific/Honolulu">
                    Hawaii
                  </option>
                </select>
              </label>
            </div>

            <ToggleRow
              label="24-hour time format"
              description="Display 14:30 instead of 2:30 PM."
              checked={
                use24HourClock
              }
              onChange={
                setUse24HourClock
              }
            />

            <ToggleRow
              label="Touch / mouse / remote controls"
              description="Allow controls to appear directly on the display."
              checked={
                touchControlsEnabled
              }
              onChange={
                setTouchControlsEnabled
              }
            />
          </section>
          
{displayId &&
  deviceCode && (
    <DisplayPairingManager
      displayId={
        displayId
      }
      deviceCode={
        deviceCode
      }
    />
  )}
          {/* =================================================
              APPEARANCE
          ================================================= */}

          <section
            className={
              styles.settingsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <h2>
                Appearance
              </h2>

              <p>
                Fonts, colors and dashboard
                styling.
              </p>
            </div>

            <div
              className={
                styles.twoColumn
              }
            >
              <label>
                Theme

                <select
                  value={
                    theme
                  }
                  onChange={(
                    event
                  ) =>
                    setTheme(
                      event
                        .target
                        .value as
                        | "light"
                        | "dark"
                        | "photo"
                    )
                  }
                >
                  <option value="light">
                    Light
                  </option>

                  <option value="dark">
                    Dark
                  </option>

                  <option value="photo">
                    Photo
                  </option>
                </select>
              </label>

              <label>
                Font

                <select
                  value={
                    fontFamily
                  }
                  onChange={(
                    event
                  ) =>
                    setFontFamily(
                      event
                        .target
                        .value
                    )
                  }
                >
                  <option value="Arial">
                    Arial
                  </option>

                  <option value="Helvetica">
                    Helvetica
                  </option>

                  <option value="Verdana">
                    Verdana
                  </option>

                  <option value="Trebuchet MS">
                    Trebuchet MS
                  </option>

                  <option value="Georgia">
                    Georgia
                  </option>
                </select>
              </label>
            </div>

            <div
              className={
                styles.colorRow
              }
            >
              <label>
                Accent color

                <div
                  className={
                    styles.colorInputRow
                  }
                >
                  <input
                    type="color"
                    value={
                      accentColor
                    }
                    onChange={(
                      event
                    ) =>
                      setAccentColor(
                        event
                          .target
                          .value
                      )
                    }
                    className={
                      styles.colorPicker
                    }
                  />

                  <input
                    value={
                      accentColor
                    }
                    onChange={(
                      event
                    ) =>
                      setAccentColor(
                        event
                          .target
                          .value
                      )
                    }
                  />
                </div>
              </label>
            </div>

            <label>
              Card transparency

              <div
                className={
                  styles.sliderRow
                }
              >
                <input
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.05"
                  value={
                    cardOpacity
                  }
                  onChange={(
                    event
                  ) =>
                    setCardOpacity(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                />

                <span>
                  {Math.round(
                    cardOpacity *
                      100
                  )}
                  %
                </span>
              </div>
            </label>

            <div
              className={
                styles.appearancePreview
              }
              style={{
                fontFamily,
                borderColor:
                  accentColor,
                backgroundColor:
                  `rgba(255,255,255,${cardOpacity})`,
              }}
            >
              <div
                className={
                  styles.previewAccent
                }
                style={{
                  backgroundColor:
                    accentColor,
                }}
              />

              <strong>
                Family Display
              </strong>

              <span>
                Appearance preview
              </span>
            </div>
          </section>

          {/* =================================================
              CONTENT
          ================================================= */}

          <section
            className={
              styles.settingsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <h2>
                Content
              </h2>

              <p>
                Choose which dashboard
                panels are visible.
              </p>
            </div>

            <ToggleRow
              label="Clock and date"
              checked={
                showClock
              }
              onChange={
                setShowClock
              }
            />

            <ToggleRow
              label="Current weather"
              checked={
                showWeather
              }
              onChange={
                setShowWeather
              }
            />

            <ToggleRow
              label="Weather forecast"
              checked={
                showForecast
              }
              onChange={
                setShowForecast
              }
            />

            <ToggleRow
              label="Calendar"
              checked={
                showCalendar
              }
              onChange={
                setShowCalendar
              }
            />

            <ToggleRow
              label="Message / quote"
              checked={
                showMessage
              }
              onChange={
                setShowMessage
              }
            />
          </section>

          {/* =================================================
              BACKGROUND PHOTOS
          ================================================= */}

          <section
            className={
              styles.settingsSection
            }
          >
            <div
              className={
                styles.sectionHeader
              }
            >
              <h2>
                Background Photos
              </h2>

              <p>
                Configure rotating
                backgrounds.
              </p>
            </div>

            <ToggleRow
              label="Enable rotating background photos"
              checked={
                backgroundEnabled
              }
              onChange={
                setBackgroundEnabled
              }
            />

            <div
              className={
                styles.twoColumn
              }
            >
              <label>
                Change photo every

                <div
                  className={
                    styles.unitInput
                  }
                >
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={
                      backgroundIntervalMinutes
                    }
                    onChange={(
                      event
                    ) =>
                      setBackgroundIntervalMinutes(
                        Math.max(
                          1,
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      )
                    }
                  />

                  <span>
                    minutes
                  </span>
                </div>
              </label>

              <label>
                Image fit

                <select
                  value={
                    backgroundFit
                  }
                  onChange={(
                    event
                  ) =>
                    setBackgroundFit(
                      event
                        .target
                        .value as
                        | "cover"
                        | "contain"
                    )
                  }
                >
                  <option value="cover">
                    Fill screen
                  </option>

                  <option value="contain">
                    Fit entire photo
                  </option>
                </select>
              </label>
            </div>

            <ToggleRow
              label="Shuffle photos"
              checked={
                backgroundShuffle
              }
              onChange={
                setBackgroundShuffle
              }
            />

            <label>
              Background dimming

              <div
                className={
                  styles.sliderRow
                }
              >
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={
                    backgroundOverlayOpacity
                  }
                  onChange={(
                    event
                  ) =>
                    setBackgroundOverlayOpacity(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                />

                <span>
                  {Math.round(
                    backgroundOverlayOpacity *
                      100
                  )}
                  %
                </span>
              </div>
            </label>

            {householdId && displayId && (
  <BackgroundPhotoManager
    householdId={householdId}
    displayId={displayId}
  />
)}
          </section>
<section
  className={
    styles.settingsSection
  }
>
  <div
    className={
      styles.sectionHeader
    }
  >
    <h2>
      Google Calendar
    </h2>

    <p>
      Connect Google Calendar,
      then select which calendars
      should appear on the family display.
    </p>
  </div>

  {householdId && (
    <>
      <GoogleCalendarConnect
        householdId={
          householdId
        }
      />

      <GoogleCalendarSelector
        householdId={
          householdId
        }
      />
    </>
  )}
</section>
          {/* =================================================
              SCHEDULE
          ================================================= */}

<section
  className={
    styles.settingsSection
  }
>
  <div
    className={
      styles.sectionHeader
    }
  >
    <h2>
      Schedule
    </h2>

    <p>
      Automatically dim or sleep
      the display.
    </p>
  </div>

  {displayId && (
    <ScheduleManager
      displayId={
        displayId
      }
    />
  )}
</section>

          {/* =================================================
              SCHEDULED FAMILY MESSAGES
          ================================================= */}

<section
  className={
    styles.settingsSection
  }
>
  <div
    className={
      styles.sectionHeader
    }
  >
    <h2>
      Scheduled Family Messages
    </h2>

    <p>
      Automatically show a family message
      during a specific date and time window.
    </p>
  </div>

  {householdId && (
    <ScheduledMessageManager
      householdId={
        householdId
      }
    />
  )}
</section>


          {/* =================================================
              STATUS
          ================================================= */}

          {error && (
            <div
              className={
                styles.errorMessage
              }
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className={
                styles.successMessage
              }
            >
              {notice}
            </div>
          )}

          <div
            className={
              styles.saveBar
            }
          >
            <button
              type="submit"
              disabled={
                saving
              }
              className={
                styles.primaryButton
              }
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

// =========================================================
// REUSABLE TOGGLE
// =========================================================

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;

  description?: string;

  checked: boolean;

  onChange:
    (
      checked: boolean
    ) => void;
}) {
  return (
    <div
      className={
        styles.toggleRow
      }
    >
      <div>
        <div
          className={
            styles.toggleLabel
          }
        >
          {label}
        </div>

        {description && (
          <div
            className={
              styles.toggleDescription
            }
          >
            {description}
          </div>
        )}
      </div>

      <label
        className={
          styles.switch
        }
      >
        <input
          type="checkbox"
          checked={
            checked
          }
          onChange={(
            event
          ) =>
            onChange(
              event
                .target
                .checked
            )
          }
        />

        <span
          className={
            styles.slider
          }
        />
      </label>
    </div>
  );
}