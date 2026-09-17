"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase-browser";

import styles from "./settings.module.css";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  const [authMode, setAuthMode] =
    useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [householdId, setHouseholdId] =
    useState<string | null>(null);

  const [householdName, setHouseholdName] =
    useState("Family Display");

  const [weatherLocation, setWeatherLocation] =
    useState("Lynden, Washington");

  const [message, setMessage] = useState(
    "Good will steer, but you must row."
  );

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function initialize() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (currentUser) {
        await loadHousehold(currentUser);
      } else {
        setLoading(false);
      }
    }

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await loadHousehold(currentUser);
        } else {
          setHouseholdId(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadHousehold(
    currentUser: User
  ) {
    setLoading(true);
    setError("");

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", currentUser.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      setHouseholdId(null);
      setLoading(false);
      return;
    }

    setHouseholdId(membership.household_id);

    const {
      data: household,
      error: householdError,
    } = await supabase
      .from("households")
      .select("name")
      .eq("id", membership.household_id)
      .single();

    if (householdError) {
      setError(householdError.message);
    } else if (household) {
      setHouseholdName(household.name);
    }

    const {
      data: displaySettings,
      error: settingsError,
    } = await supabase
      .from("display_settings")
      .select(
        "weather_location,current_message"
      )
      .eq(
        "household_id",
        membership.household_id
      )
      .maybeSingle();

    if (settingsError) {
      setError(settingsError.message);
    }

    if (displaySettings) {
      setWeatherLocation(
        displaySettings.weather_location ??
          "Lynden, Washington"
      );

      setMessage(
        displaySettings.current_message ?? ""
      );
    }

    setLoading(false);
  }

  async function handleAuth(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!email || !password) {
      setError(
        "Enter an email address and password."
      );
      return;
    }

    if (authMode === "signup") {
      const { error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/settings`,
          },
        });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setNotice(
        "Account created. Check your email and confirm your account, then return here to sign in."
      );

      return;
    }

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
    }
  }

  async function createHousehold(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);

    const {
      data: household,
      error: householdError,
    } = await supabase
      .from("households")
      .insert({
        name: householdName.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (householdError || !household) {
      setError(
        householdError?.message ??
          "Unable to create household."
      );

      setLoading(false);
      return;
    }

    const { error: memberError } =
      await supabase
        .from("household_members")
        .insert({
          household_id: household.id,
          user_id: user.id,
          role: "owner",
        });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const { error: settingsError } =
      await supabase
        .from("display_settings")
        .insert({
          household_id: household.id,

          weather_location:
            weatherLocation.trim(),

          current_message: message.trim(),

          timezone:
            "America/Los_Angeles",

          temperature_unit: "F",

          use_24_hour_clock: false,

          theme: "light",
        });

    if (settingsError) {
      setError(settingsError.message);
      setLoading(false);
      return;
    }

    setHouseholdId(household.id);

    setNotice(
      "Family Display has been created."
    );

    setLoading(false);
  }

  async function saveSettings(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!householdId) {
      return;
    }

    setError("");
    setNotice("");

    const { error: householdError } =
      await supabase
        .from("households")
        .update({
          name: householdName.trim(),
        })
        .eq("id", householdId);

    if (householdError) {
      setError(householdError.message);
      return;
    }

    const { error: settingsError } =
      await supabase
        .from("display_settings")
        .update({
          weather_location:
            weatherLocation.trim(),

          current_message: message.trim(),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "household_id",
          householdId
        );

    if (settingsError) {
      setError(settingsError.message);
      return;
    }

    setNotice(
      "Settings saved successfully."
    );
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Family Display</h1>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.authCard}>
          <h1>Family Display</h1>

          <p className={styles.subtitle}>
            Dashboard Settings
          </p>

          <form
            onSubmit={handleAuth}
            className={styles.form}
          >
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete={
                  authMode === "login"
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
              {authMode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>

          <button
            className={styles.textButton}
            onClick={() => {
              setError("");
              setNotice("");

              setAuthMode(
                authMode === "login"
                  ? "signup"
                  : "login"
              );
            }}
          >
            {authMode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    );
  }

  if (!householdId) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div
            className={styles.headerRow}
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
              onClick={logout}
              className={
                styles.secondaryButton
              }
            >
              Sign Out
            </button>
          </div>

          <form
            onSubmit={createHousehold}
            className={styles.form}
          >
            <label>
              Household name
              <input
                value={householdName}
                onChange={(event) =>
                  setHouseholdName(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Weather location
              <input
                value={weatherLocation}
                onChange={(event) =>
                  setWeatherLocation(
                    event.target.value
                  )
                }
                placeholder="Lynden, Washington"
              />
            </label>

            <label>
              Message / Quote
              <textarea
                rows={5}
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
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

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div>
            <h1>Family Display Settings</h1>

            <p className={styles.subtitle}>
              Changes here will control
              your wall display.
            </p>
          </div>

          <button
            onClick={logout}
            className={
              styles.secondaryButton
            }
          >
            Sign Out
          </button>
        </div>

        <form
          onSubmit={saveSettings}
          className={styles.form}
        >
          <section
            className={
              styles.settingsSection
            }
          >
            <h2>General</h2>

            <label>
              Household name
              <input
                value={householdName}
                onChange={(event) =>
                  setHouseholdName(
                    event.target.value
                  )
                }
              />
            </label>
          </section>

          <section
            className={
              styles.settingsSection
            }
          >
            <h2>Weather</h2>

            <label>
              Location
              <input
                value={weatherLocation}
                onChange={(event) =>
                  setWeatherLocation(
                    event.target.value
                  )
                }
                placeholder="City, State"
              />
            </label>
          </section>

          <section
            className={
              styles.settingsSection
            }
          >
            <h2>Message / Quote</h2>

            <label>
              Display message
              <textarea
                rows={6}
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
              />
            </label>
          </section>

          <section
            className={
              styles.settingsSection
            }
          >
            <h2>Background Photos</h2>

            <p
              className={
                styles.helpText
              }
            >
              Photo uploads, rotation
              interval, shuffle and
              background opacity will be
              added in the next phase.
            </p>
          </section>

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
            Save Changes
          </button>
        </form>
      </div>
    </main>
  );
}