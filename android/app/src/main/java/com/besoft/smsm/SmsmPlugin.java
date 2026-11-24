package com.besoft.smsm;

import android.Manifest;
import android.app.Activity;
import android.media.MediaPlayer;
import android.speech.RecognizerIntent;
import android.speech.tts.Voice;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
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
    private String voiceName = "";
    private MediaPlayer player;
    private PluginCall playCall;

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
        voiceName = call.getString("voice", "");
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
        AlertService.applyVoice(tts, voiceName);
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


    /** Arabic voices installed on the phone, so the user can pick the nicest one. */
    @PluginMethod
    public void voices(PluginCall call) {
        if (tts == null || !ttsInit) {
            if (tts == null) {
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
                    listVoices(call);
                });
            } else {
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> listVoices(call), 1200);
            }
            return;
        }
        listVoices(call);
    }

    private void listVoices(PluginCall call) {
        JSArray arr = new JSArray();
        try {
            if (tts != null && tts.getVoices() != null) {
                for (Voice v : tts.getVoices()) {
                    if (v.getLocale() == null || !"ar".equals(v.getLocale().getLanguage())) continue;
                    JSObject o = new JSObject();
                    o.put("name", v.getName());
                    o.put("locale", v.getLocale().toLanguageTag());
                    o.put("quality", v.getQuality());
                    o.put("network", v.isNetworkConnectionRequired());
                    o.put("installed", v.getFeatures() == null || !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));
                    arr.put(o);
                }
            }
        } catch (Exception ignored) {}
        JSObject r = new JSObject();
        r.put("voices", arr);
        r.put("engine", tts != null ? tts.getDefaultEngine() : "");
        call.resolve(r);
    }

    /** Google's speech popup: gives the words AND the recording, so a voice note gets its time automatically. */
    @PluginMethod
    public void listenNote(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "ar-EG"));
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "قول الفويس نوت"));
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        i.putExtra("android.speech.extra.GET_AUDIO_FORMAT", "audio/AMR");
        i.putExtra("android.speech.extra.GET_AUDIO", true);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L);
        try {
            startActivityForResult(call, i, "onNote");
        } catch (Exception e) {
            call.reject("no_recognizer");
        }
    }

    @ActivityCallback
    private void onNote(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject o = new JSObject();
        Intent d = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || d == null) {
            o.put("cancel", true);
            call.resolve(o);
            return;
        }
        ArrayList<String> m = d.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        o.put("text", m != null && !m.isEmpty() ? m.get(0) : "");
        Uri u = d.getData();
        if (u != null) {
            try {
                File dir = new File(getContext().getFilesDir(), "notes");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, "v" + System.currentTimeMillis() + ".amr");
                try (InputStream in = getContext().getContentResolver().openInputStream(u); OutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                if (f.length() > 200) o.put("path", f.getAbsolutePath());
                else f.delete();
            } catch (Exception ignored) {}
        }
        call.resolve(o);
    }

    /** Play a saved recording inside the app; resolves when it ends. */
    @PluginMethod
    public void playFile(PluginCall call) {
        String path = call.getString("path", "");
        stopPlayer();
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            player.setDataSource(path);
            playCall = call;
            player.setOnCompletionListener(mp -> stopPlayer());
            player.setOnErrorListener((mp, w, e) -> { stopPlayer(); return true; });
            player.prepare();
            player.start();
        } catch (Exception e) {
            stopPlayer();
            call.reject("play failed");
        }
    }

    @PluginMethod
    public void stopFile(PluginCall call) {
        stopPlayer();
        call.resolve();
    }

    private void stopPlayer() {
        if (player != null) {
            try { player.stop(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
        PluginCall c = playCall;
        playCall = null;
        if (c != null) c.resolve();
    }

    /** Optional natural Egyptian voice from Microsoft Azure: saves the sentence as an mp3 (cached). */
    @PluginMethod
    public void cloudTts(PluginCall call) {
        final String text = call.getString("text", "");
        final String key = call.getString("key", "");
        final String region = call.getString("region", "").replaceAll("[^a-z0-9]", "");
        final String voice = call.getString("voice", "ar-EG-SalmaNeural").replaceAll("[^A-Za-z0-9-]", "");
        final String name = call.getString("name", "c" + System.currentTimeMillis() + ".mp3").replaceAll("[^A-Za-z0-9._-]", "_");
        final float rate = call.getFloat("rate", 1f);
        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), "voice");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                if (!f.exists() || f.length() < 500) {
                    String safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
                    int pct = Math.round((rate - 1f) * 100);
                    String ssml = "<speak version='1.0' xml:lang='ar-EG'><voice name='" + voice + "'><prosody rate='" + pct + "%'>" + safe + "</prosody></voice></speak>";
                    HttpURLConnection c = (HttpURLConnection) new URL("https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1").openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(15000);
                    c.setDoOutput(true);
                    c.setRequestProperty("Ocp-Apim-Subscription-Key", key);
                    c.setRequestProperty("Content-Type", "application/ssml+xml");
                    c.setRequestProperty("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3");
                    c.setRequestProperty("User-Agent", "smsm");
                    try (OutputStream o = c.getOutputStream()) { o.write(ssml.getBytes("UTF-8")); }
                    int code = c.getResponseCode();
                    if (code != 200) {
                        call.reject("azure " + code);
                        return;
                    }
                    try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                }
                JSObject r = new JSObject();
                r.put("path", f.getAbsolutePath());
                call.resolve(r);
            } catch (Exception e) {
                call.reject("azure failed");
            }
        }).start();
    }

    @Override
    protected void handleOnDestroy() {
        stopPlayer();
        if (tts != null) {
            try { tts.shutdown(); } catch (Exception ignored) {}
            tts = null;
        }
        super.handleOnDestroy();
    }
}
