package com.familydisplay.launcher;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Calendar;

public class MainActivity extends Activity {

    private static final String DASHBOARD_URL =
            "https://family-display-home.netlify.app";

    /*
     * If the dashboard cannot load, wait before retrying.
     *
     * This avoids a rapid refresh loop if the home internet
     * connection is unavailable for an extended period.
     */
    private static final long RETRY_DELAY_MS =
            15_000L;

    /*
     * Perform one maintenance refresh every morning.
     *
     * This helps prevent a WebView that has been running
     * continuously for weeks from becoming stale.
     *
     * Uses the Fire Stick's local clock.
     */
    private static final int DAILY_REFRESH_HOUR =
            3;

    private static final int DAILY_REFRESH_MINUTE =
            30;


    private WebView webView;

    private final Handler handler =
            new Handler(
                    Looper.getMainLooper()
            );

    private boolean mainFrameFailed =
            false;

    private boolean destroyed =
            false;


    /*
     * ---------------------------------------------------------
     * RETRY TASK
     * ---------------------------------------------------------
     */

    private final Runnable retryRunnable =
            new Runnable() {

                @Override
                public void run() {

                    if (
                            destroyed
                                    ||
                            webView == null
                    ) {
                        return;
                    }


                    /*
                     * Do not repeatedly ask WebView to load
                     * while the Fire Stick has no network.
                     */
                    if (!isNetworkAvailable()) {

                        scheduleRetry();

                        return;
                    }


                    mainFrameFailed =
                            false;

                    webView.loadUrl(
                            DASHBOARD_URL
                    );
                }
            };


    /*
     * ---------------------------------------------------------
     * DAILY MAINTENANCE REFRESH
     * ---------------------------------------------------------
     */

    private final Runnable dailyRefreshRunnable =
            new Runnable() {

                @Override
                public void run() {

                    if (
                            !destroyed
                                    &&
                            webView != null
                    ) {

                        /*
                         * reload() preserves the current
                         * dashboard URL and pairing cookies.
                         */
                        webView.reload();
                    }


                    scheduleNextDailyRefresh();
                }
            };


    @Override
    protected void onCreate(
            Bundle savedInstanceState
    ) {
        super.onCreate(
                savedInstanceState
        );


        requestWindowFeature(
                Window.FEATURE_NO_TITLE
        );


        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );


        /*
         * Dedicated wall-display appliance.
         *
         * Prevent Android / Fire TV from dimming or sleeping
         * while Family Display is the active application.
         */
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        );


        enterFullscreen();


        webView =
                new WebView(
                        this
                );


        webView.setBackgroundColor(
                Color.BLACK
        );


        webView.setKeepScreenOn(
                true
        );


        setContentView(
                webView
        );


        /*
         * -----------------------------------------------------
         * WEBVIEW CONFIGURATION
         * -----------------------------------------------------
         */

        WebSettings settings =
                webView.getSettings();


        settings.setJavaScriptEnabled(
                true
        );


        settings.setDomStorageEnabled(
                true
        );


        settings.setDatabaseEnabled(
                true
        );


        settings.setLoadsImagesAutomatically(
                true
        );


        settings.setMediaPlaybackRequiresUserGesture(
                false
        );


        settings.setUseWideViewPort(
                true
        );


        settings.setLoadWithOverviewMode(
                true
        );


        settings.setSupportZoom(
                false
        );


        settings.setBuiltInZoomControls(
                false
        );


        settings.setDisplayZoomControls(
                false
        );


        /*
         * Standard caching is useful for recovering
         * gracefully from brief network interruptions.
         */
        settings.setCacheMode(
                WebSettings.LOAD_DEFAULT
        );


        /*
         * -----------------------------------------------------
         * PERSIST FAMILY DISPLAY PAIRING COOKIE
         * -----------------------------------------------------
         */

        CookieManager cookieManager =
                CookieManager.getInstance();


        cookieManager.setAcceptCookie(
                true
        );


        cookieManager.setAcceptThirdPartyCookies(
                webView,
                true
        );


        /*
         * -----------------------------------------------------
         * RESILIENT WEBVIEW CLIENT
         * -----------------------------------------------------
         */

        webView.setWebViewClient(
                new WebViewClient() {

                    @Override
                    public void onPageStarted(
                            WebView view,
                            String url,
                            android.graphics.Bitmap favicon
                    ) {

                        mainFrameFailed =
                                false;

                        super.onPageStarted(
                                view,
                                url,
                                favicon
                        );
                    }


                    @Override
                    public void onPageFinished(
                            WebView view,
                            String url
                    ) {

                        /*
                         * onPageFinished can occur even after
                         * certain WebView errors.
                         *
                         * Only cancel recovery when the main
                         * page actually completed successfully.
                         */
                        if (!mainFrameFailed) {

                            cancelRetry();
                        }


                        super.onPageFinished(
                                view,
                                url
                        );
                    }


                    /*
                     * Android 6+ main-frame error callback.
                     */
                    @Override
                    public void onReceivedError(
                            WebView view,
                            WebResourceRequest request,
                            WebResourceError error
                    ) {

                        if (
                                request != null
                                        &&
                                request.isForMainFrame()
                        ) {

                            handleMainFrameFailure();
                        }


                        super.onReceivedError(
                                view,
                                request,
                                error
                        );
                    }


                    /*
                     * Compatibility callback used by older
                     * Android / Fire OS WebView versions.
                     */
                    @SuppressWarnings("deprecation")
                    @Override
                    public void onReceivedError(
                            WebView view,
                            int errorCode,
                            String description,
                            String failingUrl
                    ) {

                        if (
                                failingUrl != null
                                        &&
                                (
                                        failingUrl.startsWith(
                                                DASHBOARD_URL
                                        )
                                                ||
                                        failingUrl.equals(
                                                view.getUrl()
                                        )
                                )
                        ) {

                            handleMainFrameFailure();
                        }


                        super.onReceivedError(
                                view,
                                errorCode,
                                description,
                                failingUrl
                        );
                    }


                    /*
                     * Retry server-side failures such as
                     * temporary Netlify 5xx responses.
                     *
                     * We intentionally do not automatically
                     * retry every 4xx response.
                     */
                    @Override
                    public void onReceivedHttpError(
                            WebView view,
                            WebResourceRequest request,
                            WebResourceResponse errorResponse
                    ) {

                        if (
                                request != null
                                        &&
                                request.isForMainFrame()
                                        &&
                                errorResponse != null
                                        &&
                                errorResponse.getStatusCode()
                                        >= 500
                        ) {

                            handleMainFrameFailure();
                        }


                        super.onReceivedHttpError(
                                view,
                                request,
                                errorResponse
                        );
                    }
                }
        );


        webView.setWebChromeClient(
                new WebChromeClient()
        );


        /*
         * -----------------------------------------------------
         * RESTORE OR LOAD DASHBOARD
         * -----------------------------------------------------
         */

        if (savedInstanceState != null) {

            webView.restoreState(
                    savedInstanceState
            );

        } else {

            webView.loadUrl(
                    DASHBOARD_URL
            );
        }


        scheduleNextDailyRefresh();
    }


    /*
     * ---------------------------------------------------------
     * NETWORK / FAILURE RECOVERY
     * ---------------------------------------------------------
     */

    private void handleMainFrameFailure() {

        mainFrameFailed =
                true;

        scheduleRetry();
    }


    private void scheduleRetry() {

        handler.removeCallbacks(
                retryRunnable
        );


        handler.postDelayed(
                retryRunnable,
                RETRY_DELAY_MS
        );
    }


    private void cancelRetry() {

        handler.removeCallbacks(
                retryRunnable
        );
    }


    @SuppressWarnings("deprecation")
    private boolean isNetworkAvailable() {

        ConnectivityManager manager =
                (
                        ConnectivityManager
                ) getSystemService(
                        Context.CONNECTIVITY_SERVICE
                );


        if (manager == null) {
            return true;
        }


        NetworkInfo networkInfo =
                manager
                        .getActiveNetworkInfo();


        return (
                networkInfo != null
                        &&
                networkInfo.isConnected()
        );
    }


    /*
     * ---------------------------------------------------------
     * DAILY REFRESH
     * ---------------------------------------------------------
     */

    private void scheduleNextDailyRefresh() {

        handler.removeCallbacks(
                dailyRefreshRunnable
        );


        Calendar now =
                Calendar.getInstance();


        Calendar next =
                (
                        Calendar
                ) now.clone();


        next.set(
                Calendar.HOUR_OF_DAY,
                DAILY_REFRESH_HOUR
        );


        next.set(
                Calendar.MINUTE,
                DAILY_REFRESH_MINUTE
        );


        next.set(
                Calendar.SECOND,
                0
        );


        next.set(
                Calendar.MILLISECOND,
                0
        );


        if (!next.after(now)) {

            next.add(
                    Calendar.DAY_OF_YEAR,
                    1
            );
        }


        long delay =
                next.getTimeInMillis()
                        -
                now.getTimeInMillis();


        handler.postDelayed(
                dailyRefreshRunnable,
                delay
        );
    }


    /*
     * ---------------------------------------------------------
     * FULLSCREEN
     * ---------------------------------------------------------
     */

    private void enterFullscreen() {

        getWindow()
                .getDecorView()
                .setSystemUiVisibility(

                        View.SYSTEM_UI_FLAG_FULLSCREEN

                                |

                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION

                                |

                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

                                |

                        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN

                                |

                        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION

                                |

                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
    }


    /*
     * ---------------------------------------------------------
     * ACTIVITY LIFECYCLE
     * ---------------------------------------------------------
     */

    @Override
    protected void onResume() {
        super.onResume();


        enterFullscreen();


        if (webView != null) {

            webView.onResume();


            /*
             * If the page had previously failed while the
             * display was inactive, retry shortly after resume.
             */
            if (mainFrameFailed) {

                scheduleRetry();
            }
        }


        /*
         * Recalculate the daily refresh in case the system
         * clock or timezone changed while the app was paused.
         */
        scheduleNextDailyRefresh();
    }


    @Override
    protected void onPause() {

        if (webView != null) {

            webView.onPause();
        }


        super.onPause();
    }


    @Override
    public void onWindowFocusChanged(
            boolean hasFocus
    ) {
        super.onWindowFocusChanged(
                hasFocus
        );


        if (hasFocus) {

            enterFullscreen();
        }
    }


    @Override
    protected void onSaveInstanceState(
            Bundle outState
    ) {

        if (webView != null) {

            webView.saveState(
                    outState
            );
        }


        super.onSaveInstanceState(
                outState
        );
    }


    /*
     * Let the Fire TV Back button navigate inside
     * WebView history before exiting the application.
     */

    @Override
    public boolean onKeyDown(
            int keyCode,
            KeyEvent event
    ) {

        if (
                keyCode ==
                        KeyEvent.KEYCODE_BACK

                        &&

                webView != null

                        &&

                webView.canGoBack()
        ) {

            webView.goBack();

            return true;
        }


        return super.onKeyDown(
                keyCode,
                event
        );
    }


    @Override
    protected void onDestroy() {

        destroyed =
                true;


        handler.removeCallbacksAndMessages(
                null
        );


        if (webView != null) {

            webView.stopLoading();

            webView.destroy();

            webView =
                    null;
        }


        super.onDestroy();
    }
}
