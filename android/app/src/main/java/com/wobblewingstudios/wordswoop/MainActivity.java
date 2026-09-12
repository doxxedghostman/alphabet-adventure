package com.wobblewingstudios.wordswoop;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
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

    // Let the WebView draw fully behind the status bar and nav bar instead of
    // leaving opaque native OS chrome around it, so the game's own full-bleed
    // background art reaches every edge of the screen.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
  }
}
