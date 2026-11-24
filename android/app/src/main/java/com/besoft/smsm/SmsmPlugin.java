package com.besoft.smsm;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;

/** Bridge between the web app and the native reminder engine. */
@CapacitorPlugin(name = "Smsm")
public class SmsmPlugin extends Plugin {
    static SmsmPlugin instance;
    static JSObject pendingLaunch;
    private TextToSpeech tts;
    private boolean ttsReady, ttsInit;
    private final Map<String, PluginCall> speaking = new HashMap<>();
    private PluginCall waitingSpeak;
    private String waitingText;
    private float waitingRate = 1f;

    @Override
    public void load() {
        instance = this;
        AlertService.ensureChannels(getContext());
        if (getActivity() != null) capture(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        capture(intent);
    }

    static void capture(Intent i) {
        if (i == null) return;
        JSObject o = null;
        Uri data = i.getData();
        if (data != null && "smsm".equals(data.getScheme())) {
            o = new JSObject();
            o.put("act", data.getHost());
            i.setData(null);
        } else {
            String key = i.getStringExtra("smsm_key");
            if (key == null) return;
            o = new JSObject();
            o.put("key", key);
            o.put("act", i.getStringExtra("smsm_act"));
            i.removeExtra("smsm_key");
        }
        pendingLaunch = o;
        if (instance != null) instance.notifyListeners("launch", o, true);
    }

    static void emit(JSONObject ack) {
        if (instance == null) return;
        try {
            instance.notifyListeners("ack", JSObject.fromJSONObject(ack));
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        Scheduler.replaceAll(getContext(), items);
        call.resolve();
    }

    /** The task was handled inside the app: stop any ringing for it. */
    @PluginMethod
    public void dismiss(PluginCall call) {
        String key = call.getString("key");
        int id = call.getInt("id", 0);
        Context c = getContext();
        Scheduler.markDismissed(c, key);
        ActionReceiver.silence(c, id);
        call.resolve();
    }

    @PluginMethod
    public void getAcks(PluginCall call) {
        JSObject r = new JSObject();
        r.put("acks", Scheduler.takeAcks(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void getLaunch(PluginCall call) {
        JSObject r = pendingLaunch != null ? pendingLaunch : new JSObject();
        pendingLaunch = null;
        call.resolve(r);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        r.put("exact", Build.VERSION.SDK_INT < 31 || (am != null && am.canScheduleExactAlarms()));
        r.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        r.put("fullScreen", Build.VERSION.SDK_INT < 34 || (nm != null && nm.canUseFullScreenIntent()));
        r.put("mic", ContextCompat.checkSelfPermission(c, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void requestNotif(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED && getActivity() != null) {
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7101);
        }
        call.resolve();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String what = call.getString("what", "app");
        Context c = getContext();
        Uri pkg = Uri.parse("package:" + c.getPackageName());
        Intent i;
        switch (what) {
            case "notifications":
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName());
                break;
            case "exact":
                i = Build.VERSION.SDK_INT >= 31 ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) : null;
                break;
            case "overlay":
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg);
                break;
            case "battery":
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg);
                break;
            case "fullscreen":
                i = Build.VERSION.SDK_INT >= 34 ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) : null;
                break;
            case "tts":
                i = new Intent("com.android.settings.TTS_SETTINGS");
                break;
            default:
                i = null;
        }
        if (i == null) i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            c.startActivity(i);
        } catch (Exception e) {
            try {
                c.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        JSObject it = call.getObject("item");
        if (it == null) {
            call.reject("no item");
            return;
        }
        Intent s = new Intent(getContext(), AlertService.class);
        s.setAction(AlertService.ACTION_ALERT);
        s.putExtra("item", it.toString());
        ContextCompat.startForegroundService(getContext(), s);
        call.resolve();
    }

    /** Say something out loud (Android WebView has no speechSynthesis). Resolves when done. */
    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        float rate = call.getFloat("rate", 1f);
        if (text.length() == 0) {
            call.resolve();
            return;
        }
        if (tts == null) {
            waitingSpeak = call;
            waitingText = text;
            waitingRate = rate;
            tts = new TextToSpeech(getContext().getApplicationContext(), status -> {
                ttsInit = true;
                ttsReady = status == TextToSpeech.SUCCESS && AlertService.setArabic(tts);
                if (ttsReady) {
                    tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) {}
                        @Override public void onDone(String id) { finishSpeak(id); }
                        @Override public void onError(String id) { finishSpeak(id); }
                    });
                }
                PluginCall w = waitingSpeak;
                waitingSpeak = null;
                if (w != null) doSpeak(w, waitingText, waitingRate);
            });
            return;
        }
        if (!ttsInit) {
            if (waitingSpeak != null) waitingSpeak.resolve();
            waitingSpeak = call;
            waitingText = text;
            waitingRate = rate;
            return;
        }
        doSpeak(call, text, rate);
    }

    private void doSpeak(PluginCall call, String text, float rate) {
        if (!ttsReady) {
            call.resolve();
            return;
        }
        for (PluginCall c : speaking.values()) c.resolve();
        speaking.clear();
        String id = "s" + System.nanoTime();
        speaking.put(id, call);
        tts.setSpeechRate(0.95f * rate);
        Bundle p = new Bundle();
        p.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, p, id);
    }

    private void finishSpeak(String id) {
        PluginCall c = speaking.remove(id);
        if (c != null) c.resolve();
    }

    /** Keep a recorded voice note as a file the alarm can play even when the app is closed. */
    @PluginMethod
    public void saveAudio(PluginCall call) {
        String name = call.getString("name", "note" + System.currentTimeMillis() + ".webm").replaceAll("[^A-Za-z0-9._-]", "_");
        String data = call.getString("data", "");
        try {
            File dir = new File(getContext().getFilesDir(), "notes");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, name);
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            JSObject r = new JSObject();
            r.put("path", f.getAbsolutePath());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("save failed");
        }
    }

    @PluginMethod
    public void deleteAudio(PluginCall call) {
        String path = call.getString("path", "");
        File dir = new File(getContext().getFilesDir(), "notes");
        File f = new File(path);
        try {
            if (f.getCanonicalPath().startsWith(dir.getCanonicalPath())) f.delete();
        } catch (Exception ignored) {}
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        super.handleOnDestroy();
    }
}
