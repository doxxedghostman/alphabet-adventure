package com.wobblewingstudios.wordswoop;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // AndroidManifest.xml points this activity at AppTheme.NoActionBarLaunch,
    // which extends the system Theme.SplashScreen - that theme is only meant
    // to cover the brief native splash before the WebView loads. Because this
    // activity never switched away from it, the WHOLE app kept running under
    // Theme.SplashScreen permanently: its default (non edge-to-edge) system
    // bar chrome is what shows up as a purple bar above/below the WebView
    // content, even after the canvas is sized to a proper phone aspect ratio.
    setTheme(R.style.AppTheme_NoActionBar);
    super.onCreate(savedInstanceState);

    // A merely-transparent status/nav bar still leaves a gap the same
    // height, because the WebView still reserves a safe-area inset for it -
    // that's the thin purple strip that kept showing above the wood top
    // bar even after transparency was set. Going fully immersive (hiding
    // the bars outright, standard for full-screen games) removes that
    // reserved gap entirely instead of just making it see-through.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);

    // Also let content draw into the camera-cutout/notch area on phones
    // that have one, instead of Android reserving a black/blank strip
    // there too.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      getWindow().getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }

    hideSystemBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // The system can bring the bars back (e.g. after a system dialog, or
    // the user swiping them into view) - re-hide them whenever the window
    // regains focus so the game stays immersive rather than reverting to
    // showing bars permanently after the first interruption.
    if (hasFocus) {
      hideSystemBars();
    }
  }

  private void hideSystemBars() {
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    // BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE: bars can still be swiped into
    // view temporarily (e.g. to check the clock) and then auto-hide again,
    // rather than being permanently inaccessible.
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.systemBars());
  }
}
